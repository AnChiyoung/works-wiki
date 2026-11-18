'use client';

import { useActionState } from 'react';
import { type RevertState, revertAction } from './actions';
import styles from './page.module.css';

type Props = { fullTitle: string; revNo: number; baseRevId: number };

/** 과거 판 화면의 되돌리기 (T045). 누르면 확인 창을 띄운 뒤 서버 액션으로 새 판을 만든다. */
export function RevertForm({ fullTitle, revNo, baseRevId }: Props) {
  const [state, formAction, pending] = useActionState<RevertState, FormData>(revertAction, {});

  return (
    <form
      action={formAction}
      className={styles.revertForm}
      onSubmit={(event) => {
        if (!window.confirm(`${revNo}판의 내용으로 되돌릴까요? 되돌리기도 새 판으로 기록됩니다.`)) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="title" value={fullTitle} />
      <input type="hidden" name="toRevNo" value={revNo} />
      <input type="hidden" name="baseRevId" value={baseRevId} />
      <input
        name="summary"
        aria-label="되돌리는 이유"
        placeholder="되돌리는 이유 (선택)"
        maxLength={150}
        className={styles.revertSummary}
      />
      <button type="submit" className={styles.revertButton} disabled={pending}>
        {pending ? '되돌리는 중…' : '이 판으로 되돌리기'}
      </button>
      {state.error && (
        <p className={styles.revertError} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
