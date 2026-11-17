import { describe, expect, it } from 'vitest';
import { pages } from '@/server/db/schema';
import { createTestDb } from '../helpers/db';

describe('테스트용 DB 도우미 (T010)', () => {
  it('마이그레이션과 기본 데이터가 적용된 DB를 준다', () => {
    const { db, systemUserId } = createTestDb();
    expect(systemUserId).toBeGreaterThan(0);
    expect(
      db
        .select()
        .from(pages)
        .all()
        .map((p) => p.title),
    ).toEqual(['대문']);
  });

  it('두 테스트 DB는 서로의 데이터를 보지 않는다', () => {
    const a = createTestDb();
    const b = createTestDb();
    a.db.insert(pages).values({ namespace: 'main', title: 'A에만 있는 문서' }).run();
    expect(a.db.select().from(pages).all()).toHaveLength(2);
    expect(b.db.select().from(pages).all()).toHaveLength(1);
  });
});
