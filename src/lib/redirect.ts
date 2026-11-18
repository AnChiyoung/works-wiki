/**
 * 로그인·로그아웃 뒤 돌아갈 주소. 같은 사이트 안의 경로만 허용하고, 아니면 fallback.
 * `//evil.com`, `/\evil.com`, `https://…` 같은 외부 주소로 보내는 것을 막는다.
 */
export function safeRedirectPath(next: unknown, fallback = '/'): string {
  if (typeof next !== 'string' || next.length === 0 || next.length > 2000) return fallback;
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  // 제어 문자(줄바꿈 등)가 들어 있으면 거부
  if ([...next].some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f)) return fallback;
  try {
    const url = new URL(next, 'http://wiki.invalid');
    if (url.origin !== 'http://wiki.invalid') return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
