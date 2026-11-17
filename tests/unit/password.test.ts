import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, verifyPasswordOfMissingUser } from '@/server/services/password';

describe('비밀번호 해시 (T029)', () => {
  it('argon2id로 해시하고, 원문은 해시에 들어 있지 않다', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('correct horse battery');
  });

  it('같은 비밀번호도 해시가 매번 다르다 (솔트)', async () => {
    const [a, b] = await Promise.all([
      hashPassword('같은 비밀번호입니다'),
      hashPassword('같은 비밀번호입니다'),
    ]);
    expect(a).not.toBe(b);
  });

  it('맞는 비밀번호는 통과하고 틀린 비밀번호는 거부한다', async () => {
    const hash = await hashPassword('비밀번호-1234567');
    expect(await verifyPassword(hash, '비밀번호-1234567')).toBe(true);
    expect(await verifyPassword(hash, '비밀번호-1234568')).toBe(false);
    expect(await verifyPassword(hash, '')).toBe(false);
  });

  it("로그인할 수 없는 계정의 해시('!')나 깨진 해시는 어떤 비밀번호로도 통과하지 않는다", async () => {
    for (const hash of ['!', '', 'not-a-hash', '$argon2id$broken']) {
      expect(await verifyPassword(hash, '!')).toBe(false);
      expect(await verifyPassword(hash, '')).toBe(false);
      expect(await verifyPassword(hash, 'anything at all')).toBe(false);
    }
  });

  it('없는 아이디용 검증은 항상 실패한다 (응답 시간을 맞추기 위한 것)', async () => {
    expect(await verifyPasswordOfMissingUser('아무 비밀번호나')).toBe(false);
  });
});
