import type { DbOrTx } from '@/server/db/client';
import { MAX_SUMMARY_LENGTH, type SavePageResult, getPage, savePage } from './pages';

// 과거 판으로 되돌리기 (AC-4.4, T044). 되돌리기도 새 판으로 기록한다(원칙 3).

export class RevertError extends Error {
  constructor(message = '되돌릴 문서나 판이 없습니다.') {
    super(message);
    this.name = 'RevertError';
  }
}

export type RevertPageInput = {
  fullTitle: string;
  /** 되돌릴 대상 판 번호 */
  toRevNo: number;
  authorId: number;
  /** 사용자가 덧붙인 요약 */
  summary?: string;
  /** 되돌리기 화면을 열 때의 최신 판 id. 편집 충돌 검사(T046)에서 쓴다 */
  baseRevId?: number | null;
};

/** 되돌림 판의 요약: "N판으로 되돌림" 또는 "N판으로 되돌림: 사용자 요약" (200자 이내) */
function revertSummary(toRevNo: number, summary: string | undefined): string {
  const base = `${toRevNo}판으로 되돌림`;
  const extra = summary?.trim();
  return [...(extra ? `${base}: ${extra}` : base)].slice(0, MAX_SUMMARY_LENGTH).join('');
}

/**
 * 과거 판의 내용으로 새 판(kind: revert)을 만든다. 최신 판과 내용이 같으면 저장하지 않는다.
 * 권한 확인(`edit`)은 부르는 쪽(서버 액션)에서 한다.
 */
export function revertPage(db: DbOrTx, input: RevertPageInput): SavePageResult {
  return db.transaction((tx) => {
    const target = getPage(tx, input.fullTitle, { rev: input.toRevNo });
    if (!target?.revision) throw new RevertError();

    return savePage(tx, {
      fullTitle: target.page.fullTitle,
      content: target.revision.content,
      summary: revertSummary(input.toRevNo, input.summary),
      authorId: input.authorId,
      baseRevId: input.baseRevId,
      kind: 'revert',
    });
  });
}
