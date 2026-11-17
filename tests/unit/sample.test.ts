import { describe, expect, it } from 'vitest';
import { add } from '@/server/sample';

describe('테스트 환경', () => {
  it('@/ 경로 별칭과 server-only 모듈을 불러올 수 있다', () => {
    expect(add(1, 2)).toBe(3);
  });
});
