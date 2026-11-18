import { expect, test } from '@playwright/test';
import { createPage, uniqueTitle, wikiPath } from './helpers';

// 각주 (T051, SX-31~33)

const SOURCE = '본문 첫 문장[^1] 둘째 문장[^출처]\n\n[^1]: 첫 각주 **내용**\n[^출처]: 출처 설명';

test.describe('각주 (T051)', () => {
  test('문서 끝에 각주 목록이 있고, 번호에서 말풍선이 열린다', async ({ page }, info) => {
    const title = uniqueTitle('각주', info.project.name);
    await createPage(page, title, SOURCE);

    const list = page.getByRole('region', { name: '각주' });
    await expect(list).toContainText('각주');
    await expect(list.getByRole('listitem')).toHaveText([/첫 각주 내용/, /출처 설명/]);

    const ref = page.getByRole('link', { name: '[1]', exact: true });
    const tooltip = page.getByRole('tooltip');

    if (info.project.name === 'mobile') {
      // 터치: 누르면 이동하지 않고 말풍선, 바깥을 누르면 닫힘
      await ref.tap();
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toHaveText('첫 각주 내용');
      await expect(page).toHaveURL(wikiPath(title));
      // 같은 번호를 다시 누르면 닫히고, 또 누르면 열린다
      await ref.tap();
      await expect(tooltip).toBeHidden();
      await ref.tap();
      await expect(tooltip).toBeVisible();
      await page.getByRole('heading', { level: 1, name: title }).tap();
      await expect(tooltip).toBeHidden();
    } else {
      // 마우스: 올리면 말풍선, 치우면 닫힘, 누르면 문서 끝 각주로 이동
      await ref.hover();
      await expect(tooltip).toBeVisible();
      await expect(tooltip).toHaveText('첫 각주 내용');
      await expect(ref).toHaveAttribute('aria-describedby', 'footnote-tooltip');
      await page.getByRole('heading', { level: 1, name: title }).hover();
      await expect(tooltip).toBeHidden();

      await page.getByRole('link', { name: '[2]', exact: true }).click();
      await expect(page).toHaveURL(`${wikiPath(title)}#fn2`);
    }
  });

  test('키보드로 번호에 초점을 옮겨도 말풍선이 열리고, Esc로 닫힌다', async ({ page }, info) => {
    const title = uniqueTitle('각주 키보드', info.project.name);
    await createPage(page, title, SOURCE);

    await page.getByRole('link', { name: '[2]', exact: true }).focus();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toHaveText('출처 설명');
    await page.keyboard.press('Escape');
    await expect(tooltip).toBeHidden();
  });
});
