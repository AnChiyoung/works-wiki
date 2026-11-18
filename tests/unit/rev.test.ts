import { describe, expect, it } from 'vitest';
import { parseRevNo } from '@/lib/rev';

describe('주소의 판 번호 읽기', () => {
  it.each([
    ['1', 1],
    ['9', 9],
    ['10', 10],
    ['123', 123],
    ['999999999', 999_999_999],
  ])('%s → %d', (input, expected) => {
    expect(parseRevNo(input)).toBe(expected);
  });

  it('값이 없으면 undefined', () => {
    expect(parseRevNo(undefined)).toBeUndefined();
    expect(parseRevNo(null)).toBeUndefined();
  });

  it.each(['', '0', '01', '-1', '1.5', 'abc', '1e3', ' 1', '1234567890'])('잘못된 값: "%s"', (input) => {
    expect(parseRevNo(input)).toBe('invalid');
  });

  it('같은 이름이 여러 번 오면 첫 번째 값을 쓴다', () => {
    expect(parseRevNo(['12', '3'])).toBe(12);
    expect(parseRevNo([])).toBe('invalid');
  });
});
