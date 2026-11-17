import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { users } from '@/server/db/schema';
import { verifyPassword } from '@/server/services/password';
import { UserError, checkPassword, checkUsername, createUser } from '@/server/services/users';
import { createTestDb } from '../helpers/db';

const PASSWORD = 'long-enough-1';

describe('아이디 규칙 (AC-8.7)', () => {
  it.each(['abc', 'admin', 'dev_kim', 'a-b-c', 'user123', 'a'.repeat(20)])('허용: %s', (name) => {
    expect(() => checkUsername(name)).not.toThrow();
  });

  it.each([
    ['ab', '너무 짧음'],
    ['a'.repeat(21), '너무 긺'],
    ['Admin', '대문자'],
    ['관리자', '한글'],
    ['dev kim', '공백'],
    [' admin', '앞 공백'],
    ['dev.kim', '점'],
    ['', '빈 값'],
  ])('거부: %s (%s)', (name) => {
    expect(() => checkUsername(name)).toThrow(UserError);
  });
});

describe('비밀번호 규칙 (AC-8.7)', () => {
  it('10자 이상이면 허용, 9자 이하는 거부', () => {
    expect(() => checkPassword('a'.repeat(10))).not.toThrow();
    expect(() => checkPassword('a'.repeat(9))).toThrow(UserError);
  });

  it('글자 수는 바이트가 아니라 글자로 센다', () => {
    expect(() => checkPassword('가나다라마바사아자차')).not.toThrow();
    expect(() => checkPassword('😀'.repeat(5))).toThrow(UserError);
  });

  it('지나치게 긴 비밀번호(200자 초과)는 거부한다', () => {
    expect(() => checkPassword('a'.repeat(200))).not.toThrow();
    expect(() => checkPassword('a'.repeat(201))).toThrow(UserError);
  });
});

describe('회원 만들기 (T030, AC-8.1)', () => {
  it('관리자를 만들면 활성 상태이고, 비밀번호는 해시로만 저장된다', async () => {
    const { db } = createTestDb();
    const created = await createUser(db, { username: 'owner', password: PASSWORD, role: 'admin' });
    const row = db.select().from(users).where(eq(users.id, created.id)).get();
    expect(row).toMatchObject({ username: 'owner', role: 'admin', status: 'active' });
    expect(row?.passwordHash).not.toContain(PASSWORD);
    expect(await verifyPassword(row!.passwordHash, PASSWORD)).toBe(true);
  });

  it('관리자가 이미 있어도 관리자를 더 만들 수 있다', async () => {
    const { db } = createTestDb();
    await createUser(db, { username: 'owner', password: PASSWORD, role: 'admin' });
    await expect(
      createUser(db, { username: 'second', password: PASSWORD, role: 'admin' }),
    ).resolves.toBeTruthy();
  });

  it('같은 아이디는 만들 수 없다 (system 포함)', async () => {
    const { db } = createTestDb();
    await createUser(db, { username: 'owner', password: PASSWORD, role: 'admin' });
    for (const username of ['owner', 'system']) {
      const error = await createUser(db, { username, password: PASSWORD, role: 'admin' }).catch((e) => e);
      expect(error).toBeInstanceOf(UserError);
      expect((error as UserError).code).toBe('duplicate');
    }
  });

  it('규칙에 맞지 않는 아이디·비밀번호는 저장하지 않는다', async () => {
    const { db } = createTestDb();
    const before = db.select().from(users).all().length;
    await expect(createUser(db, { username: 'X', password: PASSWORD, role: 'admin' })).rejects.toThrow(
      UserError,
    );
    await expect(createUser(db, { username: 'owner', password: 'short', role: 'admin' })).rejects.toThrow(
      UserError,
    );
    expect(db.select().from(users).all()).toHaveLength(before);
  });
});
