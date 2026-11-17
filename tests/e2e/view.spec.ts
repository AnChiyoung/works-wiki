import { expect, test } from '@playwright/test';
import { createPage, uniqueTitle, wikiPath } from './helpers';

test.describe('문서 보기', () => {
  test('T018 첫 화면은 대문으로 이동한다 (AC-1.6)', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(wikiPath('대문'));
    await expect(page.getByRole('heading', { level: 1, name: '대문' })).toBeVisible();
  });

  test('T019 대문: 본문, 목차, 제목 번호, 수정 정보 (AC-1.1, 1.4, 1.5)', async ({ page }) => {
    await page.goto(wikiPath('대문'));
    await expect(page).toHaveTitle('대문 - 개발 위키');
    await expect(page.getByRole('navigation', { name: '목차' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '1.1. 제목' })).toBeVisible();
    await expect(page.locator('footer')).toContainText('마지막 수정');
    await expect(page.locator('footer')).toContainText('system');
  });

  test('T017 상단바의 위키 이름은 대문으로 간다', async ({ page }) => {
    await page.goto(wikiPath('대문'));
    await page.getByRole('link', { name: '개발 위키' }).click();
    await expect(page).toHaveURL(wikiPath('대문'));
  });

  for (const base of ['C/C++', 'C#', '100%', '서울 특별시', 'Node.js', 'URL %20 인코딩']) {
    test(`T019 특수한 제목도 열린다: ${base} (AC-1.2, AC-3.10)`, async ({ page }, info) => {
      const title = uniqueTitle(base, info.project.name);
      await createPage(page, title, `${base} 문서 본문`);
      await expect(page).toHaveURL(wikiPath(title));
      await expect(page.locator('.wiki-content')).toContainText(`${base} 문서 본문`);
      await expect(page).toHaveTitle(`${title} - 개발 위키`);

      // 주소로 바로 들어와도 열린다
      await page.goto(wikiPath(title));
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    });
  }

  test('T020 없는 문서: 404와 새로 만들기 버튼 (AC-1.3)', async ({ page }, info) => {
    const title = uniqueTitle('없는 C++ 문서', info.project.name);
    const res = await page.goto(wikiPath(title));
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    await expect(page.getByText('문서가 없습니다.')).toBeVisible();
    await page.getByRole('link', { name: '새로 만들기' }).click();
    await expect(page).toHaveURL(wikiPath(title, '/edit'));
  });

  test('T020 쓸 수 없는 제목은 안내만 보인다', async ({ page }) => {
    const res = await page.goto('/w/a%7Cb');
    expect(res?.status()).toBe(404);
    await expect(page.getByRole('heading', { name: '쓸 수 없는 제목입니다' })).toBeVisible();
    await expect(page.getByRole('link', { name: '새로 만들기' })).toHaveCount(0);
  });
});

test.describe('문단 접기 (T023, SX-18)', () => {
  const content = '# 첫 문단\n첫 본문\n## 하위 문단\n하위 본문\n# 둘째 문단\n둘째 본문';

  test('제목을 누르면 다음 같은 단계 제목 전까지 접히고, 다시 누르면 펼쳐진다', async ({ page }, info) => {
    await createPage(page, uniqueTitle('접기', info.project.name), content);
    const first = page.getByRole('heading', { name: '1. 첫 문단' });

    await first.click();
    await expect(page.getByText('첫 본문')).toBeHidden();
    await expect(page.getByText('하위 본문')).toBeHidden();
    await expect(page.getByRole('heading', { name: '1.1. 하위 문단' })).toBeHidden();
    await expect(page.getByText('둘째 본문')).toBeVisible();
    await expect(first).toHaveAttribute('aria-expanded', 'false');

    await first.click();
    await expect(page.getByText('첫 본문')).toBeVisible();
    await expect(page.getByText('하위 본문')).toBeVisible();
  });

  test('하위 문단을 접은 채 상위를 접었다 펴도 하위는 접힌 채로 남는다', async ({ page }, info) => {
    await createPage(page, uniqueTitle('접기 중첩', info.project.name), content);
    await page.getByRole('heading', { name: '1.1. 하위 문단' }).click();
    await page.getByRole('heading', { name: '1. 첫 문단' }).click();
    await page.getByRole('heading', { name: '1. 첫 문단' }).click();
    await expect(page.getByText('첫 본문')).toBeVisible();
    await expect(page.getByText('하위 본문')).toBeHidden();
  });

  test('번호를 누르면 접히지 않고 목차로 간다', async ({ page }, info) => {
    await createPage(page, uniqueTitle('번호 링크', info.project.name), content);
    await page.getByRole('heading', { name: '1. 첫 문단' }).getByRole('link', { name: '1.' }).click();
    await expect(page).toHaveURL(/#toc$/);
    await expect(page.getByText('첫 본문')).toBeVisible();
  });

  test('접힌 문단도 목차에서 누르면 펼쳐지며 이동한다', async ({ page }, info) => {
    await createPage(page, uniqueTitle('목차 이동', info.project.name), content);
    await page.getByRole('heading', { name: '1. 첫 문단' }).click();
    await expect(page.getByText('하위 본문')).toBeHidden();
    await page.getByRole('navigation', { name: '목차' }).getByRole('link', { name: '1.1.' }).click();
    await expect(page).toHaveURL(/#s-1\.1$/);
    await expect(page.getByText('하위 본문')).toBeVisible();
  });

  test('Enter 키로도 접을 수 있다', async ({ page }, info) => {
    await createPage(page, uniqueTitle('키보드 접기', info.project.name), content);
    await page.getByRole('heading', { name: '2. 둘째 문단' }).focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('둘째 본문')).toBeHidden();
  });
});
