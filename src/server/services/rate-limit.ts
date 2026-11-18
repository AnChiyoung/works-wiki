// 로그인 실패 제한: spec.md AC-8.3, plan.md §7
// 메모리에만 기록한다(서버 한 대 기준). 서버를 재시작하면 기록이 초기화되는 것은 허용한다.
const MIN = 60 * 1000;

export type LimitCheck = { allowed: true } | { allowed: false; retryAt: Date };

type Entry = {
  /** 최근 실패 시각들 (window 안의 것만 유지) */
  failures: number[];
  lockedUntil: number | null;
};

export type LoginLimiterOptions = {
  /** 이만큼 실패하면 제한 (기본 5번) */
  maxFailures?: number;
  /** 실패를 세는 기간 (기본 15분) */
  windowMs?: number;
  /** 제한 시간 (기본 15분) */
  lockMs?: number;
  /** 테스트에서 시각을 흉내 내기 위한 것 */
  now?: () => number;
};

export function createLoginLimiter({
  maxFailures = 5,
  windowMs = 15 * MIN,
  lockMs = 15 * MIN,
  now = Date.now,
}: LoginLimiterOptions = {}) {
  const entries = new Map<string, Entry>();

  /** 제한이 끝났고 남은 실패 기록도 없는 항목을 지운다 */
  function sweep(t: number): void {
    for (const [key, entry] of entries) {
      if (entry.lockedUntil !== null && entry.lockedUntil > t) continue;
      entry.lockedUntil = null;
      entry.failures = entry.failures.filter((at) => t - at < windowMs);
      if (entry.failures.length === 0) entries.delete(key);
    }
  }

  return {
    check(key: string): LimitCheck {
      const t = now();
      const entry = entries.get(key);
      if (entry && entry.lockedUntil !== null) {
        if (entry.lockedUntil > t) return { allowed: false, retryAt: new Date(entry.lockedUntil) };
        // 제한이 끝나면 실패 횟수도 처음부터 센다
        entries.delete(key);
      }
      return { allowed: true };
    },

    recordFailure(key: string): void {
      const t = now();
      sweep(t);
      const entry = entries.get(key) ?? { failures: [], lockedUntil: null };
      if (entry.lockedUntil !== null && entry.lockedUntil > t) return; // 제한 중에는 시간을 늘리지 않는다
      entry.failures = [...entry.failures.filter((at) => t - at < windowMs), t];
      if (entry.failures.length >= maxFailures) {
        entry.lockedUntil = t + lockMs;
        entry.failures = [];
      }
      entries.set(key, entry);
    },

    reset(key: string): void {
      entries.delete(key);
    },

    /** 기록 중인 키 수 (테스트용) */
    size(): number {
      return entries.size;
    },
  };
}

export type LoginLimiter = ReturnType<typeof createLoginLimiter>;

const globalForLimiter = globalThis as typeof globalThis & { __wikiLoginLimiter?: LoginLimiter };

/** 서버 전체가 함께 쓰는 로그인 제한기. 개발 서버가 코드를 다시 불러와도 기록이 유지된다. */
export function getLoginLimiter(): LoginLimiter {
  globalForLimiter.__wikiLoginLimiter ??= createLoginLimiter();
  return globalForLimiter.__wikiLoginLimiter;
}
