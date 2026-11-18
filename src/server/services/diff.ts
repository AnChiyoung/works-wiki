import { diffArrays, diffWordsWithSpace } from 'diff';
import { normalizeContent } from './pages';

// 두 판의 차이 (AC-4.2, T041). 줄 단위로 비교하고, 바뀐 줄 안에서는 단어 단위로 강조한다.

/** 바뀐 줄 앞뒤로 남겨 두는 같은 줄 수 */
export const DIFF_CONTEXT_LINES = 3;

export type DiffPart = { text: string; changed: boolean };

export type DiffRow =
  | { type: 'same'; oldNo: number; newNo: number; text: string }
  | { type: 'removed'; oldNo: number; text: string; parts: DiffPart[] }
  | { type: 'added'; newNo: number; text: string; parts: DiffPart[] }
  /** 바뀌지 않아서 접어 둔 구간 */
  | { type: 'skip'; count: number };

export type DiffResult = { rows: DiffRow[]; added: number; removed: number };

/** 줄 목록. 줄바꿈 방식과 마지막 줄바꿈 유무는 차이로 보지 않는다. 빈 문서는 줄이 없다. */
function toLines(text: string): string[] {
  const normalized = normalizeContent(text).replace(/\n$/, '');
  return normalized === '' ? [] : normalized.split('\n');
}

/** 짝지어진 삭제 줄·추가 줄 안에서 바뀐 단어를 찾는다 */
function wordParts(oldLine: string, newLine: string): { removed: DiffPart[]; added: DiffPart[] } {
  const removed: DiffPart[] = [];
  const added: DiffPart[] = [];
  for (const change of diffWordsWithSpace(oldLine, newLine)) {
    if (!change.added) removed.push({ text: change.value, changed: change.removed });
    if (!change.removed) added.push({ text: change.value, changed: change.added });
  }
  return { removed, added };
}

/** 바뀐 줄에서 DIFF_CONTEXT_LINES보다 멀리 떨어진 같은 줄들을 skip 한 줄로 접는다 */
function collapse(rows: DiffRow[]): DiffRow[] {
  const changed = rows.map((row) => row.type !== 'same');
  const keep = rows.map((_, i) => {
    for (let d = -DIFF_CONTEXT_LINES; d <= DIFF_CONTEXT_LINES; d += 1) if (changed[i + d]) return true;
    return false;
  });

  const result: DiffRow[] = [];
  let skipped = 0;
  rows.forEach((row, i) => {
    if (keep[i]) {
      if (skipped > 0) result.push({ type: 'skip', count: skipped });
      skipped = 0;
      result.push(row);
    } else {
      skipped += 1;
    }
  });
  if (skipped > 0) result.push({ type: 'skip', count: skipped });

  // 바뀐 곳이 하나도 없으면 접지 않고 전체를 보여준다
  return changed.some(Boolean) ? result : rows;
}

export function computeDiff(oldText: string, newText: string): DiffResult {
  const rows: DiffRow[] = [];
  let oldNo = 0;
  let newNo = 0;
  let added = 0;
  let removed = 0;

  const changes = diffArrays(toLines(oldText), toLines(newText));
  for (let i = 0; i < changes.length; i += 1) {
    const change = changes[i]!;
    if (!change.added && !change.removed) {
      for (const text of change.value) rows.push({ type: 'same', oldNo: ++oldNo, newNo: ++newNo, text });
      continue;
    }

    // 삭제 바로 뒤에 추가가 오면 "수정"으로 보고 줄끼리 짝지어 단어 단위로 강조한다
    const removedLines = change.removed ? change.value : [];
    const next = changes[i + 1];
    const addedLines = change.added ? change.value : next?.added ? next.value : [];
    if (change.removed && next?.added) i += 1;

    removedLines.forEach((text, k) => {
      const pair = addedLines[k];
      const parts = pair === undefined ? [{ text, changed: true }] : wordParts(text, pair).removed;
      rows.push({ type: 'removed', oldNo: ++oldNo, text, parts });
    });
    addedLines.forEach((text, k) => {
      const pair = removedLines[k];
      const parts = pair === undefined ? [{ text, changed: true }] : wordParts(pair, text).added;
      rows.push({ type: 'added', newNo: ++newNo, text, parts });
    });
    removed += removedLines.length;
    added += addedLines.length;
  }

  return { rows: collapse(rows), added, removed };
}
