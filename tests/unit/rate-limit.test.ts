import { describe, expect, it } from 'vitest';
import { createLoginLimiter } from '@/server/services/rate-limit';

const MIN = 60 * 1000;

function setup() {
  let now = 1_800_000_000_000;
  const limiter = createLoginLimiter({ now: () => now });
  return {
    limiter,
    advance: (ms: number) => {
      now += ms;
    },
    now: () => now,
  };
}

describe('로그인 실패 제한 (T032, AC-8.3)', () => {
  it('처음에는 허용한다', () => {
    const { limiter } = setup();
    expect(limiter.check('1.2.3.4')).toEqual({ allowed: true });
  });

  it('4번 실패까지는 허용하고, 5번째 실패부터 15분 동안 거부한다', () => {
    const { limiter, now } = setup();
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('ip');
    expect(limiter.check('ip').allowed).toBe(true);
    limiter.recordFailure('ip');
    expect(limiter.check('ip')).toEqual({ allowed: false, retryAt: new Date(now() + 15 * MIN) });
  });

  it('15분이 지나면 다시 허용하고, 실패 횟수도 처음부터 센다', () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 5; i += 1) limiter.recordFailure('ip');
    advance(15 * MIN - 1);
    expect(limiter.check('ip').allowed).toBe(false);
    advance(1);
    expect(limiter.check('ip').allowed).toBe(true);
    limiter.recordFailure('ip');
    expect(limiter.check('ip').allowed).toBe(true);
  });

  it('15분보다 오래된 실패는 세지 않는다', () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('ip');
    advance(15 * MIN + 1);
    limiter.recordFailure('ip');
    expect(limiter.check('ip').allowed).toBe(true);
  });

  it('흩어진 실패도 15분 안에 5번이면 거부한다', () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 5; i += 1) {
      limiter.recordFailure('ip');
      advance(3 * MIN);
    }
    expect(limiter.check('ip').allowed).toBe(false);
  });

  it('로그인에 성공하면 실패 횟수를 지운다', () => {
    const { limiter } = setup();
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('ip');
    limiter.reset('ip');
    for (let i = 0; i < 4; i += 1) limiter.recordFailure('ip');
    expect(limiter.check('ip').allowed).toBe(true);
  });

  it('IP마다 따로 센다', () => {
    const { limiter } = setup();
    for (let i = 0; i < 5; i += 1) limiter.recordFailure('a');
    expect(limiter.check('a').allowed).toBe(false);
    expect(limiter.check('b').allowed).toBe(true);
  });

  it('제한 중에 더 실패해도 제한 시간이 늘어나지 않는다', () => {
    const { limiter, advance, now } = setup();
    for (let i = 0; i < 5; i += 1) limiter.recordFailure('ip');
    const retryAt = now() + 15 * MIN;
    advance(5 * MIN);
    limiter.recordFailure('ip');
    expect(limiter.check('ip')).toEqual({ allowed: false, retryAt: new Date(retryAt) });
  });

  it('오래된 기록은 메모리에서 정리된다', () => {
    const { limiter, advance } = setup();
    for (let i = 0; i < 100; i += 1) limiter.recordFailure(`ip-${i}`);
    expect(limiter.size()).toBe(100);
    advance(16 * MIN);
    limiter.recordFailure('new');
    expect(limiter.size()).toBe(1);
  });
});
