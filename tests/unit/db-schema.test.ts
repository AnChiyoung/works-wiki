import { describe, expect, it } from 'vitest';
import { migrateDatabase, openDatabase } from '@/server/db/client';

function tableNames(db: ReturnType<typeof openDatabase>): string[] {
  return db.$client
    .prepare(
      "select name from sqlite_master where type = 'table' and name not like 'sqlite_%' and name not like '__drizzle%' order by name",
    )
    .pluck()
    .all() as string[];
}

describe('M1 스키마 (T008)', () => {
  it('빈 DB에 M1 테이블을 만든다', () => {
    const db = openDatabase(':memory:');
    migrateDatabase(db);
    expect(tableNames(db)).toEqual(['pages', 'revisions', 'settings', 'users']);
  });

  it('두 번 실행해도 오류가 없다', () => {
    const db = openDatabase(':memory:');
    migrateDatabase(db);
    expect(() => migrateDatabase(db)).not.toThrow();
    expect(tableNames(db)).toHaveLength(4);
  });

  it('같은 이름공간에 같은 제목의 문서는 하나만 만들 수 있다', () => {
    const db = openDatabase(':memory:');
    migrateDatabase(db);
    const insert = db.$client.prepare("insert into pages (namespace, title) values ('main', ?)");
    insert.run('대문');
    expect(() => insert.run('대문')).toThrow(/UNIQUE/);
  });
});
