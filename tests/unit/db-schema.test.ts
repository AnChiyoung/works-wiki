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

describe('스키마 (T008, T028)', () => {
  it('빈 DB에 테이블을 만든다', () => {
    const db = openDatabase(':memory:');
    migrateDatabase(db);
    expect(tableNames(db)).toEqual([
      'pages',
      'revisions',
      'sessions',
      'settings',
      'user_permissions',
      'users',
    ]);
  });

  it('두 번 실행해도 오류가 없다', () => {
    const db = openDatabase(':memory:');
    migrateDatabase(db);
    expect(() => migrateDatabase(db)).not.toThrow();
    expect(tableNames(db)).toHaveLength(6);
  });

  it('같은 이름공간에 같은 제목의 문서는 하나만 만들 수 있다', () => {
    const db = openDatabase(':memory:');
    migrateDatabase(db);
    const insert = db.$client.prepare("insert into pages (namespace, title) values ('main', ?)");
    insert.run('대문');
    expect(() => insert.run('대문')).toThrow(/UNIQUE/);
  });
});

describe('세션·회원 권한 테이블 (T028)', () => {
  function setup() {
    const db = openDatabase(':memory:');
    migrateDatabase(db);
    const addUser = db.$client.prepare(
      "insert into users (username, password_hash, role) values (?, 'x', ?) returning id",
    );
    const admin = (addUser.get('admin', 'admin') as { id: number }).id;
    const member = (addUser.get('member', 'member') as { id: number }).id;
    return { sql: db.$client, admin, member };
  }

  it('세션은 있는 사용자에게만 만들 수 있다', () => {
    const { sql, admin } = setup();
    const insert = sql.prepare('insert into sessions (id, user_id, expires_at) values (?, ?, ?)');
    insert.run('hash-1', admin, Date.now() + 1000);
    expect(() => insert.run('hash-2', 9999, Date.now())).toThrow(/FOREIGN KEY/);
    expect(() => insert.run('hash-1', admin, Date.now())).toThrow(/UNIQUE|PRIMARY/);
  });

  it('사용자를 지우면 그 사용자의 세션과 권한도 지워진다', () => {
    const { sql, admin, member } = setup();
    sql.prepare('insert into sessions (id, user_id, expires_at) values (?, ?, ?)').run('h', member, 1);
    sql
      .prepare("insert into user_permissions (user_id, permission, granted_by) values (?, 'edit', ?)")
      .run(member, admin);
    sql.prepare('delete from users where id = ?').run(member);
    expect(sql.prepare('select count(*) from sessions').pluck().get()).toBe(0);
    expect(sql.prepare('select count(*) from user_permissions').pluck().get()).toBe(0);
  });

  it('회원마다 같은 권한은 한 번만 줄 수 있고, 정해진 권한만 쓸 수 있다', () => {
    const { sql, admin, member } = setup();
    const grant = sql.prepare(
      'insert into user_permissions (user_id, permission, granted_by) values (?, ?, ?)',
    );
    grant.run(member, 'edit', admin);
    grant.run(member, 'create', admin);
    expect(() => grant.run(member, 'edit', admin)).toThrow(/UNIQUE|PRIMARY/);
    expect(() => grant.run(member, 'delete', admin)).toThrow(/CHECK/);
    expect(() => grant.run(member, 'move', 9999)).toThrow(/FOREIGN KEY/);
  });

  it('권한을 준 시각이 자동으로 기록된다', () => {
    const { sql, admin, member } = setup();
    sql
      .prepare("insert into user_permissions (user_id, permission, granted_by) values (?, 'upload', ?)")
      .run(member, admin);
    const grantedAt = sql.prepare('select granted_at from user_permissions').pluck().get() as number;
    expect(Math.abs(grantedAt - Date.now())).toBeLessThan(5000);
  });
});
