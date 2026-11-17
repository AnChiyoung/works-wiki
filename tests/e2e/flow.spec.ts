import { type Page, expect, test } from '@playwright/test';
import { uniqueTitle, wikiPath } from './helpers';

/** 가로 스크롤이 생기지 않았는지 (T017: 360px 이상에서 가로 스크롤 없음) */
async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** 문서 본문에서 글자가 들어 있는 목록 항목의 기호 모양 */
async function listStyleOf(page: Page, text: string): Promise<string> {
  // 하위 목록의 글자까지 섞이지 않도록 항목 자신의 첫 글자 조각으로 찾는다
  return page.evaluate((wanted) => {
    const li = [...document.querySelectorAll('.wiki-content li')].find(
      (el) => el.firstChild?.textContent?.trim() === wanted,
    );
    return li ? getComputedStyle(li).listStyleType : 'not found';
  }, text);
}

test.describe('M1 전체 흐름 (T025)', () => {
  test.beforeEach(async ({ page }, info) => {
    // 휴대폰 프로젝트는 스펙의 기준 너비(375px)로 맞춘다
    if (info.project.name === 'mobile') await page.setViewportSize({ width: 375, height: 812 });
  });

  test('대문 → 없는 문서 → 새로 만들기 → 미리보기 → 저장 → 보기 → 변경 없이 다시 저장', async ({
    page,
  }, info) => {
    // 1. 대문: 깊이별 목록 기호가 스펙대로 보인다 (T016, SX-19~21)
    await page.goto('/');
    await expect(page).toHaveURL(wikiPath('대문'));
    expect(await listStyleOf(page, '첫 번째 깊이')).toBe('disc');
    expect(await listStyleOf(page, '두 번째 깊이')).toBe('circle');
    expect(await listStyleOf(page, '세 번째 깊이')).toBe('square');
    expect(await listStyleOf(page, '첫 번째')).toBe('decimal');
    expect(await listStyleOf(page, '하위 항목')).toBe('lower-alpha');
    expect(await listStyleOf(page, '더 하위 항목')).toBe('lower-roman');
    await expectNoHorizontalScroll(page);

    // 2. 없는 문서(C/C++)
    const title = uniqueTitle('C/C++', info.project.name);
    const res = await page.goto(wikiPath(title));
    expect(res?.status()).toBe(404);
    await expect(page.getByText('문서가 없습니다.')).toBeVisible();

    // 3. 새로 만들기
    await page.getByRole('link', { name: '새로 만들기' }).click();
    await expect(page).toHaveURL(wikiPath(title, '/edit'));
    await expect(page.getByText('새 문서', { exact: true })).toBeVisible();
    const content =
      '# 개요\nC와 C++ 정리\n## 포인터\n`int *p;`\n# 참고\n- [cppreference](https://en.cppreference.com)';
    await page.getByLabel('문서 내용').fill(content);
    await page.getByLabel('편집 요약').fill('처음 작성');

    // 4. 미리보기
    await page.getByRole('tab', { name: '미리보기' }).click();
    const preview = page.getByRole('tabpanel', { name: '미리보기' });
    await expect(preview.getByRole('heading', { name: '1.1. 포인터' })).toBeVisible();
    await page.getByRole('tab', { name: '편집' }).click();
    await expect(page.getByLabel('문서 내용')).toHaveValue(content);
    await expectNoHorizontalScroll(page);

    // 5. 저장 → 문서 보기: 목차·번호·수정 정보
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page).toHaveURL(wikiPath(title));
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    const toc = page.getByRole('navigation', { name: '목차' });
    await expect(toc).toBeVisible();
    await expect(toc.getByRole('link', { name: '1.1.' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '1. 개요' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '1.1. 포인터' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '2. 참고' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'cppreference' })).toHaveAttribute('target', '_blank');
    await expect(page.locator('footer')).toContainText('마지막 수정');
    await expect(page.locator('footer')).toContainText('system');
    await expect(page).toHaveTitle(`${title} - 개발 위키`);
    await expectNoHorizontalScroll(page);

    // 6. 다시 편집 → 변경 없이 저장
    await page.getByRole('link', { name: '편집', exact: true }).click();
    await expect(page.getByLabel('문서 내용')).toHaveValue(content);
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByRole('status')).toHaveText('바뀐 내용이 없어서 저장하지 않았습니다.');
    await expect(page.getByRole('heading', { name: '1. 개요' })).toBeVisible();
  });
});
