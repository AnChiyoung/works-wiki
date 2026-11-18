import { type Page, expect, test } from '@playwright/test';
import { createPage, uniqueTitle, wikiPath } from './helpers';

// 편집 충돌 (T046, AC-2.5): 같은 관리자 계정으로 탭 두 개를 열어 같은 문서를 고친다

async function saveIn(page: Page, content: string) {
  await page.getByLabel('문서 내용').fill(content);
  await page.getByRole('button', { name: '저장' }).click();
}

test.describe('편집 충돌 (T046, AC-2.5)', () => {
  test('먼저 저장된 내용을 덮어쓰지 않고 차이를 보여주며, 확인 뒤 다시 저장할 수 있다', async ({
    page,
  }, info) => {
    const title = uniqueTitle('편집 충돌', info.project.name);
    await createPage(page, title, '첫 줄\n둘째 줄');

    const mine = page;
    const other = await page.context().newPage();
    await mine.goto(wikiPath(title, '/edit'));
    await other.goto(wikiPath(title, '/edit'));

    // 다른 탭이 먼저 저장한다
    await saveIn(other, '첫 줄\n남이 고친 줄');
    await expect(other.locator('.wiki-content')).toContainText('남이 고친 줄');

    // 내 탭에서 저장하면 충돌 안내
    await saveIn(mine, '첫 줄\n내가 고친 줄');
    const notice = mine.getByRole('alert', { name: '편집 충돌' });
    await expect(notice).toContainText('다른 사람이 먼저 저장했습니다.');
    await expect(notice).toContainText('2판');
    await expect(notice.getByRole('link', { name: '2판' })).toHaveAttribute(
      'href',
      `${wikiPath(title)}?rev=2`,
    );
    await expect(notice.locator('[data-type="removed"]')).toContainText('남이 고친 줄');
    await expect(notice.locator('[data-type="added"]')).toContainText('내가 고친 줄');
    // 저장되지 않았고, 내가 쓴 내용은 입력창에 남아 있다
    await expect(mine).toHaveURL(wikiPath(title, '/edit'));
    await expect(mine.getByLabel('문서 내용')).toHaveValue('첫 줄\n내가 고친 줄');

    // 확인하고 다시 저장하면 최신 판 다음 판으로 저장된다
    await mine.getByRole('button', { name: '저장' }).click();
    await expect(mine).toHaveURL(wikiPath(title));
    await expect(mine.locator('.wiki-content')).toContainText('내가 고친 줄');
    await mine.goto(wikiPath(title, '/history'));
    await expect(mine.locator('tbody tr')).toHaveCount(3);
    await other.close();
  });

  test('같은 새 문서를 두 탭에서 만들면 늦게 저장한 쪽이 충돌 안내를 받는다', async ({ page }, info) => {
    const title = uniqueTitle('동시 생성', info.project.name);
    const mine = page;
    const other = await page.context().newPage();
    await mine.goto(wikiPath(title, '/edit'));
    await other.goto(wikiPath(title, '/edit'));

    await saveIn(other, '먼저 만든 내용');
    await expect(other.locator('.wiki-content')).toHaveText('먼저 만든 내용');

    await saveIn(mine, '늦게 만든 내용');
    const notice = mine.getByRole('alert', { name: '편집 충돌' });
    await expect(notice).toContainText('1판');
    await expect(mine.getByLabel('문서 내용')).toHaveValue('늦게 만든 내용');

    await mine.goto(wikiPath(title));
    await expect(mine.locator('.wiki-content')).toHaveText('먼저 만든 내용');
    await other.close();
  });

  test('되돌리기 화면을 연 뒤 다른 탭에서 저장했으면 되돌리지 않는다', async ({ page }, info) => {
    const title = uniqueTitle('되돌리기 충돌', info.project.name);
    await createPage(page, title, '첫 판');
    await page.goto(wikiPath(title, '/edit'));
    await saveIn(page, '둘째 판');
    await expect(page.locator('.wiki-content')).toHaveText('둘째 판');

    await page.goto(`${wikiPath(title)}?rev=1`);
    const other = await page.context().newPage();
    await other.goto(wikiPath(title, '/edit'));
    await saveIn(other, '셋째 판');
    await expect(other.locator('.wiki-content')).toHaveText('셋째 판');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '이 판으로 되돌리기' }).click();
    // Next.js의 경로 안내(__next-route-announcer__)도 role="alert"라서 글자로 고른다
    await expect(page.getByRole('alert').filter({ hasText: '다른 사람이 먼저 저장했습니다' })).toBeVisible();
    await page.goto(wikiPath(title));
    await expect(page.locator('.wiki-content')).toHaveText('셋째 판');
    await other.close();
  });
});
