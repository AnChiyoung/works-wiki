import 'server-only';
import { cookies, headers } from 'next/headers';
import { cache } from 'react';
import { getDb } from '@/server/db';
import { type LoginResult, type SessionUser, getSessionUser, logout } from '@/server/services/auth';

// 로그인 쿠키 ↔ 세션 서비스 연결 (plan.md §7)
export const SESSION_COOKIE = 'wiki_session';
/**
 * 쿠키 자체는 브라우저가 허용하는 최대 기간(400일) 동안 두고, 세션이 언제 끝나는지는 DB가 정한다.
 * 서버 컴포넌트에서는 쿠키를 고칠 수 없어서, 세션을 연장할 때 DB의 만료 시각만 바꾸기 위한 것.
 */
const COOKIE_MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

/**
 * 지금 요청의 로그인 사용자. 로그인하지 않았으면 null.
 * 한 번의 요청 안에서는 결과를 재사용한다(React cache).
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return getSessionUser(getDb(), token);
});

/** https로 들어온 요청인지 (Cloudflare Tunnel 등 프록시 뒤에서는 x-forwarded-proto로 판단) */
async function isHttps(): Promise<boolean> {
  const h = await headers();
  return h.get('x-forwarded-proto')?.split(',')[0]?.trim() === 'https';
}

/** 로그인 성공 후 세션 쿠키를 심는다. 서버 액션·라우트 핸들러에서만 부를 수 있다. */
export async function setSessionCookie(result: Extract<LoginResult, { ok: true }>): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: await isHttps(),
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

/** 세션을 지우고 쿠키도 지운다. 서버 액션·라우트 핸들러에서만 부를 수 있다. */
export async function endCurrentSession(): Promise<void> {
  const store = await cookies();
  logout(getDb(), store.get(SESSION_COOKIE)?.value);
  store.delete(SESSION_COOKIE);
}
