import { type Page, expect, test } from '@playwright/test';
import { E2E_ADMIN } from './accounts';
import { wikiPath } from './helpers';

let ipCounter = 0;

/**
 * 실패 제한은 접속자마다 센다. 테스트끼리 영향을 주지 않도록 테스트마다 다른 접속자로 보이게 한다.
 * (서버는 Cloudflare가 넣는 CF-Connecting-IP만 믿는다: src/server/client-key.ts)
 */
async function actAsNewVisitor(page: Page): Promise<void> {
  ipCounter += 1;
  await page.setExtraHTTPHeaders({ 'cf-connecting-ip': `198.51.100.${ipCounter}-${Date.now()}` });
}

async function submitLogin(page: Page, username: string, password: string): Promise<void> {
  await page.getByLabel('아이디').fill(username);
  await page.getByLabel('비밀번호').fill(password);
  // 앞 시도의 안내 문구가 남아 있어서 화면만 보고는 끝났는지 알 수 없다. 서버 응답까지 기다린다.
  const response = page.waitForResponse((r) => r.request().method() === 'POST');
  await page.getByRole('button', { name: '로그인' }).click();
  await response;
}

const header = (page: Page) => page.getByRole('banner');
// Next.js의 경로 안내 영역도 role=alert라서 폼 안으로 범위를 좁힌다
const formAlert = (page: Page) => page.locator('form').getByRole('alert');

test.describe('로그인·로그아웃 (T034, AC-8.2)', () => {
  test.beforeEach(async ({ page }) => {
    await actAsNewVisitor(page);
  });

  test('상단바의 로그인 → 로그인하면 보던 문서로 돌아오고, 로그아웃하면 다시 로그인 링크', async ({
    page,
  }) => {
    await page.goto(wikiPath('대문'));
    await header(page).getByRole('link', { name: '로그인' }).click();
    await expect(page).toHaveURL(/\/login\?next=/);
    await expect(page).toHaveTitle('로그인 - 개발 위키');

    await submitLogin(page, E2E_ADMIN.username, E2E_ADMIN.password);
    await expect(page).toHaveURL(wikiPath('대문'));
    await expect(header(page)).toContainText(E2E_ADMIN.username);
    await expect(header(page).getByRole('link', { name: '로그인' })).toHaveCount(0);

    // 새로 고쳐도 로그인이 유지된다
    await page.reload();
    await expect(header(page)).toContainText(E2E_ADMIN.username);

    await header(page).getByRole('button', { name: '로그아웃' }).click();
    await expect(page).toHaveURL(wikiPath('대문'));
    await expect(header(page).getByRole('link', { name: '로그인' })).toBeVisible();
    await expect(header(page)).not.toContainText(E2E_ADMIN.username);
  });

  test('로그인 쿠키는 HttpOnly·SameSite=Lax이고, 로그아웃하면 지워진다', async ({ page, context }) => {
    await page.goto('/login');
    await submitLogin(page, E2E_ADMIN.username, E2E_ADMIN.password);
    await expect(header(page)).toContainText(E2E_ADMIN.username);
    const cookie = (await context.cookies()).find((c) => c.name === 'wiki_session');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    expect(cookie?.secure).toBe(false); // http 접속이므로

    await header(page).getByRole('button', { name: '로그아웃' }).click();
    await expect(header(page).getByRole('link', { name: '로그인' })).toBeVisible();
    expect((await context.cookies()).find((c) => c.name === 'wiki_session')).toBeUndefined();
  });

  test('로그아웃한 쿠키를 다시 넣어도 로그인되지 않는다', async ({ page, context }) => {
    await page.goto('/login');
    await submitLogin(page, E2E_ADMIN.username, E2E_ADMIN.password);
    await expect(header(page)).toContainText(E2E_ADMIN.username);
    const cookie = (await context.cookies()).find((c) => c.name === 'wiki_session');
    await header(page).getByRole('button', { name: '로그아웃' }).click();
    await expect(header(page).getByRole('link', { name: '로그인' })).toBeVisible();

    await context.addCookies([cookie!]);
    await page.reload();
    await expect(header(page).getByRole('link', { name: '로그인' })).toBeVisible();
  });

  test('틀린 비밀번호와 없는 아이디는 같은 안내를 보여주고, 아이디는 남겨 둔다', async ({ page }) => {
    await page.goto('/login');
    await submitLogin(page, E2E_ADMIN.username, 'wrong-password');
    await expect(formAlert(page)).toHaveText('아이디 또는 비밀번호가 맞지 않습니다.');
    await expect(page.getByLabel('아이디')).toHaveValue(E2E_ADMIN.username);
    await expect(page.getByLabel('비밀번호')).toHaveValue('');

    await submitLogin(page, 'nobody-here', 'wrong-password');
    await expect(formAlert(page)).toHaveText('아이디 또는 비밀번호가 맞지 않습니다.');
  });

  test('system 계정으로는 로그인할 수 없다', async ({ page }) => {
    await page.goto('/login');
    await submitLogin(page, 'system', '!');
    await expect(formAlert(page)).toHaveText('아이디 또는 비밀번호가 맞지 않습니다.');
  });

  test('5번 실패하면 맞는 비밀번호도 일정 시간 막는다 (AC-8.3)', async ({ page }) => {
    await page.goto('/login');
    for (let i = 0; i < 5; i += 1) {
      await submitLogin(page, E2E_ADMIN.username, `wrong-${i}`);
      await expect(formAlert(page)).toHaveText('아이디 또는 비밀번호가 맞지 않습니다.');
    }
    await submitLogin(page, E2E_ADMIN.username, E2E_ADMIN.password);
    await expect(formAlert(page)).toContainText('로그인을 너무 많이 실패했습니다.');
    await expect(formAlert(page)).toContainText('이후에 다시 시도해 주세요.');
    await expect(page).toHaveURL(/\/login/);

    // 다른 접속자는 영향을 받지 않는다
    await actAsNewVisitor(page);
    await submitLogin(page, E2E_ADMIN.username, E2E_ADMIN.password);
    await expect(header(page)).toContainText(E2E_ADMIN.username);
  });

  test('외부 주소로 돌려보내는 next 값은 무시한다', async ({ page }) => {
    await page.goto('/login?next=//evil.example.com/');
    await submitLogin(page, E2E_ADMIN.username, E2E_ADMIN.password);
    await expect(header(page)).toContainText(E2E_ADMIN.username);
    // 첫 화면(/)을 거쳐 대문까지 다 열린 뒤에 확인한다
    await expect(page.getByRole('heading', { level: 1, name: '대문' })).toBeVisible();
    expect(new URL(page.url()).host).toBe('127.0.0.1:3100');
  });

  test('이미 로그인했으면 로그인 화면 대신 돌아갈 곳으로 간다', async ({ page }) => {
    await page.goto('/login');
    await submitLogin(page, E2E_ADMIN.username, E2E_ADMIN.password);
    await expect(header(page)).toContainText(E2E_ADMIN.username);
    await page.goto(`/login?next=${encodeURIComponent(wikiPath('대문'))}`);
    await expect(page).toHaveURL(wikiPath('대문'));
    await expect(page.getByRole('heading', { level: 1, name: '대문' })).toBeVisible();
  });
});
