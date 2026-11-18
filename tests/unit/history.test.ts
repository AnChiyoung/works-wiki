import { describe, expect, it } from 'vitest';
import { listRevisions } from '@/server/services/history';
import { savePage } from '@/server/services/pages';
import { createUser } from '@/server/services/users';
import { createTestDb } from '../helpers/db';

describe('이력 목록 (T038, AC-4.1)', () => {
  it('판 번호·편집자·요약·크기·증감·종류를 최신순으로 돌려준다', async () => {
    const { db, systemUserId } = createTestDb();
    const kim = await createUser(db, { username: 'kim', password: 'long-enough-1', role: 'admin' });
    savePage(db, { fullTitle: '문서', content: 'abcdef', summary: '처음', authorId: systemUserId });
    savePage(db, { fullTitle: '문서', content: 'abc', summary: '줄임', authorId: kim.id });
    savePage(db, { fullTitle: '문서', content: '가나다', authorId: kim.id });

    const result = listRevisions(db, '문서');
    expect(result?.page.fullTitle).toBe('문서');
    expect(result?.items.map((r) => r.revNo)).toEqual([3, 2, 1]);
    expect(result?.items[0]).toMatchObject({
      authorName: 'kim',
      summary: '',
      size: 9,
      sizeDelta: 6,
      kind: 'edit',
    });
    expect(result?.items[1]).toMatchObject({ authorName: 'kim', summary: '줄임', size: 3, sizeDelta: -3 });
    expect(result?.items[2]).toMatchObject({ authorName: 'system', size: 6, sizeDelta: 6, kind: 'create' });
    expect(result?.items[0]?.createdAt).toBeInstanceOf(Date);
    expect(result?.nextBefore).toBeNull();
  });

  it('원문은 목록에 넣지 않는다 (이력이 길어져도 가볍게)', () => {
    const { db, systemUserId } = createTestDb();
    savePage(db, { fullTitle: '문서', content: '내용', authorId: systemUserId });
    expect(listRevisions(db, '문서')?.items[0]).not.toHaveProperty('content');
  });

  it('한 번에 정해진 개수만 주고, 다음 쪽을 이어서 읽을 수 있다', () => {
    const { db, systemUserId } = createTestDb();
    for (let i = 1; i <= 7; i += 1)
      savePage(db, { fullTitle: '긴 문서', content: `판 ${i}`, authorId: systemUserId });

    const first = listRevisions(db, '긴 문서', { limit: 3 });
    expect(first?.items.map((r) => r.revNo)).toEqual([7, 6, 5]);
    expect(first?.nextBefore).toBe(5);

    const second = listRevisions(db, '긴 문서', { limit: 3, before: first!.nextBefore! });
    expect(second?.items.map((r) => r.revNo)).toEqual([4, 3, 2]);

    const last = listRevisions(db, '긴 문서', { limit: 3, before: second!.nextBefore! });
    expect(last?.items.map((r) => r.revNo)).toEqual([1]);
    expect(last?.nextBefore).toBeNull();
  });

  it('기본으로 50개씩 준다', () => {
    const { db, systemUserId } = createTestDb();
    for (let i = 1; i <= 51; i += 1)
      savePage(db, { fullTitle: '아주 긴 문서', content: `판 ${i}`, authorId: systemUserId });
    const result = listRevisions(db, '아주 긴 문서');
    expect(result?.items).toHaveLength(50);
    expect(result?.nextBefore).toBe(2);
  });

  it('다른 문서의 판은 섞이지 않는다', () => {
    const { db, systemUserId } = createTestDb();
    savePage(db, { fullTitle: '가', content: '가 내용', authorId: systemUserId });
    savePage(db, { fullTitle: '나', content: '나 내용', authorId: systemUserId });
    expect(listRevisions(db, '가')?.items).toHaveLength(1);
  });

  it('없는 문서면 null', () => {
    const { db } = createTestDb();
    expect(listRevisions(db, '없는 문서')).toBeNull();
  });
});
