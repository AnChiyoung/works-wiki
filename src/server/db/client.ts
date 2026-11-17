import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

// 이 파일은 'server-only'를 넣지 않는다. 명령어 스크립트(db:migrate 등)와 테스트에서도 그대로 쓰기 때문.
// 브라우저 번들 차단은 앱이 쓰는 입구인 ./index.ts가 맡는다.

export type Db = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

const MIGRATIONS_FOLDER = path.resolve(process.cwd(), 'src/server/db/migrations');

/** SQLite 파일(또는 ':memory:')을 열고 기본 설정을 적용한다. */
export function openDatabase(filename: string): Db {
  const sqlite = new Database(filename);
  // WAL: 읽기와 쓰기가 서로를 덜 막는다. 파일 DB에서만 의미가 있다.
  if (filename !== ':memory:') sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('busy_timeout = 5000');
  return drizzle({ client: sqlite, schema });
}

/** 아직 적용하지 않은 마이그레이션을 순서대로 적용한다. 여러 번 실행해도 안전하다. */
export function migrateDatabase(db: Db): void {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
