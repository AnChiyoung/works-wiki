import { eq } from 'drizzle-orm';
import type { DbOrTx } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { SYSTEM_USERNAME } from '@/server/db/seed';
import { hashPassword } from './password';

// 회원 규칙: spec.md AC-8.7
export const USERNAME_PATTERN = /^[a-z0-9_-]{3,20}$/;
export const PASSWORD_MIN_LENGTH = 10;
/** 지나치게 긴 입력으로 해시 계산에 부담을 주지 못하게 하는 상한 */
export const PASSWORD_MAX_LENGTH = 200;

export type UserErrorCode = 'bad_username' | 'bad_password' | 'duplicate';

export class UserError extends Error {
  constructor(
    readonly code: UserErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'UserError';
  }
}

export function checkUsername(username: string): void {
  if (!USERNAME_PATTERN.test(username)) {
    throw new UserError('bad_username', '아이디는 3~20자의 영문 소문자, 숫자, _, - 만 쓸 수 있습니다.');
  }
}

export function checkPassword(password: string): void {
  const length = [...password].length; // 바이트가 아니라 글자 수
  if (length < PASSWORD_MIN_LENGTH) {
    throw new UserError('bad_password', `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`);
  }
  if (length > PASSWORD_MAX_LENGTH) {
    throw new UserError('bad_password', `비밀번호는 ${PASSWORD_MAX_LENGTH}자 이하여야 합니다.`);
  }
}

export type CreateUserInput = {
  username: string;
  password: string;
  role: 'admin' | 'member';
};

/**
 * 회원(관리자 포함)을 만든다. 화면에서 부르지 않는다: 첫 관리자는 `npm run admin:create`로만 만든다(AC-8.1).
 * 회원을 화면에서 만드는 기능(AC-8.6)은 M6+에서 권한 확인을 붙여 쓴다.
 */
export async function createUser(db: DbOrTx, input: CreateUserInput): Promise<{ id: number }> {
  checkUsername(input.username);
  checkPassword(input.password);
  const duplicate = () => new UserError('duplicate', `이미 있는 아이디입니다: ${input.username}`);
  if (db.select({ id: users.id }).from(users).where(eq(users.username, input.username)).get()) {
    throw duplicate();
  }

  const passwordHash = await hashPassword(input.password);
  try {
    return db
      .insert(users)
      .values({ username: input.username, passwordHash, role: input.role, status: 'active' })
      .returning({ id: users.id })
      .get();
  } catch (error) {
    // 해시를 계산하는 사이에 같은 아이디가 만들어진 경우
    if (String(error).includes('UNIQUE')) throw duplicate();
    throw error;
  }
}

/** 내장 system 사용자 id. M1의 로그인 없는 편집은 이 사용자로 기록한다. */
export function getSystemUserId(db: DbOrTx): number {
  const row = db.select({ id: users.id }).from(users).where(eq(users.username, SYSTEM_USERNAME)).get();
  if (!row) throw new Error('system 사용자가 없습니다. DB 기본 데이터를 확인하세요.');
  return row.id;
}
