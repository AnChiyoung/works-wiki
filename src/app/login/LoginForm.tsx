'use client';

import { useActionState } from 'react';
import { type LoginState, loginAction } from './actions';
import styles from './page.module.css';

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginAction, {});

  return (
    <form action={formAction} className={styles.form}>
      <input type="hidden" name="next" value={next} />
      <label className={styles.label}>
        아이디
        {/* 실패하면 React가 입력칸을 비우므로, 서버가 돌려준 아이디로 다시 채운다 */}
        <input
          key={state.username ?? ''}
          name="username"
          defaultValue={state.username}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          autoFocus
          className={styles.input}
        />
      </label>
      <label className={styles.label}>
        비밀번호
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={styles.input}
        />
      </label>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
      <button type="submit" className={styles.submit} disabled={pending}>
        {pending ? '확인 중…' : '로그인'}
      </button>
    </form>
  );
}
