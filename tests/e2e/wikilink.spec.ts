import { expect, test } from '@playwright/test';
import { createPage, uniqueTitle, wikiPath } from './helpers';

// 위키 링크 (T049, SX-22~24). 빨간 링크 표시는 T058에서 문서 화면에 연결한다.

test.describe('위키 링크 (T049)', () => {
  test('[[문서]]를 누르면 그 문서로, [[문서#문단]]은 그 문단으로 간다', async ({ page }, info) => {
    const target = uniqueTitle('C/C++', info.project.name);
    const filler = Array.from({ length: 40 }, (_, i) => `채움 줄 ${i + 1}`).join('\n\n');
    await createPage(page, target, `# 개요\n${filler}\n# 역사\n역사 본문`);

    const source = uniqueTitle('링크 문서', info.project.name);
    await createPage(page, source, `[[${target}]]\n\n[[${target}#역사|역사로 가기]]`);

    await page.getByRole('link', { name: target, exact: true }).click();
    await expect(page).toHaveURL(wikiPath(target));
    await expect(page.getByRole('heading', { level: 1, name: target })).toBeVisible();

    await page.goBack();
    await page.getByRole('link', { name: '역사로 가기' }).click();
    await expect(page).toHaveURL(`${wikiPath(target)}#${encodeURIComponent('역사')}`);
    await expect(page.getByRole('heading', { name: '2. 역사' })).toBeInViewport();
  });

  test('접힌 문단도 문단 링크로 들어오면 펼쳐진다', async ({ page }, info) => {
    const target = uniqueTitle('접힌 문단', info.project.name);
    await createPage(page, target, '# 개요\n개요 본문\n## 역사\n역사 본문');

    // 개요를 접어 둔 상태에서 같은 문서 안의 [[#역사]] 링크처럼 주소를 바꾼다
    await page.getByRole('heading', { name: '1. 개요' }).click();
    await expect(page.getByText('역사 본문')).toBeHidden();
    await page.evaluate(() => {
      window.location.hash = encodeURIComponent('역사');
    });
    await expect(page.getByText('역사 본문')).toBeVisible();
  });
});
