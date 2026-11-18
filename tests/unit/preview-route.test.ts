import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { MAX_CONTENT_BYTES } from '@/server/services/pages';
import { jar } from '../helpers/request-context';

// 권한 확인은 edit-permission.test.ts에서 따로 본다. 여기서는 관리자로 로그인한 상태에서 미리보기 동작만 본다.
vi.mock('next/headers', () => import('../helpers/request-context'));

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-preview-'));
process.env.DATA_DIR = dataDir;

const { POST } = await import('@/app/api/preview/route');
const { getDb } = await import('@/server/db');
const { initDatabase } = await import('@/server/db/seed');
const { createUser } = await import('@/server/services/users');
const { login } = await import('@/server/services/auth');
const { SESSION_COOKIE } = await import('@/server/current-user');

initDatabase(getDb());
await createUser(getDb(), { username: 'owner', password: 'long-enough-1', role: 'admin' });
const session = await login(getDb(), { username: 'owner', password: 'long-enough-1' });
if (!session.ok) throw new Error('로그인 실패');
jar.set(SESSION_COOKIE, session.token);

afterAll(() => {
  getDb().$client.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

const ORIGIN = 'http://127.0.0.1:3000';

function request(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}/api/preview`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, host: '127.0.0.1:3000', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('미리보기 API (T022, AC-2.2)', () => {
  it('원문을 렌더링한 HTML과 목차를 돌려준다', async () => {
    const res = await POST(request({ content: '# 가\n# 나\n\n**굵게**' }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.html).toContain('<strong>굵게</strong>');
    expect(data.toc).toHaveLength(2);
  });

  it('렌더링 결과도 정화되어 있다', async () => {
    const data = await (await POST(request({ content: '<script>x</script>' }))).json();
    expect(data.html).not.toContain('<script');
  });

  it('다른 사이트(Origin)에서 온 요청은 거부한다', async () => {
    const res = await POST(request({ content: 'x' }, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
  });

  it('Origin이 없는 요청은 거부한다', async () => {
    const req = new Request(`${ORIGIN}/api/preview`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', host: '127.0.0.1:3000' },
      body: JSON.stringify({ content: 'x' }),
    });
    expect((await POST(req)).status).toBe(403);
  });

  it('너무 큰 내용은 거부한다', async () => {
    const res = await POST(request({ content: 'a'.repeat(MAX_CONTENT_BYTES + 1) }));
    expect(res.status).toBe(413);
  });

  it('형식이 틀린 요청은 400', async () => {
    expect((await POST(request('{not json'))).status).toBe(400);
    expect((await POST(request({ text: 'x' }))).status).toBe(400);
  });
});
