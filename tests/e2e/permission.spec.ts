import { type Page, expect, test } from '@playwright/test';
import { E2E_ADMIN, LOGGED_OUT } from './accounts';
import { createPage, uniqueTitle, wikiPath } from './helpers';

const header = (page: Page) => page.getByRole('banner');

test.describe('방문자 (T036, AC-2.1, AC-1.3)', () => {
  let existing: string;

  // 관리자로 문서를 하나 만들어 두고, 방문자 상태에서 확인한다
  test.beforeAll(async ({ browser }, info) => {
    const context = await browser.newContext({ storageState: info.project.use.storageState });
    const page = await context.newPage();
    existing = uniqueTitle('방문자용 문서', info.project.name);
    await createPage(page, existing, '# 개요\n방문자도 읽을 수 있다');
    await context.close();
  });

  test.use({ storageState: LOGGED_OUT });

  test('문서는 읽을 수 있지만 편집 버튼은 없다', async ({ page }) => {
    await page.goto(wikiPath(existing));
    await expect(page.getByText('방문자도 읽을 수 있다')).toBeVisible();
    await expect(page.getByRole('link', { name: '편집', exact: true })).toHaveCount(0);
    await expect(header(page).getByRole('link', { name: '로그인' })).toBeVisible();
  });

  test('없는 문서에는 새로 만들기 버튼이 없다', async ({ page }, info) => {
    const res = await page.goto(wikiPath(uniqueTitle('없는 문서', info.project.name)));
    expect(res?.status()).toBe(404);
    await expect(page.getByText('문서가 없습니다.')).toBeVisible();
    await expect(page.getByRole('link', { name: '새로 만들기' })).toHaveCount(0);
  });

  test('편집 주소로 가면 로그인 화면으로 가고, 로그인하면 편집 화면으로 돌아온다', async ({ page }) => {
    await page.goto(wikiPath(existing, '/edit'));
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page.getByRole('heading', { level: 1, name: '로그인' })).toBeVisible();

    // 실패 제한이 다른 테스트와 섞이지 않게 별도 접속자로 로그인한다
    await page.setExtraHTTPHeaders({ 'cf-connecting-ip': `203.0.113.${Date.now() % 250}` });
    await page.getByLabel('아이디').fill(E2E_ADMIN.username);
    await page.getByLabel('비밀번호').fill(E2E_ADMIN.password);
    await page.getByRole('button', { name: '로그인' }).click();
    await expect(page).toHaveURL(wikiPath(existing, '/edit'));
    await expect(page.getByLabel('문서 내용')).toHaveValue('# 개요\n방문자도 읽을 수 있다');
  });

  test('미리보기 API를 직접 불러도 403', async ({ page, baseURL }) => {
    const res = await page.request.post('/api/preview', {
      headers: { origin: baseURL! },
      data: { content: '# 몰래' },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe('관리자 (T036, AC-2.1)', () => {
  test('문서를 만들고 고칠 수 있고, 하단 수정자에 관리자 아이디가 보인다', async ({ page }, info) => {
    const title = uniqueTitle('관리자 문서', info.project.name);
    await createPage(page, title, '처음 내용');
    await expect(header(page)).toContainText(E2E_ADMIN.username);
    await expect(page.locator('footer')).toContainText(E2E_ADMIN.username);

    await page.getByRole('link', { name: '편집', exact: true }).click();
    await page.getByLabel('문서 내용').fill('고친 내용');
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.locator('.wiki-content')).toHaveText('고친 내용');
    await expect(page.locator('footer')).toContainText(E2E_ADMIN.username);
  });

  test('미리보기 API를 쓸 수 있다', async ({ page, baseURL }) => {
    await page.goto(wikiPath('대문'));
    const res = await page.request.post('/api/preview', {
      headers: { origin: baseURL! },
      data: { content: '# 제목' },
    });
    expect(res.status()).toBe(200);
  });
});
