import { type Page, expect, test } from '@playwright/test';
import { E2E_ADMIN } from './accounts';
import { createPage, expectNoHorizontalScroll, uniqueTitle, wikiPath } from './helpers';

/** 문서 화면의 편집 버튼으로 들어가 내용을 바꾸고 저장한다 */
async function editViaButton(page: Page, content: string, summary: string) {
  await page.getByRole('link', { name: '편집', exact: true }).click();
  await page.getByLabel('문서 내용').fill(content);
  await page.getByLabel('편집 요약').fill(summary);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.locator('.wiki-content')).toContainText(content.split('\n').at(-1)!);
}

/** 차이 표에서 한 종류(added/removed) 줄의 글자만 */
function diffLines(page: Page, type: 'added' | 'removed') {
  return page.getByRole('table', { name: '차이' }).locator(`[data-type="${type}"] > :last-child`);
}

const V1 = '# 설치\nnpm install\n# 실행\nnpm start';
const V2 = '# 설치\nnpm ci\n# 실행\nnpm start';
const V3 = '# 설치\nnpm ci\n# 실행\nnpm run dev\n# 배포\n준비 중';

test.describe('M3 전체 흐름 (T047)', () => {
  test.beforeEach(async ({ page }, info) => {
    // 휴대폰 프로젝트는 스펙의 기준 너비(375px)로 맞춘다
    if (info.project.name === 'mobile') await page.setViewportSize({ width: 375, height: 812 });
  });

  test('만들기 → 두 번 고치기 → 이력 → 두 판 비교 → 과거 판 보기 → 되돌리기 → 이력에 되돌림 판', async ({
    page,
  }, info) => {
    // 1. 문서를 만들고 화면의 편집 버튼으로 두 번 고친다
    const title = uniqueTitle('설치 안내', info.project.name);
    await createPage(page, title, V1, '처음 작성');
    await editViaButton(page, V2, 'npm ci로 변경');
    await editViaButton(page, V3, '배포 절 추가');

    // 2. 이력: 최신순 3개 판, 요약과 편집자
    await page.getByRole('link', { name: '이력', exact: true }).click();
    await expect(page).toHaveURL(wikiPath(title, '/history'));
    const rows = page.locator('tbody tr');
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(0)).toContainText('3판');
    await expect(rows.nth(0)).toContainText('배포 절 추가');
    await expect(rows.nth(2)).toContainText('새 문서');
    await expect(rows.nth(2)).toContainText('처음 작성');
    await expect(rows.nth(0)).toContainText(E2E_ADMIN.username);
    await expectNoHorizontalScroll(page);

    // 3. 1판과 3판을 골라 비교
    await page.getByLabel('1판을 비교 기준(이전)으로').check();
    await page.getByLabel('3판을 비교 대상(이후)으로').check();
    await page.getByRole('button', { name: '고른 두 판 비교' }).click();
    await expect(page).toHaveURL(/\/diff\//);
    const url = new URL(page.url());
    expect(url.searchParams.get('from')).toBe('1');
    expect(url.searchParams.get('to')).toBe('3');
    await expect(diffLines(page, 'removed')).toHaveText(['npm install', 'npm start']);
    await expect(diffLines(page, 'added')).toHaveText(['npm ci', 'npm run dev', '# 배포', '준비 중']);
    await expect(page.getByText('+4줄')).toBeVisible();
    await expect(page.getByText('−2줄')).toBeVisible();
    await expectNoHorizontalScroll(page);

    // 4. 차이 화면의 "1판" 링크로 과거 판 보기
    await page.getByRole('link', { name: '1판', exact: true }).click();
    await expect(page).toHaveURL(`${wikiPath(title)}?rev=1`);
    await expect(page.getByRole('note')).toContainText('최신 판이 아닙니다');
    await expect(page.locator('.wiki-content')).toContainText('npm install');
    await expect(page.getByRole('link', { name: '편집', exact: true })).toHaveCount(0);
    await expectNoHorizontalScroll(page);

    // 5. 되돌리기
    await page.getByLabel('되돌리는 이유').fill('처음 방식으로');
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: '이 판으로 되돌리기' }).click();
    await expect(page).toHaveURL(`${wikiPath(title)}?notice=reverted-1`);
    await expect(page.getByRole('status')).toHaveText('1판의 내용으로 되돌렸습니다.');
    await expect(page.locator('.wiki-content')).toContainText('npm install');
    await expect(page.locator('.wiki-content')).not.toContainText('배포');
    await expect(page.getByRole('link', { name: '편집', exact: true })).toBeVisible();

    // 6. 이력에 4판(되돌림)이 생기고, 이전 판은 모두 남아 있다
    await page.getByRole('link', { name: '이력', exact: true }).click();
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toContainText('4판');
    await expect(rows.nth(0)).toContainText('되돌림');
    await expect(rows.nth(0)).toContainText('1판으로 되돌림: 처음 방식으로');

    // 7. 4판에서 바뀐 내용 = 3판 → 1판으로 돌아간 차이
    await page.getByRole('link', { name: '4판에서 바뀐 내용' }).click();
    await expect(diffLines(page, 'added')).toHaveText(['npm install', 'npm start']);

    // 8. 원문도 되돌린 내용과 같다
    const raw = await page.request.get(wikiPath(title, '/raw'));
    expect(await raw.text()).toBe(V1);
  });
});
