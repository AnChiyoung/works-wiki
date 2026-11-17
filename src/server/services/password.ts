import { type Options, hash, verify } from '@node-rs/argon2';

// 비밀번호 해시 (원칙 5, plan.md §7). 원문은 어디에도 저장·기록하지 않는다.
// 비용 값은 OWASP 권장(argon2id, 메모리 19MiB, 반복 2회)을 따른다.
const OPTIONS: Options = {
  // Algorithm.Argon2id (패키지의 const enum은 isolatedModules에서 가져올 수 없어 값을 직접 쓴다)
  algorithm: 2,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(password: string): Promise<string> {
  return hash(password, OPTIONS);
}

/** 해시가 '!'(로그인 불가 계정)이거나 깨져 있으면 오류 대신 false를 돌려준다. */
export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  if (!passwordHash.startsWith('$argon2')) return false;
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

/**
 * 없는 아이디로 로그인할 때도 해시 검증을 한 번 수행한다.
 * 응답 시간 차이로 아이디가 있는지 알아낼 수 없게 하려는 것. 항상 false.
 */
export async function verifyPasswordOfMissingUser(password: string): Promise<boolean> {
  dummyHash ??= hashPassword('missing-user-dummy-password');
  await verifyPassword(await dummyHash, password);
  return false;
}
