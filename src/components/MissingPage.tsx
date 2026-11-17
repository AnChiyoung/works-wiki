'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TitleError, parseTitle, titleFromPathSegments, titleToPath } from '@/server/services/title';
import styles from './MissingPage.module.css';

type State = { kind: 'missing'; fullTitle: string } | { kind: 'invalid'; message: string };

function readTitle(pathname: string): State {
  const segments = pathname.replace(/^\/w\//, '').split('/');
  try {
    return { kind: 'missing', fullTitle: parseTitle(titleFromPathSegments(segments)).fullTitle };
  } catch (error) {
    if (error instanceof TitleError) return { kind: 'invalid', message: error.message };
    return { kind: 'invalid', message: '주소를 읽을 수 없습니다.' };
  }
}

export function MissingPage({ canCreate }: { canCreate: boolean }) {
  const state = readTitle(usePathname());

  if (state.kind === 'invalid') {
    return (
      <section className={styles.box}>
        <h1 className={styles.title}>쓸 수 없는 제목입니다</h1>
        <p>{state.message}</p>
      </section>
    );
  }

  return (
    <section className={styles.box}>
      <h1 className={styles.title}>{state.fullTitle}</h1>
      <p>문서가 없습니다.</p>
      {canCreate && (
        <Link href={titleToPath(state.fullTitle, '/edit')} className={styles.create}>
          새로 만들기
        </Link>
      )}
    </section>
  );
}
