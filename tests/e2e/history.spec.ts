import { type Page, expect, test } from '@playwright/test';
import { E2E_ADMIN } from './accounts';
import { createPage, uniqueTitle, wikiPath } from './helpers';

/** 문서를 만들고 두 번 더 고쳐서 3판까지 만든다 */
async function pageWithThreeRevisions(page: Page, base: string, project: string) {
  const title = uniqueTitle(base, project);
  await createPage(page, title, '첫 번째 판 내용');
  for (const content of ['두 번째 판 내용', '세 번째 판 내용']) {
    await page.goto(wikiPath(title, '/edit'));
    await page.getByLabel('문서 내용').fill(content);
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.locator('.wiki-content')).toHaveText(content);
  }
  return title;
}

test.describe('과거 판 보기 (T039, AC-4.3)', () => {
  test('?rev=로 과거 판 내용과 안내가 보이고, 편집 버튼 대신 최신 판 링크가 있다', async ({ page }, info) => {
    const title = await pageWithThreeRevisions(page, '과거 판', info.project.name);

    await page.goto(`${wikiPath(title)}?rev=1`);
    await expect(page.locator('.wiki-content')).toHaveText('첫 번째 판 내용');
    const note = page.getByRole('note');
    await expect(note).toContainText('1판');
    await expect(note).toContainText(E2E_ADMIN.username);
    await expect(note).toContainText('최신 판이 아닙니다');
    await expect(page.getByRole('link', { name: '편집', exact: true })).toHaveCount(0);
    await expect(page).toHaveTitle(`${title} (1판) - 개발 위키`);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

    await note.getByRole('link', { name: '최신 판 보기' }).click();
    await expect(page).toHaveURL(wikiPath(title));
    await expect(page.locator('.wiki-content')).toHaveText('세 번째 판 내용');
  });

  test('최신 판 번호로 열면 평소 화면과 같다', async ({ page }, info) => {
    const title = await pageWithThreeRevisions(page, '최신 판 번호', info.project.name);
    await page.goto(`${wikiPath(title)}?rev=3`);
    await expect(page.locator('.wiki-content')).toHaveText('세 번째 판 내용');
    await expect(page.getByRole('note')).toHaveCount(0);
    await expect(page.getByRole('link', { name: '편집', exact: true })).toBeVisible();
  });

  test('없는 판·잘못된 판 번호는 404와 안내', async ({ page }, info) => {
    const title = uniqueTitle('판 없음', info.project.name);
    await createPage(page, title, '내용');
    for (const rev of ['9', '0', 'abc']) {
      const res = await page.goto(`${wikiPath(title)}?rev=${rev}`);
      expect(res?.status()).toBe(404);
      await expect(page.getByText(`요청한 판(${rev})이 없습니다.`)).toBeVisible();
      await expect(page.getByRole('link', { name: '새로 만들기' })).toHaveCount(0);
    }
  });
});

test.describe('원문 보기 (T040)', () => {
  // 라우트 핸들러가 주소 조각을 인코딩된 채로 받는지 실제 서버에서 확인한다 (w/[...title]/page.tsx 주석 참고)
  for (const base of ['100%', 'C/C++', 'URL %20 인코딩']) {
    test(`특수한 제목의 원문도 받을 수 있다: ${base}`, async ({ page }, info) => {
      const title = uniqueTitle(base, info.project.name);
      await createPage(page, title, `# ${base}\n한글 원문`);
      const res = await page.request.get(wikiPath(title, '/raw'));
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toBe('text/plain; charset=utf-8');
      expect(await res.text()).toBe(`# ${base}\n한글 원문`);
    });
  }
});
