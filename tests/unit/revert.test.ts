import { describe, expect, it } from 'vitest';
import { listRevisions } from '@/server/services/history';
import { getPage, savePage } from '@/server/services/pages';
import { RevertError, revertPage } from '@/server/services/revert';
import { createTestDb } from '../helpers/db';

function threeRevisions() {
  const t = createTestDb();
  const authorId = t.systemUserId;
  savePage(t.db, { fullTitle: '문서', content: '첫 판', authorId });
  savePage(t.db, { fullTitle: '문서', content: '둘째 판 (조금 더 길게)', authorId });
  savePage(t.db, { fullTitle: '문서', content: '셋째 판', authorId });
  return t;
}

describe('되돌리기 서비스 (T044, AC-4.4)', () => {
  it('과거 판의 내용으로 새 판을 만들고, 종류는 revert, 요약은 "N판으로 되돌림"', () => {
    const { db, systemUserId } = threeRevisions();
    const result = revertPage(db, { fullTitle: '문서', toRevNo: 1, authorId: systemUserId });
    expect(result).toMatchObject({ changed: true, revNo: 4, fullTitle: '문서' });

    const latest = getPage(db, '문서')!.revision!;
    expect(latest.content).toBe('첫 판');
    expect(latest.kind).toBe('revert');
    expect(latest.summary).toBe('1판으로 되돌림');
    // 이전 판들은 그대로 남는다 (원칙 3)
    expect(listRevisions(db, '문서')!.items.map((r) => r.revNo)).toEqual([4, 3, 2, 1]);
  });

  it('바이트 증감은 바로 앞(최신) 판 기준으로 계산한다', () => {
    const { db, systemUserId } = threeRevisions();
    revertPage(db, { fullTitle: '문서', toRevNo: 2, authorId: systemUserId });
    const [newest, previous] = listRevisions(db, '문서')!.items;
    expect(newest!.sizeDelta).toBe(newest!.size - previous!.size);
  });

  it('사용자가 적은 요약은 뒤에 붙인다', () => {
    const { db, systemUserId } = threeRevisions();
    revertPage(db, { fullTitle: '문서', toRevNo: 2, authorId: systemUserId, summary: '  잘못된 편집 취소 ' });
    expect(getPage(db, '문서')!.revision!.summary).toBe('2판으로 되돌림: 잘못된 편집 취소');
  });

  it('요약이 길어도 200자를 넘지 않는다', () => {
    const { db, systemUserId } = threeRevisions();
    revertPage(db, { fullTitle: '문서', toRevNo: 1, authorId: systemUserId, summary: '가'.repeat(300) });
    expect([...getPage(db, '문서')!.revision!.summary].length).toBe(200);
  });

  it('최신 판과 내용이 같으면 새 판을 만들지 않는다', () => {
    const { db, systemUserId } = threeRevisions();
    expect(revertPage(db, { fullTitle: '문서', toRevNo: 3, authorId: systemUserId })).toMatchObject({
      changed: false,
      revNo: 3,
    });
    expect(listRevisions(db, '문서')!.items).toHaveLength(3);
  });

  it('없는 문서·없는 판이면 RevertError', () => {
    const { db, systemUserId } = threeRevisions();
    expect(() => revertPage(db, { fullTitle: '없는 문서', toRevNo: 1, authorId: systemUserId })).toThrow(
      RevertError,
    );
    expect(() => revertPage(db, { fullTitle: '문서', toRevNo: 9, authorId: systemUserId })).toThrow(
      RevertError,
    );
    expect(listRevisions(db, '문서')!.items).toHaveLength(3);
  });
});
