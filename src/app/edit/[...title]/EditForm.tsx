'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { WikiContent } from '@/components/WikiContent';
import { titleToPath } from '@/server/services/title';
import { type SaveState, savePageAction } from './actions';
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

export function EditForm({ fullTitle, initialContent, baseRevId }: Props) {
  const [state, formAction, pending] = useActionState<SaveState, FormData>(savePageAction, {});
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
      <input type="hidden" name="baseRevId" value={baseRevId ?? ''} />

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

      {state.error && (
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
