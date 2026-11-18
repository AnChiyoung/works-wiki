'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
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
  const rev = useSearchParams().get('rev');

  if (state.kind === 'invalid') {
    return (
      <section className={styles.box}>
        <h1 className={styles.title}>쓸 수 없는 제목입니다</h1>
        <p>{state.message}</p>
      </section>
    );
  }

  // 문서는 있을 수도 있지만 요청한 판이 없는 경우 (T039)
  if (rev !== null) {
    return (
      <section className={styles.box}>
        <h1 className={styles.title}>{state.fullTitle}</h1>
        <p>요청한 판({rev})이 없습니다.</p>
        <Link href={titleToPath(state.fullTitle)}>최신 판 보기</Link>
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
