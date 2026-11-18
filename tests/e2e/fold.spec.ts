import { expect, test } from '@playwright/test';
import { createPage, expectNoHorizontalScroll, uniqueTitle, wikiPath } from './helpers';

// 접기 상자 (T053, SX-40~43)

const SOURCE = [
  '::: 접기 줄거리 보기',
  '접힌 내용 **굵게**',
  ':::: 펼침 안쪽 상자',
  '안쪽 내용',
  '::::',
  ':::',
  '',
  '::: 펼침',
  '처음부터 보이는 내용',
  ':::',
].join('\n');

test.describe('접기 상자 (T053)', () => {
  test('접힌 상자는 제목을 누르면 펼쳐지고, 펼침 상자는 처음부터 보인다', async ({ page }, info) => {
    const title = uniqueTitle('접기 상자', info.project.name);
    await createPage(page, title, SOURCE);

    const folded = page.getByText('접힌 내용');
    await expect(page.getByText('줄거리 보기')).toBeVisible();
    await expect(folded).toBeHidden();
    await expect(page.getByText('처음부터 보이는 내용')).toBeVisible();
    await expect(page.getByText('펼치기', { exact: true })).toBeVisible();

    await page.getByText('줄거리 보기').click();
    await expect(folded).toBeVisible();
    // 안쪽 상자는 펼침이라 바깥을 펴면 같이 보인다
    await expect(page.getByText('안쪽 내용')).toBeVisible();
    await expectNoHorizontalScroll(page);

    await page.getByText('안쪽 상자').click();
    await expect(page.getByText('안쪽 내용')).toBeHidden();
    await page.getByText('줄거리 보기').click();
    await expect(folded).toBeHidden();
  });

  test('키보드로도 펼치고, 상자 안 제목으로 가는 주소로 들어오면 펼쳐진다', async ({ page }, info) => {
    const title = uniqueTitle('접기 키보드', info.project.name);
    await createPage(page, title, '::: 접기 숨은 문단\n## 안쪽 제목\n안쪽 본문\n:::');

    await expect(page.getByText('안쪽 본문')).toBeHidden();
    await page.locator('summary', { hasText: '숨은 문단' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('안쪽 본문')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByText('안쪽 본문')).toBeHidden();

    await page.goto(`${wikiPath(title)}#s-1`);
    await expect(page.getByText('안쪽 본문')).toBeVisible();
  });
});
