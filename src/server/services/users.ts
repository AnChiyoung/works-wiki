import { eq } from 'drizzle-orm';
import type { DbOrTx } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { SYSTEM_USERNAME } from '@/server/db/seed';

/** 내장 system 사용자 id. M1의 로그인 없는 편집은 이 사용자로 기록한다. */
export function getSystemUserId(db: DbOrTx): number {
  const row = db.select({ id: users.id }).from(users).where(eq(users.username, SYSTEM_USERNAME)).get();
  if (!row) throw new Error('system 사용자가 없습니다. DB 기본 데이터를 확인하세요.');
  return row.id;
}
