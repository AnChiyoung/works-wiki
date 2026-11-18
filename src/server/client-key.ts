/**
 * 로그인 실패 제한(AC-8.3)에 쓰는 접속자 구분값.
 * 서버는 127.0.0.1에만 열려 있고, 외부 접속은 Cloudflare Tunnel을 거친다(plan.md §8).
 * Cloudflare가 덮어쓰는 `CF-Connecting-IP`만 믿고, 누구나 꾸밀 수 있는 `X-Forwarded-For`는 쓰지 않는다.
 * 헤더가 없으면 이 PC에서 직접 접속한 것이므로 모두 'local' 하나로 센다.
 */
export function clientKey(headers: Pick<Headers, 'get'>): string {
  const ip = headers.get('cf-connecting-ip')?.trim();
  return ip ? `ip:${ip}` : 'local';
}
