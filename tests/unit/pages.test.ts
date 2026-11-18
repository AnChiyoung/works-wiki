import { describe, expect, it } from 'vitest';
import { pages, revisions } from '@/server/db/schema';
import { ConflictError, ContentError, MAX_CONTENT_BYTES, getPage, savePage } from '@/server/services/pages';
import { createTestDb } from '../helpers/db';

describe('문서 조회 (T012, AC-1.1, AC-1.5)', () => {
  it('있는 문서의 최신 판과 작성자, 수정 시각을 돌려준다', () => {
    const { db } = createTestDb();
    const result = getPage(db, '대문');
    expect(result).not.toBeNull();
    expect(result!.page).toMatchObject({ namespace: 'main', title: '대문', fullTitle: '대문' });
    expect(result!.revision).toMatchObject({ revNo: 1, authorName: 'system' });
    expect(result!.revision!.content).toContain('개발 지식');
    expect(result!.revision!.createdAt).toBeInstanceOf(Date);
  });

  it('제목을 정규화해서 찾는다', () => {
    const { db } = createTestDb();
    expect(getPage(db, '  대문 ')?.page.title).toBe('대문');
  });

  it('없는 문서면 null', () => {
    const { db } = createTestDb();
    expect(getPage(db, '없는 문서')).toBeNull();
  });

  it('특정 판을 조회한다', () => {
    const { db, systemUserId } = createTestDb();
    savePage(db, { fullTitle: '대문', content: '두 번째 판', authorId: systemUserId });
    expect(getPage(db, '대문', { rev: 1 })!.revision!.revNo).toBe(1);
    expect(getPage(db, '대문', { rev: 2 })!.revision!.content).toBe('두 번째 판');
    expect(getPage(db, '대문')!.revision!.revNo).toBe(2);
  });

  it('없는 판 번호면 문서는 주고 판은 null', () => {
    const { db } = createTestDb();
    const result = getPage(db, '대문', { rev: 99 });
    expect(result!.page.title).toBe('대문');
    expect(result!.revision).toBeNull();
  });
});

describe('문서 저장 (T013, AC-2.3, AC-2.4, AC-2.6)', () => {
  it('없는 문서를 저장하면 문서와 1판(create)을 만든다', () => {
    const { db, systemUserId } = createTestDb();
    const result = savePage(db, {
      fullTitle: 'C/C++',
      content: '# 개요\nC 언어 계열',
      summary: '새 문서',
      authorId: systemUserId,
    });
    expect(result.changed).toBe(true);
    const saved = getPage(db, 'C/C++')!;
    expect(saved.revision).toMatchObject({ revNo: 1, kind: 'create', summary: '새 문서' });
    expect(saved.page.id).toBe(result.pageId);
  });

  it('있는 문서를 저장하면 다음 판(edit)을 추가하고 이전 판은 남긴다', () => {
    const { db, systemUserId } = createTestDb();
    const before = getPage(db, '대문')!.revision!;
    savePage(db, { fullTitle: '대문', content: '바뀐 내용', authorId: systemUserId });
    const after = getPage(db, '대문')!.revision!;
    expect(after).toMatchObject({ revNo: 2, kind: 'edit', content: '바뀐 내용', summary: '' });
    expect(getPage(db, '대문', { rev: 1 })!.revision!.content).toBe(before.content);
  });

  it('최신 판과 내용이 같으면 판을 만들지 않는다', () => {
    const { db, systemUserId } = createTestDb();
    const content = getPage(db, '대문')!.revision!.content;
    const result = savePage(db, { fullTitle: '대문', content, authorId: systemUserId });
    expect(result.changed).toBe(false);
    expect(db.select().from(revisions).all()).toHaveLength(1);
  });

  it('줄바꿈 방식(CRLF)만 다른 내용은 같은 내용으로 본다', () => {
    const { db, systemUserId } = createTestDb();
    savePage(db, { fullTitle: '줄바꿈', content: '첫 줄\n둘째 줄', authorId: systemUserId });
    const result = savePage(db, { fullTitle: '줄바꿈', content: '첫 줄\r\n둘째 줄', authorId: systemUserId });
    expect(result.changed).toBe(false);
  });

  it('크기는 UTF-8 바이트로 세고, 이전 판과의 차이를 기록한다', () => {
    const { db, systemUserId } = createTestDb();
    savePage(db, { fullTitle: '크기', content: '가나다', authorId: systemUserId }); // 9바이트
    savePage(db, { fullTitle: '크기', content: 'ab', authorId: systemUserId }); // 2바이트
    const r1 = getPage(db, '크기', { rev: 1 })!.revision!;
    const r2 = getPage(db, '크기', { rev: 2 })!.revision!;
    expect([r1.size, r1.sizeDelta]).toEqual([9, 9]);
    expect([r2.size, r2.sizeDelta]).toEqual([2, -7]);
  });

  it('편집 요약은 앞뒤 공백을 지운다', () => {
    const { db, systemUserId } = createTestDb();
    savePage(db, { fullTitle: '요약', content: '내용', summary: '  오타 수정 ', authorId: systemUserId });
    expect(getPage(db, '요약')!.revision!.summary).toBe('오타 수정');
  });

  it('내용이 비어 있으면 저장하지 않는다', () => {
    const { db, systemUserId } = createTestDb();
    expect(() => savePage(db, { fullTitle: '빈 문서', content: ' \n\t ', authorId: systemUserId })).toThrow(
      ContentError,
    );
  });

  it('내용이 너무 크면 저장하지 않는다', () => {
    const { db, systemUserId } = createTestDb();
    const huge = 'a'.repeat(MAX_CONTENT_BYTES + 1);
    expect(() => savePage(db, { fullTitle: '큰 문서', content: huge, authorId: systemUserId })).toThrow(
      ContentError,
    );
  });

  it('저장 중 오류가 나면 아무것도 남지 않는다', () => {
    const { db } = createTestDb();
    // 없는 사용자 id → 판을 넣을 때 외래 키 오류. 그 전에 만든 문서 행도 되돌려져야 한다.
    expect(() => savePage(db, { fullTitle: '실패할 문서', content: '내용', authorId: 9999 })).toThrow();
    expect(getPage(db, '실패할 문서')).toBeNull();
    expect(db.select().from(pages).all()).toHaveLength(1);
  });
});

