import { expect, test as setup } from '@playwright/test';
import { ADMIN_STATE, E2E_ADMIN } from './accounts';

// 화면 테스트는 대부분 관리자로 로그인한 상태에서 돈다. 한 번 로그인해서 쿠키를 저장해 두고 재사용한다.
setup('관리자로 로그인', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('아이디').fill(E2E_ADMIN.username);
  await page.getByLabel('비밀번호').fill(E2E_ADMIN.password);
  await page.getByRole('button', { name: '로그인' }).click();
  await expect(page.getByRole('banner')).toContainText(E2E_ADMIN.username);
  await page.context().storageState({ path: ADMIN_STATE });
});
