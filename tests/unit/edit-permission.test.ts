import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { userPermissions, users } from '@/server/db/schema';
import { jar } from '../helpers/request-context';

// 저장 액션·미리보기 API가 서버에서 권한을 확인하는지 (T035, AC-2.1)
vi.mock('next/headers', () => import('../helpers/request-context'));

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-permission-'));
process.env.DATA_DIR = dataDir;

const { getDb } = await import('@/server/db');
const { initDatabase } = await import('@/server/db/seed');
const { getPage } = await import('@/server/services/pages');
const { login } = await import('@/server/services/auth');
const { createUser } = await import('@/server/services/users');
const { SESSION_COOKIE } = await import('@/server/current-user');
const { savePageAction } = await import('@/app/edit/[...title]/actions');
const { POST: previewPOST } = await import('@/app/api/preview/route');

const db = getDb();
initDatabase(db);
const PASSWORD = 'long-enough-1';
const admin = await createUser(db, { username: 'owner', password: PASSWORD, role: 'admin' });
const member = await createUser(db, { username: 'kim', password: PASSWORD, role: 'member' });

afterAll(() => {
  db.$client.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(() => {
  jar.clear();
  db.delete(userPermissions).run();
  db.update(users).set({ status: 'active' }).where(eq(users.id, member.id)).run();
});

async function loginAs(username: string) {
  const result = await login(db, { username, password: PASSWORD });
  if (!result.ok) throw new Error('로그인 실패');
  jar.set(SESSION_COOKIE, result.token);
}

function grant(permission: 'edit' | 'create') {
  db.insert(userPermissions).values({ userId: member.id, permission, grantedBy: admin.id }).run();
}

/** 저장 액션을 부른다. 성공하면 redirect가 예외로 오므로 이동할 주소를 돌려준다. */
async function save(title: string, content: string): Promise<{ error?: string; redirectedTo?: string }> {
  const form = new FormData();
  form.set('title', title);
  form.set('content', content);
  try {
    return await savePageAction({}, form);
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? '';
    if (!digest.startsWith('NEXT_REDIRECT')) throw error;
    return { redirectedTo: digest.split(';')[2] };
  }
}

function preview() {
  return previewPOST(
    new Request('http://127.0.0.1:3000/api/preview', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://127.0.0.1:3000',
        host: '127.0.0.1:3000',
      },
      body: JSON.stringify({ content: '# 제목' }),
    }),
  );
}

const DENIED = '편집 권한이 없습니다.';

describe('저장 권한 (T035, AC-2.1)', () => {
  it('로그인하지 않으면 저장 요청을 직접 보내도 거부하고 아무것도 저장하지 않는다', async () => {
    expect(await save('몰래 만든 문서', '내용')).toEqual({ error: DENIED });
    expect(getPage(db, '몰래 만든 문서')).toBeNull();
  });

  it('관리자는 저장할 수 있고, 리비전 작성자는 관리자다', async () => {
    await loginAs('owner');
    expect((await save('관리자 문서', '내용')).redirectedTo).toBe(`/w/${encodeURIComponent('관리자 문서')}`);
    expect(getPage(db, '관리자 문서')?.revision?.authorName).toBe('owner');
  });

  it('권한이 없는 회원은 거부', async () => {
    await loginAs('kim');
    expect(await save('회원 문서', '내용')).toEqual({ error: DENIED });
    expect(getPage(db, '회원 문서')).toBeNull();
  });

  it('create 권한으로 새 문서를 만들 수 있지만, 있는 문서를 고치려면 edit 권한이 필요하다', async () => {
    grant('create');
    await loginAs('kim');
    expect((await save('회원 새 문서', '처음')).redirectedTo).toBeDefined();
    expect(getPage(db, '회원 새 문서')?.revision?.authorName).toBe('kim');
    expect(await save('회원 새 문서', '고침')).toEqual({ error: DENIED });

    grant('edit');
    expect((await save('회원 새 문서', '고침')).redirectedTo).toBeDefined();
    expect(getPage(db, '회원 새 문서')?.revision?.content).toBe('고침');
  });

  it('권한이 있어도 차단되면 바로 거부된다', async () => {
    grant('create');
    await loginAs('kim');
    db.update(users).set({ status: 'blocked' }).where(eq(users.id, member.id)).run();
    expect(await save('차단 후 문서', '내용')).toEqual({ error: DENIED });
  });
});

describe('미리보기 권한 (T035)', () => {
  it('로그인하지 않았거나 권한이 없으면 403', async () => {
    expect((await preview()).status).toBe(403);
    await loginAs('kim');
    expect((await preview()).status).toBe(403);
  });

  it('관리자, 그리고 edit·create 권한이 있는 회원은 쓸 수 있다', async () => {
    await loginAs('owner');
    expect((await preview()).status).toBe(200);
    jar.clear();
    grant('edit');
    await loginAs('kim');
    expect((await preview()).status).toBe(200);
  });
});
