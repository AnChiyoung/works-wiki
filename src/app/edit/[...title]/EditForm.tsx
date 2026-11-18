'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { DiffView } from '@/components/DiffView';
import { WikiContent } from '@/components/WikiContent';
import { formatDateTime } from '@/lib/format';
import { titleToPath } from '@/server/services/title';
import { type SaveConflict, type SaveState, savePageAction } from './actions';
import styles from './EditForm.module.css';

type Props = {
  fullTitle: string;
  initialContent: string;
  baseRevId: number | null;
};

type Preview =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'done'; html: string }
  | { status: 'error'; message: string };

/** 편집 충돌 안내 (AC-2.5, T046): 최신 판(이전)과 내 내용(이후)의 차이 */
function ConflictNotice({ fullTitle, conflict }: { fullTitle: string; conflict: SaveConflict }) {
  return (
    <section className={styles.conflict} role="alert" aria-label="편집 충돌">
      <p className={styles.conflictTitle}>다른 사람이 먼저 저장했습니다.</p>
      <p>
        최신 판은{' '}
        <a href={`${titleToPath(fullTitle)}?rev=${conflict.revNo}`} target="_blank" rel="noreferrer">
          {conflict.revNo}판
        </a>{' '}
        ({formatDateTime(new Date(conflict.createdAt))}, {conflict.authorName})입니다. 내가 쓴 내용은 입력창에
        그대로 있습니다. 아래 차이를 확인하고 필요한 부분을 합친 뒤 다시 저장하면, 입력창의 내용이 최신 판
        다음 판으로 저장됩니다.
      </p>
      {conflict.added + conflict.removed > 0 && (
        <>
          <p className={styles.conflictCounts}>
            최신 판 → 내 내용: <span className={styles.plus}>+{conflict.added}줄</span>{' '}
            <span className={styles.minus}>−{conflict.removed}줄</span>
          </p>
          <div className={styles.conflictDiff}>
            <DiffView rows={conflict.rows} />
          </div>
        </>
      )}
    </section>
  );
}

export function EditForm({ fullTitle, initialContent, baseRevId }: Props) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(savePageAction, {});
  // 충돌이 났으면 다음 저장은 최신 판 기준으로 (T046)
  const currentBaseRevId = state.conflict?.latestRevId ?? baseRevId;
  // 입력값은 상태로 관리한다. 폼 액션이 끝나면 React가 상태 없는 입력칸을 비우기 때문에,
  // 저장에 실패했을 때 쓰던 내용이 사라지지 않게 하려는 것.
  const [content, setContent] = useState(initialContent);
  const [summary, setSummary] = useState('');
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [preview, setPreview] = useState<Preview>({ status: 'idle' });
  const submitting = useRef(false);
  const dirty = content !== initialContent;

  // 저장하지 않고 떠나려 하면 확인 창 (T021)
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty && !submitting.current) event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // 저장이 실패해서 화면에 남으면 다시 확인 창이 뜨도록
  useEffect(() => {
    if (state.error) submitting.current = false;
  }, [state]);

  async function showPreview() {
    setTab('preview');
    setPreview({ status: 'loading' });
    try {
      const res = await fetch('/api/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = (await res.json()) as { html?: string; error?: string };
      if (!res.ok || data.html === undefined) throw new Error(data.error ?? '미리보기를 만들지 못했습니다.');
      setPreview({ status: 'done', html: data.html });
    } catch (error) {
      setPreview({ status: 'error', message: (error as Error).message });
    }
  }

  return (
    <form
      action={formAction}
      className={styles.form}
      onSubmit={() => {
        submitting.current = true;
      }}
    >
      <input type="hidden" name="title" value={fullTitle} />
      <input type="hidden" name="baseRevId" value={currentBaseRevId ?? ''} />

      {state.conflict && <ConflictNotice fullTitle={fullTitle} conflict={state.conflict} />}

      <div className={styles.tabs} role="tablist" aria-label="편집 화면">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'edit'}
          className={styles.tab}
          onClick={() => setTab('edit')}
        >
          편집
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'preview'}
          className={styles.tab}
          onClick={showPreview}
        >
          미리보기
        </button>
      </div>

      <textarea
        name="content"
        aria-label="문서 내용"
        className={styles.editor}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        hidden={tab !== 'edit'}
        spellCheck={false}
        autoFocus
      />

      {tab === 'preview' && (
        <div className={styles.preview} role="tabpanel" aria-label="미리보기">
          {preview.status === 'loading' && <p className={styles.muted}>미리보기를 만드는 중…</p>}
          {preview.status === 'error' && <p className={styles.error}>{preview.message}</p>}
          {preview.status === 'done' && <WikiContent html={preview.html} />}
        </div>
      )}

      <label className={styles.summaryLabel}>
        편집 요약
        <input
          name="summary"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className={styles.summary}
          placeholder="무엇을 바꿨는지 짧게 적어 주세요 (선택)"
          maxLength={200}
        />
      </label>

      {state.error && !state.conflict && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}

      <div className={styles.buttons}>
        <button type="submit" className={styles.save} disabled={pending}>
          {pending ? '저장 중…' : '저장'}
        </button>
        <Link href={titleToPath(fullTitle)} className={styles.cancel}>
          취소
        </Link>
      </div>
    </form>
  );
}
