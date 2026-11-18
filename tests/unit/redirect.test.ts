import { describe, expect, it } from 'vitest';
import { safeRedirectPath } from '@/lib/redirect';
import { clientKey } from '@/server/client-key';

describe('로그인 후 돌아갈 주소 (T034)', () => {
  it.each([
    ['/w/%EB%8C%80%EB%AC%B8', '/w/%EB%8C%80%EB%AC%B8'],
    ['/w/C%2FC%2B%2B?notice=unchanged#s-1', '/w/C%2FC%2B%2B?notice=unchanged#s-1'],
    ['/', '/'],
  ])('같은 사이트 경로는 그대로: %s', (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    'https://evil.com',
    '//evil.com',
    '/\\evil.com',
    'evil.com',
    'javascript:alert(1)',
    '/w/a\nb',
    '',
    undefined,
    null,
    123,
  ])('외부·이상한 주소는 첫 화면으로: %s', (input) => {
    expect(safeRedirectPath(input)).toBe('/');
  });

  it('돌아갈 기본 주소를 바꿀 수 있다', () => {
    expect(safeRedirectPath('//evil.com', '/w/x')).toBe('/w/x');
  });
});

describe('접속자 구분값 (T034, AC-8.3)', () => {
  it('Cloudflare가 넣은 IP를 쓴다', () => {
    expect(clientKey(new Headers({ 'cf-connecting-ip': ' 203.0.113.7 ' }))).toBe('ip:203.0.113.7');
  });

  it('꾸밀 수 있는 X-Forwarded-For는 믿지 않는다', () => {
    expect(clientKey(new Headers({ 'x-forwarded-for': '1.2.3.4' }))).toBe('local');
    expect(clientKey(new Headers())).toBe('local');
  });
});
