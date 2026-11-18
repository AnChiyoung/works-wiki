import { type Page, expect } from '@playwright/test';

let counter = 0;

/** 테스트끼리 겹치지 않는 제목. 데스크톱·모바일 프로젝트가 같은 DB를 쓰므로 프로젝트 이름도 넣는다. */
export function uniqueTitle(base: string, project: string): string {
  counter += 1;
  return `${base} ${project}-${Date.now().toString(36)}${counter}`;
}

/** 제목 → /w/ 경로 (src/server/services/title.ts의 titleToPath와 같은 규칙) */
export function wikiPath(title: string, base = '/w'): string {
  return `${base}/${title.split('/').map(encodeURIComponent).join('/')}`;
}

/** 편집 화면에서 문서를 만들고 저장한 뒤 문서 보기 화면까지 기다린다. */
export async function createPage(page: Page, title: string, content: string, summary = ''): Promise<void> {
  await page.goto(wikiPath(title, '/edit'));
  await page.getByLabel('문서 내용').fill(content);
  if (summary) await page.getByLabel('편집 요약').fill(summary);
  await page.getByRole('button', { name: '저장' }).click();
  await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
}

/** 가로 스크롤이 생기지 않았는지 (T017: 360px 이상에서 가로 스크롤 없음) */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}
