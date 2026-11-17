import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { openDatabase } from '@/server/db/client';
import { pages, revisions, users } from '@/server/db/schema';
import { MAIN_PAGE_TITLE, SYSTEM_USERNAME, initDatabase } from '@/server/db/seed';

function freshDb() {
  const db = openDatabase(':memory:');
  initDatabase(db);
  return db;
}

describe('기본 데이터 (T009)', () => {
  it('로그인할 수 없는 system 사용자를 만든다', () => {
    const db = freshDb();
    const system = db.select().from(users).where(eq(users.username, SYSTEM_USERNAME)).get();
    expect(system).toMatchObject({ role: 'system', passwordHash: '!' });
  });

  it('대문 문서의 1판을 만들고 최신 판으로 연결한다', () => {
    const db = freshDb();
    const page = db.select().from(pages).where(eq(pages.title, MAIN_PAGE_TITLE)).get();
    expect(page).toBeDefined();
    const rev = db.select().from(revisions).where(eq(revisions.pageId, page!.id)).get();
    expect(rev).toMatchObject({ revNo: 1, kind: 'create' });
    expect(page!.latestRevId).toBe(rev!.id);
    expect(rev!.size).toBe(Buffer.byteLength(rev!.content, 'utf8'));
  });

  it('여러 번 실행해도 중복으로 만들지 않는다', () => {
    const db = freshDb();
    initDatabase(db);
    initDatabase(db);
    expect(db.select().from(users).all()).toHaveLength(1);
    expect(db.select().from(pages).all()).toHaveLength(1);
    expect(db.select().from(revisions).all()).toHaveLength(1);
  });
});