describe('편집 충돌 (T046, AC-2.5)', () => {
  function twoRevisions() {
    const t = createTestDb();
    const authorId = t.systemUserId;
    savePage(t.db, { fullTitle: '문서', content: '첫 판', authorId });
    savePage(t.db, { fullTitle: '문서', content: '둘째 판', authorId });
    return { ...t, firstId: getPage(t.db, '문서', { rev: 1 })!.revision!.id };
  }

  it('편집을 시작한 판이 최신 판이면 그대로 저장한다', () => {
    const { db, systemUserId } = twoRevisions();
    const baseRevId = getPage(db, '문서')!.revision!.id;
    expect(
      savePage(db, { fullTitle: '문서', content: '셋째 판', authorId: systemUserId, baseRevId }),
    ).toMatchObject({
      changed: true,
      revNo: 3,
    });
  });

  it('그 사이에 다른 사람이 저장했으면 저장하지 않고 최신 판 정보를 담은 ConflictError', () => {
    const { db, systemUserId, firstId } = twoRevisions();
    let caught: unknown;
    try {
      savePage(db, { fullTitle: '문서', content: '내 내용', authorId: systemUserId, baseRevId: firstId });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ConflictError);
    expect((caught as ConflictError).latest).toMatchObject({
      revNo: 2,
      content: '둘째 판',
      authorName: 'system',
    });
    expect(getPage(db, '문서')!.revision!.revNo).toBe(2);
  });

  it('새 문서를 만들려 했는데 그 사이에 누가 먼저 만들었으면 충돌', () => {
    const { db, systemUserId } = createTestDb();
    savePage(db, {
      fullTitle: '새 문서',
      content: '먼저 만든 내용',
      authorId: systemUserId,
      baseRevId: null,
    });
    expect(() =>
      savePage(db, {
        fullTitle: '새 문서',
        content: '늦게 만든 내용',
        authorId: systemUserId,
        baseRevId: null,
      }),
    ).toThrow(ConflictError);
    expect(getPage(db, '새 문서')!.revision!.content).toBe('먼저 만든 내용');
  });

  it('있는 문서인데 편집 시작 판을 모르면(null) 충돌로 본다', () => {
    const { db, systemUserId } = twoRevisions();
    expect(() =>
      savePage(db, { fullTitle: '문서', content: '내 내용', authorId: systemUserId, baseRevId: null }),
    ).toThrow(ConflictError);
  });

  it('내 내용이 최신 판과 같으면 충돌이 아니라 "바뀐 것 없음"', () => {
    const { db, systemUserId, firstId } = twoRevisions();
    expect(
      savePage(db, { fullTitle: '문서', content: '둘째 판', authorId: systemUserId, baseRevId: firstId }),
    ).toMatchObject({ changed: false, revNo: 2 });
  });

  it('충돌 뒤 최신 판 id로 다시 저장하면 저장된다', () => {
    const { db, systemUserId, firstId } = twoRevisions();
    let latestId = 0;
    try {
      savePage(db, { fullTitle: '문서', content: '내 내용', authorId: systemUserId, baseRevId: firstId });
    } catch (error) {
      latestId = (error as ConflictError).latest.id;
    }
    expect(
      savePage(db, { fullTitle: '문서', content: '내 내용', authorId: systemUserId, baseRevId: latestId }),
    ).toMatchObject({ changed: true, revNo: 3 });
  });

  it('baseRevId를 넘기지 않으면(기본 데이터·스크립트) 검사하지 않는다', () => {
    const { db, systemUserId } = twoRevisions();
    expect(savePage(db, { fullTitle: '문서', content: '셋째 판', authorId: systemUserId }).changed).toBe(
      true,
    );
  });
});
