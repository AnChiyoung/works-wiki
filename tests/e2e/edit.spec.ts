import { expect, test } from '@playwright/test';
import { createPage, uniqueTitle, wikiPath } from './helpers';

test.describe('편집 (T021, T022)', () => {
  test('새 문서를 만들고, 편집 요약과 함께 저장한다 (AC-2.3, AC-2.4)', async ({ page }, info) => {
    const title = uniqueTitle('새 문서', info.project.name);
    await page.goto(wikiPath(title, '/edit'));
    await expect(page.getByText('새 문서', { exact: true })).toBeVisible();
    await page.getByLabel('문서 내용').fill('# 개요\n**새 문서** 본문');
    await page.getByLabel('편집 요약').fill('처음 작성');
    await page.getByRole('button', { name: '저장' }).click();

    await expect(page).toHaveURL(wikiPath(title));
    await expect(page.locator('.wiki-content strong')).toHaveText('새 문서');
    await expect(page.getByRole('heading', { name: '1. 개요' })).toBeVisible();
  });

  test('기존 문서의 편집 화면에는 현재 내용이 들어 있고, 고쳐서 저장할 수 있다', async ({ page }, info) => {
    const title = uniqueTitle('고칠 문서', info.project.name);
    await createPage(page, title, '처음 내용');
    await page.getByRole('link', { name: '편집' }).click();
    await expect(page.getByLabel('문서 내용')).toHaveValue('처음 내용');
    await page.getByLabel('문서 내용').fill('바뀐 내용');
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.locator('.wiki-content')).toHaveText('바뀐 내용');
  });

  test('내용을 바꾸지 않고 저장하면 알림 후 문서로 돌아간다 (AC-2.6)', async ({ page }, info) => {
    const title = uniqueTitle('그대로', info.project.name);
    await createPage(page, title, '그대로 둘 내용');
    await page.goto(wikiPath(title, '/edit'));
    await page.getByRole('button', { name: '저장' }).click();
    await expect(page.getByRole('status')).toHaveText('바뀐 내용이 없어서 저장하지 않았습니다.');
    await expect(page).toHaveURL(
      new RegExp(`${wikiPath(title).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?notice=unchanged$`),
    );
  });

  test('빈 내용은 저장하지 않고 이유를 알려준다 (AC-2.7)', async ({ page }, info) => {
    const title = uniqueTitle('빈 문서', info.project.name);
    await page.goto(wikiPath(title, '/edit'));
    await page.getByLabel('문서 내용').fill('   ');
    await page.getByLabel('편집 요약').fill('지워지면 안 되는 요약');
    await page.getByRole('button', { name: '저장' }).click();
    // Next.js의 경로 안내 영역도 role=alert라서 폼 안으로 범위를 좁힌다
    await expect(page.locator('form').getByRole('alert')).toHaveText('내용이 비어 있습니다.');
    await expect(page).toHaveURL(wikiPath(title, '/edit'));
    // 저장에 실패해도 입력한 내용은 그대로 남는다
    await expect(page.getByLabel('편집 요약')).toHaveValue('지워지면 안 되는 요약');
  });

  test('미리보기 탭에 렌더링 결과가 실제 문서와 같은 모양으로 보인다 (AC-2.2)', async ({ page }, info) => {
    await page.goto(wikiPath(uniqueTitle('미리보기', info.project.name), '/edit'));
    await page.getByLabel('문서 내용').fill('# 가\n# 나\n\n- **목록**');
    await page.getByRole('tab', { name: '미리보기' }).click();
    const preview = page.getByRole('tabpanel', { name: '미리보기' });
    await expect(preview.getByRole('heading', { name: '1. 가' })).toBeVisible();
    await expect(preview.getByRole('navigation', { name: '목차' })).toBeVisible();
    await expect(preview.locator('.wiki-content li strong')).toHaveText('목록');

    // 편집 탭으로 돌아가면 입력한 내용이 그대로 있다
    await page.getByRole('tab', { name: '편집' }).click();
    await expect(page.getByLabel('문서 내용')).toHaveValue('# 가\n# 나\n\n- **목록**');
  });

  test('취소하면 문서로 돌아간다', async ({ page }, info) => {
    const title = uniqueTitle('취소', info.project.name);
    await createPage(page, title, '내용');
    await page.goto(wikiPath(title, '/edit'));
    await page.getByRole('link', { name: '취소' }).click();
    await expect(page).toHaveURL(wikiPath(title));
  });
});
