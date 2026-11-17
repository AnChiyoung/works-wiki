import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

// WIKI_OPEN_EDIT=false일 때 편집 요청을 직접 보내도 거부되는지 (T024)
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-guard-'));
process.env.DATA_DIR = dataDir;
process.env.WIKI_OPEN_EDIT = 'false';

const { getDb } = await import('@/server/db');
const { initDatabase } = await import('@/server/db/seed');
const { getPage } = await import('@/server/services/pages');
const { savePageAction } = await import('@/app/edit/[...title]/actions');
const { POST: previewPOST } = await import('@/app/api/preview/route');

initDatabase(getDb());

afterAll(() => {
  getDb().$client.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('M1 임시 편집 보호 (T024)', () => {
  it('저장 액션을 직접 불러도 거부하고 아무것도 저장하지 않는다', async () => {
    const form = new FormData();
    form.set('title', '몰래 만든 문서');
    form.set('content', '내용');
    const result = await savePageAction({}, form);
    expect(result.error).toBe('편집 권한이 없습니다.');
    expect(getPage(getDb(), '몰래 만든 문서')).toBeNull();
  });

  it('미리보기 API도 403', async () => {
    const res = await previewPOST(
      new Request('http://127.0.0.1:3000/api/preview', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://127.0.0.1:3000',
          host: '127.0.0.1:3000',
        },
        body: JSON.stringify({ content: 'x' }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
