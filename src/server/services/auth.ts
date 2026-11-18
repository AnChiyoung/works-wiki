import { createHash, randomBytes } from 'node:crypto';
import { eq, lt } from 'drizzle-orm';
import type { DbOrTx } from '@/server/db/client';
import { type User, sessions, users } from '@/server/db/schema';
import { verifyPassword, verifyPasswordOfMissingUser } from './password';

// 로그인·세션: spec.md AC-8.2, plan.md §7
const DAY = 24 * 60 * 60 * 1000;
/** 세션 유효 기간 30일 */
export const SESSION_TTL_MS = 30 * DAY;
/** 남은 기간이 이보다 짧아진 뒤 접속하면 다시 30일로 연장 */
export const SESSION_RENEW_BELOW_MS = 15 * DAY;

/** 화면·권한 판단에 쓰는 로그인 사용자 정보 (비밀번호 해시는 빼고) */
export type SessionUser = Pick<User, 'id' | 'username' | 'role' | 'status'>;

export type LoginResult = { ok: true; token: string; expiresAt: Date; user: SessionUser } | { ok: false };

/** DB에는 토큰 원문 대신 이 해시를 저장한다. DB가 유출돼도 세션을 가로챌 수 없다. */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 대기 회원은 로그인만 되고 권한은 없다(spec.md §2). 차단 회원과 system은 로그인할 수 없다. */
function canLogIn(user: Pick<User, 'role' | 'status'>): boolean {
  return user.role !== 'system' && user.status !== 'blocked';
}

const sessionUserColumns = {
  id: users.id,
  username: users.username,
  role: users.role,
  status: users.status,
};

/**
 * 아이디·비밀번호를 확인하고 새 세션을 만든다.
 * 실패 이유(없는 아이디, 틀린 비밀번호, 차단 회원)는 구분하지 않고 돌려준다(AC-8.2).
 */
export async function login(
  db: DbOrTx,
  input: { username: string; password: string },
  now = Date.now(),
): Promise<LoginResult> {
  const row = db
    .select({ ...sessionUserColumns, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.username, input.username))
    .get();

  if (!row) {
    await verifyPasswordOfMissingUser(input.password);
    return { ok: false };
  }
  const passwordOk = await verifyPassword(row.passwordHash, input.password);
  if (!passwordOk || !canLogIn(row)) return { ok: false };

  // 만료된 세션 정리 (로그인할 때 한 번씩이면 충분하다)
  db.delete(sessions)
    .where(lt(sessions.expiresAt, new Date(now)))
    .run();

  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now + SESSION_TTL_MS);
  db.insert(sessions)
    .values({ id: hashSessionToken(token), userId: row.id, createdAt: new Date(now), expiresAt })
    .run();

  const { passwordHash: _passwordHash, ...user } = row;
  return { ok: true, token, expiresAt, user };
}

/**
 * 세션 토큰으로 로그인 사용자를 찾는다. 없거나 만료됐거나 로그인할 수 없는 회원이면 null.
 * 남은 기간이 15일보다 짧으면 이 요청 시각부터 30일로 연장한다.
 */
export function getSessionUser(db: DbOrTx, token: string | undefined, now = Date.now()): SessionUser | null {
  if (!token) return null;
  const id = hashSessionToken(token);
  const row = db
    .select({ ...sessionUserColumns, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.id, id))
    .get();
  if (!row) return null;

  const remaining = row.expiresAt.getTime() - now;
  if (remaining <= 0) {
    db.delete(sessions).where(eq(sessions.id, id)).run();
    return null;
  }
  if (!canLogIn(row)) return null;

  if (remaining < SESSION_RENEW_BELOW_MS) {
    db.update(sessions)
      .set({ expiresAt: new Date(now + SESSION_TTL_MS) })
      .where(eq(sessions.id, id))
      .run();
  }
  const { expiresAt: _expiresAt, ...user } = row;
  return user;
}

export function logout(db: DbOrTx, token: string | undefined): void {
  if (!token) return;
  db.delete(sessions)
    .where(eq(sessions.id, hashSessionToken(token)))
    .run();
}
