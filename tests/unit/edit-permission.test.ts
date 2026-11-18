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
type SaveState = Awaited<ReturnType<typeof savePageAction>>;
const { POST: previewPOST } = await import('@/app/api/preview/route');
const { revertAction } = await import('@/app/w/[...title]/actions');

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

/** 편집 화면을 막 연 사람처럼, 지금 최신 판 id를 편집 시작 판으로 쓴다 */
function latestRevId(title: string): number | null {
  return getPage(db, title)?.revision?.id ?? null;
}

function grant(permission: 'edit' | 'create') {
  db.insert(userPermissions).values({ userId: member.id, permission, grantedBy: admin.id }).run();
}

/** 저장 액션을 부른다. 성공하면 redirect가 예외로 오므로 이동할 주소를 돌려준다. */
async function save(
  title: string,
  content: string,
  baseRevId: number | null = latestRevId(title),
): Promise<SaveState & { redirectedTo?: string }> {
  const form = new FormData();
  form.set('title', title);
  form.set('content', content);
  form.set('baseRevId', baseRevId === null ? '' : String(baseRevId));
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

describe('되돌리기 권한 (T045, AC-4.4)', () => {
  async function revert(
    title: string,
    toRevNo: number,
    baseRevId = latestRevId(title),
  ): Promise<{ error?: string; redirectedTo?: string }> {
    const form = new FormData();
    form.set('title', title);
    form.set('toRevNo', String(toRevNo));
    form.set('baseRevId', baseRevId === null ? '' : String(baseRevId));
    try {
      return await revertAction({}, form);
    } catch (error) {
      const digest = (error as { digest?: string }).digest ?? '';
      if (!digest.startsWith('NEXT_REDIRECT')) throw error;
      return { redirectedTo: digest.split(';')[2] };
    }
  }

  async function twoRevisions(title: string) {
    await loginAs('owner');
    await save(title, '첫 판');
    await save(title, '둘째 판');
    jar.clear();
  }

  it('로그인하지 않았거나 edit 권한이 없으면 거부하고 판을 만들지 않는다', async () => {
    await twoRevisions('되돌릴 문서 1');
    expect(await revert('되돌릴 문서 1', 1)).toEqual({ error: '되돌릴 권한이 없습니다.' });
    grant('create');
    await loginAs('kim');
    expect(await revert('되돌릴 문서 1', 1)).toEqual({ error: '되돌릴 권한이 없습니다.' });
    expect(getPage(db, '되돌릴 문서 1')?.revision?.content).toBe('둘째 판');
  });

  it('관리자와 edit 권한 회원은 되돌릴 수 있고, 알림 주소로 이동한다', async () => {
    await twoRevisions('되돌릴 문서 2');
    grant('edit');
    await loginAs('kim');
    expect((await revert('되돌릴 문서 2', 1)).redirectedTo).toBe(
      `/w/${encodeURIComponent('되돌릴 문서 2')}?notice=reverted-1`,
    );
    const latest = getPage(db, '되돌릴 문서 2')?.revision;
    expect(latest).toMatchObject({ content: '첫 판', kind: 'revert', authorName: 'kim' });
  });

  it('없는 판이면 이유를 알려준다', async () => {
    await twoRevisions('되돌릴 문서 3');
    await loginAs('owner');
    expect(await revert('되돌릴 문서 3', 9)).toEqual({ error: '되돌릴 문서나 판이 없습니다.' });
  });
});

describe('저장·되돌리기 충돌 (T046, AC-2.5)', () => {
  it('편집하는 사이에 다른 사람이 저장했으면 덮어쓰지 않고, 최신 판과 내 내용의 차이를 돌려준다', async () => {
    await loginAs('owner');
    await save('충돌 문서', '첫 줄\n둘째 줄');
    const staleId = latestRevId('충돌 문서');
    await save('충돌 문서', '첫 줄\n남이 고친 줄');
    const latest = getPage(db, '충돌 문서')!.revision!;

    const result = await save('충돌 문서', '첫 줄\n내가 고친 줄', staleId);
    expect(result.redirectedTo).toBeUndefined();
    expect(result.error).toContain('다른 사람이 먼저 저장했습니다');
    expect(result.conflict).toMatchObject({
      latestRevId: latest.id,
      revNo: 2,
      authorName: 'owner',
      added: 1,
      removed: 1,
    });
    const changed = result.conflict!.rows.flatMap((row) =>
      row.type === 'added' || row.type === 'removed' ? [[row.type, row.text]] : [],
    );
    expect(changed).toEqual([
      ['removed', '남이 고친 줄'],
      ['added', '내가 고친 줄'],
    ]);
    expect(getPage(db, '충돌 문서')!.revision!.content).toBe('첫 줄\n남이 고친 줄');

    // 돌려받은 최신 판 id로 다시 저장하면 저장된다
    expect(
      (await save('충돌 문서', '첫 줄\n내가 고친 줄', result.conflict!.latestRevId)).redirectedTo,
    ).toBeDefined();
    expect(getPage(db, '충돌 문서')!.revision!.revNo).toBe(3);
  });

  it('새 문서를 만드는 사이에 누가 먼저 만들었어도 충돌', async () => {
    await loginAs('owner');
    await save('동시에 만든 문서', '먼저', null);
    const result = await save('동시에 만든 문서', '나중', null);
    expect(result.conflict).toMatchObject({ revNo: 1 });
    expect(getPage(db, '동시에 만든 문서')!.revision!.content).toBe('먼저');
  });

  it('되돌리는 사이에 다른 사람이 저장했으면 되돌리지 않고 이유를 알려준다', async () => {
    await loginAs('owner');
    await save('되돌리기 충돌', '첫 판');
    await save('되돌리기 충돌', '둘째 판');
    const staleId = latestRevId('되돌리기 충돌');
    await save('되돌리기 충돌', '셋째 판');

    const form = new FormData();
    form.set('title', '되돌리기 충돌');
    form.set('toRevNo', '1');
    form.set('baseRevId', String(staleId));
    const result = await revertAction({}, form);
    expect(result.error).toContain('다른 사람이 먼저 저장했습니다');
    expect(getPage(db, '되돌리기 충돌')!.revision!.content).toBe('셋째 판');
  });
});
