import { expect, test } from '@playwright/test';

// T005 화면 테스트 환경 확인용. T018에서 대문 이동 테스트로 바꾼다.
test('첫 화면이 열린다', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '개발 위키' })).toBeVisible();
});
