'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { formatDateTime } from '@/lib/format';
import { safeRedirectPath } from '@/lib/redirect';
import { clientKey } from '@/server/client-key';
import { endCurrentSession, setSessionCookie } from '@/server/current-user';
import { getDb } from '@/server/db';
import { login } from '@/server/services/auth';
import { getLoginLimiter } from '@/server/services/rate-limit';
import { PASSWORD_MAX_LENGTH } from '@/server/services/users';

export type LoginState = { error?: string; username?: string };

const formSchema = z.object({
  username: z.string().trim().max(100),
  password: z.string().max(PASSWORD_MAX_LENGTH * 4),
  next: z.string().optional(),
});

const LOGIN_FAILED = '아이디 또는 비밀번호가 맞지 않습니다.';

/** 로그인 (AC-8.2, AC-8.3) */
export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = formSchema.safeParse({
    username: formData.get('username') ?? '',
    password: formData.get('password') ?? '',
    next: formData.get('next') ?? undefined,
  });
  if (!parsed.success) return { error: LOGIN_FAILED };
  const { username, password, next } = parsed.data;

  const limiter = getLoginLimiter();
  const key = clientKey(await headers());
  const limit = limiter.check(key);
  if (!limit.allowed) {
    return {
      username,
      error: `로그인을 너무 많이 실패했습니다. ${formatDateTime(limit.retryAt)} 이후에 다시 시도해 주세요.`,
    };
  }

  const result = await login(getDb(), { username, password });
  if (!result.ok) {
    limiter.recordFailure(key);
    return { username, error: LOGIN_FAILED };
  }
  limiter.reset(key);
  await setSessionCookie(result);
  redirect(safeRedirectPath(next));
}

/** 로그아웃 (AC-8.2). 보던 화면으로 돌아간다. */
export async function logoutAction(formData: FormData): Promise<void> {
  await endCurrentSession();
  redirect(safeRedirectPath(formData.get('next')));
}
