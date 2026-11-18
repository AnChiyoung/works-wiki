/**
 * 주소의 판 번호(`?rev=12`, `?from=`, `?to=`, `?before=`)를 읽는다.
 * 값이 없으면 undefined, 1 이상의 정수가 아니면 'invalid'(→ 404).
 */
export function parseRevNo(raw: string | string[] | null | undefined): number | undefined | 'invalid' {
  if (raw === undefined || raw === null) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value !== undefined && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : 'invalid';
}
