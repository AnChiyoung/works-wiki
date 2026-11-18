import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { sessions, users } from '@/server/db/schema';
import {
  SESSION_RENEW_BELOW_MS,
  SESSION_TTL_MS,
  getSessionUser,
  hashSessionToken,
  login,
  logout,
} from '@/server/services/auth';
import { createUser } from '@/server/services/users';
import { createTestDb } from '../helpers/db';

const PASSWORD = 'long-enough-1';
const DAY = 24 * 60 * 60 * 1000;

async function setup() {
  const t = createTestDb();
  const { id } = await createUser(t.db, { username: 'owner', password: PASSWORD, role: 'admin' });
  return { ...t, adminId: id };
}

describe('로그인 (T031, AC-8.2)', () => {
  it('맞는 아이디·비밀번호면 세션 토큰을 주고, DB에는 토큰의 해시만 저장한다', async () => {
    const { db, adminId } = await setup();
    const now = 1_800_000_000_000;
    const result = await login(db, { username: 'owner', password: PASSWORD }, now);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/); // 32바이트 base64url
    expect(result.user).toMatchObject({ id: adminId, username: 'owner', role: 'admin' });
    expect(result.expiresAt.getTime()).toBe(now + SESSION_TTL_MS);

    const rows = db.select().from(sessions).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(hashSessionToken(result.token));
    expect(rows[0]?.id).not.toBe(result.token);
  });

  it('로그인할 때마다 새 토큰을 준다', async () => {
    const { db } = await setup();
    const a = await login(db, { username: 'owner', password: PASSWORD });
    const b = await login(db, { username: 'owner', password: PASSWORD });
    expect(a.ok && b.ok && a.token !== b.token).toBe(true);
  });

  it('틀린 비밀번호, 없는 아이디는 같은 실패로 돌려준다', async () => {
    const { db } = await setup();
    expect(await login(db, { username: 'owner', password: 'wrong-password' })).toEqual({ ok: false });
    expect(await login(db, { username: 'nobody', password: PASSWORD })).toEqual({ ok: false });
    expect(db.select().from(sessions).all()).toHaveLength(0);
  });

  it('system 사용자로는 로그인할 수 없다 (AC-8.7)', async () => {
    const { db } = await setup();
    expect(await login(db, { username: 'system', password: '!' })).toEqual({ ok: false });
  });

  it('차단 회원은 비밀번호가 맞아도 로그인할 수 없다', async () => {
    const { db } = await setup();
    const { id } = await createUser(db, { username: 'member1', password: PASSWORD, role: 'member' });
    db.update(users).set({ status: 'blocked' }).where(eq(users.id, id)).run();
    expect(await login(db, { username: 'member1', password: PASSWORD })).toEqual({ ok: false });
  });

  it('대기 회원은 로그인은 된다 (권한은 can()이 막는다, spec.md §2)', async () => {
    const { db } = await setup();
    const { id } = await createUser(db, { username: 'member1', password: PASSWORD, role: 'member' });
    db.update(users).set({ status: 'pending' }).where(eq(users.id, id)).run();
    const result = await login(db, { username: 'member1', password: PASSWORD });
    expect(result.ok && result.user.status).toBe('pending');
  });

  it('로그인할 때 만료된 세션을 정리한다', async () => {
    const { db } = await setup();
    const now = 1_800_000_000_000;
    await login(db, { username: 'owner', password: PASSWORD }, now);
    await login(db, { username: 'owner', password: PASSWORD }, now + SESSION_TTL_MS + 1);
    expect(db.select().from(sessions).all()).toHaveLength(1);
  });
});

describe('세션 확인 (T031)', () => {
  async function loggedIn(now: number) {
    const t = await setup();
    const result = await login(t.db, { username: 'owner', password: PASSWORD }, now);
    if (!result.ok) throw new Error('로그인 실패');
    return { ...t, token: result.token };
  }

  it('유효한 토큰이면 사용자를 돌려준다', async () => {
    const now = 1_800_000_000_000;
    const { db, token, adminId } = await loggedIn(now);
    expect(getSessionUser(db, token, now + DAY)).toMatchObject({
      id: adminId,
      username: 'owner',
      role: 'admin',
    });
  });

  it('없는 토큰·빈 토큰은 거부한다', async () => {
    const { db } = await loggedIn(Date.now());
    expect(getSessionUser(db, 'not-a-real-token')).toBeNull();
    expect(getSessionUser(db, '')).toBeNull();
    expect(getSessionUser(db, undefined)).toBeNull();
  });

  it('만료된 세션은 거부하고 지운다', async () => {
    const now = 1_800_000_000_000;
    const { db, token } = await loggedIn(now);
    expect(getSessionUser(db, token, now + SESSION_TTL_MS)).toBeNull();
    expect(db.select().from(sessions).all()).toHaveLength(0);
  });

  it('남은 기간이 15일 아래로 떨어지면 다시 30일로 연장한다 (AC-8.2)', async () => {
    const now = 1_800_000_000_000;
    const { db, token } = await loggedIn(now);
    const expiresAt = () => db.select().from(sessions).get()?.expiresAt.getTime();

    // 아직 절반 넘게 남았으면 그대로
    getSessionUser(db, token, now + SESSION_TTL_MS - SESSION_RENEW_BELOW_MS - 1);
    expect(expiresAt()).toBe(now + SESSION_TTL_MS);

    // 절반 아래로 떨어진 뒤 접속하면 그때부터 30일
    const later = now + 20 * DAY;
    getSessionUser(db, token, later);
    expect(expiresAt()).toBe(later + SESSION_TTL_MS);
  });

  it('로그인한 뒤 차단된 회원의 세션은 거부한다', async () => {
    const now = Date.now();
    const { db, token, adminId } = await loggedIn(now);
    db.update(users).set({ status: 'blocked' }).where(eq(users.id, adminId)).run();
    expect(getSessionUser(db, token, now)).toBeNull();
  });
});

describe('로그아웃 (T031, AC-8.2)', () => {
  it('로그아웃한 세션은 다시 쓸 수 없다', async () => {
    const { db } = await setup();
    const result = await login(db, { username: 'owner', password: PASSWORD });
    if (!result.ok) throw new Error('로그인 실패');
    logout(db, result.token);
    expect(getSessionUser(db, result.token)).toBeNull();
    expect(db.select().from(sessions).all()).toHaveLength(0);
  });

  it('없는 토큰으로 로그아웃해도 오류가 나지 않는다', async () => {
    const { db } = await setup();
    expect(() => logout(db, 'nothing')).not.toThrow();
    expect(() => logout(db, undefined)).not.toThrow();
  });
});
