import { eq } from 'drizzle-orm';
import { type Db, openDatabase } from '@/server/db/client';
import { users } from '@/server/db/schema';
import { SYSTEM_USERNAME, initDatabase } from '@/server/db/seed';

export type TestDb = {
  db: Db;
  /** 기본 데이터로 만들어진 system 사용자 id */
  systemUserId: number;
};

/**
 * 테스트 하나만 쓰는 메모리 DB를 만든다. 마이그레이션과 기본 데이터(system 사용자, 대문)가 적용되어 있다.
 * 테스트마다 새로 만들면 서로의 데이터를 볼 수 없다.
 */
export function createTestDb(): TestDb {
  const db = openDatabase(':memory:');
  initDatabase(db);
  const system = db.select({ id: users.id }).from(users).where(eq(users.username, SYSTEM_USERNAME)).get();
  if (!system) throw new Error('system 사용자가 없습니다');
  return { db, systemUserId: system.id };
}
