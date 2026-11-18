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

test.describe('이력 화면 (T042, AC-4.1)', () => {
  test('판·시각·편집자·증감·요약을 최신순으로 보여주고, 판마다 보기 링크가 있다', async ({ page }, info) => {
    const title = await pageWithThreeRevisions(page, '이력 표', info.project.name);
    await page.getByRole('link', { name: '이력', exact: true }).click();
    await expect(page).toHaveURL(wikiPath(title, '/history'));
    await expect(page).toHaveTitle(`이력: ${title} - 개발 위키`);

    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('3판');
    await expect(rows.nth(2)).toContainText('1판');
    await expect(rows.nth(2)).toContainText('새 문서');
    await expect(rows.nth(0)).toContainText(E2E_ADMIN.username);
    // '첫 번째 판 내용'(21바이트) → '두 번째 판 내용'(21바이트): 2판 증감 0, 1판은 +21
    await expect(rows.nth(2).locator('[title="21 바이트"]')).toHaveText('+21');
    await expect(rows.nth(1).locator('[title="0 바이트"]')).toHaveText('0');

    await rows.nth(2).getByRole('link', { name: '1판' }).click();
    await expect(page).toHaveURL(`${wikiPath(title)}?rev=1`);
    await expect(page.locator('.wiki-content')).toHaveText('첫 번째 판 내용');
  });

  test('방문자도 이력 버튼과 이력 화면을 볼 수 있다', async ({ browser }, info) => {
    const admin = await browser.newContext({ storageState: info.project.use.storageState });
    const adminPage = await admin.newPage();
    const title = uniqueTitle('방문자 이력', info.project.name);
    await createPage(adminPage, title, '내용');
    await admin.close();

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await visitor.newPage();
    await page.goto(wikiPath(title));
    await page.getByRole('link', { name: '이력', exact: true }).click();
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await visitor.close();
  });

  test('없는 문서의 이력은 404', async ({ page }, info) => {
    const res = await page.goto(wikiPath(uniqueTitle('이력 없음', info.project.name), '/history'));
    expect(res?.status()).toBe(404);
    await expect(page.getByText('문서가 없어서 이력을 보여줄 수 없습니다.')).toBeVisible();
  });
});

test.describe('차이 화면 (T043, AC-4.2)', () => {
  test('이력에서 두 판을 골라 비교하면 추가·삭제가 +/− 기호와 함께 보인다', async ({ page }, info) => {
    const title = await pageWithThreeRevisions(page, '비교', info.project.name);
    await page.goto(wikiPath(title, '/history'));
    // 기본 선택은 최신 판(3)과 바로 앞 판(2). 이전 판을 1판으로 바꾼다
    await page.getByRole('radio', { name: '1판을 비교 기준(이전)으로' }).check();
    await page.getByRole('button', { name: '고른 두 판 비교' }).click();
    await expect(page).toHaveURL(/\/diff\//);
    const url = new URL(page.url());
    expect(url.pathname).toBe(wikiPath(title, '/diff'));
    expect(url.searchParams.get('from')).toBe('1');
    expect(url.searchParams.get('to')).toBe('3');

    const removed = page.locator('[data-type="removed"]');
    const added = page.locator('[data-type="added"]');
    await expect(removed).toHaveCount(1);
    await expect(added).toHaveCount(1);
    await expect(removed).toContainText('−');
    await expect(removed).toContainText('첫 번째 판 내용');
    await expect(added).toContainText('+');
    await expect(added).toContainText('세 번째 판 내용');
    await expect(page.getByText('+1줄')).toBeVisible();
    await expect(page.getByText('−1줄')).toBeVisible();
  });

  test('이력의 "차이" 링크는 바로 앞 판과 비교하고, 1판은 빈 문서와 비교한다', async ({ page }, info) => {
    const title = await pageWithThreeRevisions(page, '앞 판', info.project.name);
    await page.goto(wikiPath(title, '/history'));
    await page.getByRole('link', { name: '2판에서 바뀐 내용' }).click();
    await expect(page.locator('[data-type="added"]')).toContainText('두 번째 판 내용');
    await expect(page.locator('[data-type="removed"]')).toContainText('첫 번째 판 내용');

    await page.goto(`${wikiPath(title, '/diff')}?to=1`);
    await expect(page.getByText('(빈 문서)')).toBeVisible();
    await expect(page.locator('[data-type="added"]')).toContainText('첫 번째 판 내용');
  });

  test('같은 판끼리 비교하면 같다고 알려준다', async ({ page }, info) => {
    const title = await pageWithThreeRevisions(page, '같은 판', info.project.name);
    await page.goto(`${wikiPath(title, '/diff')}?from=2&to=2`);
    await expect(page.getByRole('status')).toHaveText('두 판의 내용이 같습니다.');
  });

  test('없는 판·잘못된 판 번호는 404', async ({ page }, info) => {
    const title = await pageWithThreeRevisions(page, '잘못된 비교', info.project.name);
    for (const query of ['?from=1&to=9', '?from=abc', '?to=0']) {
      const res = await page.goto(`${wikiPath(title, '/diff')}${query}`);
      expect(res?.status(), query).toBe(404);
    }
  });
});

test.describe('되돌리기 (T045, AC-4.4)', () => {
  test('과거 판에서 되돌리면 확인 창 뒤 문서로 돌아오고, 이력에 되돌림 판이 생긴다', async ({
    page,
  }, info) => {
    const title = await pageWithThreeRevisions(page, '되돌리기', info.project.name);
    await page.goto(`${wikiPath(title)}?rev=1`);
    await page.getByLabel('되돌리는 이유').fill('실수 취소');

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '이 판으로 되돌리기' }).click();

    await expect(page).toHaveURL(`${wikiPath(title)}?notice=reverted-1`);
    await expect(page.getByRole('status')).toHaveText('1판의 내용으로 되돌렸습니다.');
    await expect(page.locator('.wiki-content')).toHaveText('첫 번째 판 내용');

    await page.getByRole('link', { name: '이력', exact: true }).click();
    const newest = page.locator('tbody tr').first();
    await expect(newest).toContainText('4판');
    await expect(newest).toContainText('되돌림');
    await expect(newest).toContainText('1판으로 되돌림: 실수 취소');
  });

  test('확인 창에서 취소하면 아무 일도 없다', async ({ page }, info) => {
    const title = await pageWithThreeRevisions(page, '되돌리기 취소', info.project.name);
    await page.goto(`${wikiPath(title)}?rev=1`);
    page.once('dialog', (dialog) => dialog.dismiss());
    await page.getByRole('button', { name: '이 판으로 되돌리기' }).click();
    await expect(page).toHaveURL(`${wikiPath(title)}?rev=1`);
    await page.goto(wikiPath(title, '/history'));
    await expect(page.locator('tbody tr')).toHaveCount(3);
  });

  test('방문자에게는 되돌리기 버튼이 없다', async ({ page, browser }, info) => {
    const title = await pageWithThreeRevisions(page, '되돌리기 방문자', info.project.name);
    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const visitorPage = await visitor.newPage();
    await visitorPage.goto(`${wikiPath(title)}?rev=1`);
    await expect(visitorPage.getByRole('note')).toBeVisible();
    await expect(visitorPage.getByRole('button', { name: '이 판으로 되돌리기' })).toHaveCount(0);
    await visitor.close();
  });
});
