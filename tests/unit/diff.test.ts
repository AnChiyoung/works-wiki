import { describe, expect, it } from 'vitest';
import { type DiffRow, computeDiff } from '@/server/services/diff';

/** 보기 쉽게 줄 종류와 글자만 뽑는다: '+ 줄', '- 줄', '  줄', '… 3줄' */
function brief(rows: DiffRow[]): string[] {
  return rows.map((row) => {
    if (row.type === 'skip') return `… ${row.count}줄`;
    const mark = row.type === 'added' ? '+' : row.type === 'removed' ? '-' : ' ';
    return `${mark} ${row.text}`;
  });
}

describe('차이 계산 (T041, AC-4.2)', () => {
  it('같은 내용이면 바뀐 줄이 없다', () => {
    const result = computeDiff('가\n나', '가\n나');
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.rows.every((row) => row.type !== 'added' && row.type !== 'removed')).toBe(true);
  });

  it('추가·삭제·수정된 줄을 구분하고 개수를 센다', () => {
    const result = computeDiff('가\n나\n다', '가\n나나\n다\n라');
    expect(brief(result.rows)).toEqual(['  가', '- 나', '+ 나나', '  다', '+ 라']);
    expect(result.added).toBe(2);
    expect(result.removed).toBe(1);
  });

  it('줄 번호는 옛 판·새 판 기준으로 각각 매긴다', () => {
    const { rows } = computeDiff('가\n나\n다', '가\n새 줄\n나\n다');
    expect(rows).toEqual([
      { type: 'same', oldNo: 1, newNo: 1, text: '가' },
      expect.objectContaining({ type: 'added', newNo: 2, text: '새 줄' }),
      { type: 'same', oldNo: 2, newNo: 3, text: '나' },
      { type: 'same', oldNo: 3, newNo: 4, text: '다' },
    ]);
  });

  it('바뀐 줄 안에서는 바뀐 단어만 강조한다', () => {
    const { rows } = computeDiff('const a = 1;', 'const b = 1;');
    const removed = rows.find((row) => row.type === 'removed');
    const added = rows.find((row) => row.type === 'added');
    expect(removed?.type === 'removed' && removed.parts).toEqual([
      { text: 'const ', changed: false },
      { text: 'a', changed: true },
      { text: ' = 1;', changed: false },
    ]);
    expect(added?.type === 'added' && added.parts).toEqual([
      { text: 'const ', changed: false },
      { text: 'b', changed: true },
      { text: ' = 1;', changed: false },
    ]);
  });

  it('한글은 어절 안에서도 바뀐 글자만 강조한다', () => {
    const { rows } = computeDiff('리액트는 화면을 만든다', '리액트는 화면을 그린다');
    const added = rows.find((row) => row.type === 'added');
    expect(added?.type === 'added' && added.parts.filter((p) => p.changed).map((p) => p.text)).toEqual([
      '그린',
    ]);
  });

  it('짝이 없는 추가 줄은 줄 전체가 바뀐 것으로 본다', () => {
    const { rows } = computeDiff('가', '가\n완전히 새 줄');
    const added = rows.find((row) => row.type === 'added');
    expect(added?.type === 'added' && added.parts).toEqual([{ text: '완전히 새 줄', changed: true }]);
  });

  it('바뀌지 않은 긴 구간은 앞뒤 3줄만 남기고 접는다', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `줄 ${i + 1}`);
    const changed = [...lines];
    changed[9] = '바뀐 줄 10';
    expect(brief(computeDiff(lines.join('\n'), changed.join('\n')).rows)).toEqual([
      '… 6줄',
      '  줄 7',
      '  줄 8',
      '  줄 9',
      '- 줄 10',
      '+ 바뀐 줄 10',
      '  줄 11',
      '  줄 12',
      '  줄 13',
      '… 7줄',
    ]);
  });

  it('접을 만큼 길지 않으면 접지 않는다', () => {
    const before = ['1', '2', '3', '4', '5', '6', '7'].join('\n');
    const after = ['1', '2', '3', '바뀜', '5', '6', '7'].join('\n');
    expect(computeDiff(before, after).rows.some((row) => row.type === 'skip')).toBe(false);
  });

  it('빈 문서에서 시작하면 모두 추가된 줄이다', () => {
    const result = computeDiff('', '가\n나');
    expect(brief(result.rows)).toEqual(['+ 가', '+ 나']);
  });

  it('줄바꿈 방식(CRLF/LF)만 다르면 같은 내용으로 본다', () => {
    const result = computeDiff('가\r\n나\r\n', '가\n나\n');
    expect(result.added + result.removed).toBe(0);
  });

  it('마지막 줄바꿈 유무만 다른 것도 같은 내용으로 본다', () => {
    const result = computeDiff('가\n나', '가\n나\n');
    expect(result.added + result.removed).toBe(0);
  });

  it('빈 줄도 한 줄로 센다', () => {
    expect(brief(computeDiff('가\n다', '가\n\n다').rows)).toEqual(['  가', '+ ', '  다']);
  });
});
