import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// 원문 보기 (T040, 원칙 7)
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-raw-'));
process.env.DATA_DIR = dataDir;

const { getDb } = await import('@/server/db');
const { initDatabase } = await import('@/server/db/seed');
const { savePage } = await import('@/server/services/pages');
const { users } = await import('@/server/db/schema');
const { GET } = await import('@/app/raw/[...title]/route');

const db = getDb();
initDatabase(db);
const authorId = db.select({ id: users.id }).from(users).get()!.id;
savePage(db, { fullTitle: 'C/C++', content: '# 첫 판\n한글 내용', authorId });
savePage(db, { fullTitle: 'C/C++', content: '# 둘째 판\n<script>alert(1)</script>', authorId });

afterAll(() => {
  db.$client.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

/** Next.js처럼 주소는 인코딩하고, params에는 디코딩된 조각을 넘긴다 */
function get(title: string, query = '') {
  const segments = title.split('/');
  return GET(new Request(`http://127.0.0.1:3000/raw/${segments.map(encodeURIComponent).join('/')}${query}`), {
    params: Promise.resolve({ title: segments }),
  });
}

describe('원문 보기 (T040)', () => {
  it('최신 판 원문을 UTF-8 텍스트로 돌려준다', async () => {
    const res = await get('C/C++');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/plain; charset=utf-8');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(await res.text()).toBe('# 둘째 판\n<script>alert(1)</script>');
  });

  it('?rev=로 지정한 판의 원문, 한글도 깨지지 않는다', async () => {
    const res = await get('C/C++', '?rev=1');
    expect(await res.text()).toBe('# 첫 판\n한글 내용');
    expect(res.headers.get('x-robots-tag')).toBe('noindex');
  });

  it('없는 문서·없는 판·잘못된 판 번호·쓸 수 없는 제목은 404', async () => {
    expect((await get('없는 문서')).status).toBe(404);
    expect((await get('C/C++', '?rev=9')).status).toBe(404);
    expect((await get('C/C++', '?rev=abc')).status).toBe(404);
    expect((await get('a|b')).status).toBe(404);
  });
});
