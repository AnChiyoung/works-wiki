import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SizeDelta } from '@/components/SizeDelta';
import { formatDateTime } from '@/lib/format';
import { getDb } from '@/server/db';
import type { RevisionSummary } from '@/server/services/history';
import { listRevisions } from '@/server/services/history';
import { TitleError, titleFromPathSegments, titleToPath } from '@/server/services/title';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ title: string[] }>;
  searchParams: Promise<{ before?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // generateMetadata의 params는 이미 디코딩되어 있다 (w/[...title]/page.tsx 주석 참고)
  const { title } = await params;
  return { title: `이력: ${title.join('/')}`, robots: { index: false } };
}

const KIND_LABELS: Partial<Record<RevisionSummary['kind'], string>> = {
  create: '새 문서',
  revert: '되돌림',
  move: '이동',
  delete: '삭제',
  restore: '복구',
};

// US-4 이력 목록 (AC-4.1, T042)
export default async function HistoryPage({ params, searchParams }: Props) {
  const { title } = await params;
  const { before: rawBefore } = await searchParams;
  const before = rawBefore && /^[1-9]\d{0,8}$/.test(rawBefore) ? Number(rawBefore) : undefined;

  let list;
  try {
    list = listRevisions(getDb(), titleFromPathSegments(title), { before });
  } catch (error) {
    if (error instanceof TitleError || error instanceof URIError) notFound();
    throw error;
  }
  if (!list || (list.items.length === 0 && before === undefined)) notFound();

  const { page, items, nextBefore } = list;
  const viewPath = titleToPath(page.fullTitle);
  // 비교 기본값: 최신 판과 바로 앞 판
  const defaultTo = items[0]?.revNo;
  const defaultFrom = items[1]?.revNo;

  return (
    <section>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <Link href={viewPath}>{page.fullTitle}</Link> <span className={styles.sub}>이력</span>
        </h1>
      </header>

      {/* 두 판을 골라 차이 화면으로 (GET 폼이라 자바스크립트 없이도 동작한다) */}
      <form action={titleToPath(page.fullTitle, '/diff')} method="get" className={styles.form}>
        {items.length > 1 && (
          <button type="submit" className={styles.compare}>
            고른 두 판 비교
          </button>
        )}
        <table className={styles.table}>
          <caption className={styles.srOnly}>{page.fullTitle} 문서의 판 목록 (최신순)</caption>
          <thead>
            <tr>
              <th scope="col">비교</th>
              <th scope="col">판</th>
              <th scope="col">시각</th>
              <th scope="col">편집자</th>
              <th scope="col">증감</th>
              <th scope="col">요약</th>
            </tr>
          </thead>
          <tbody>
            {items.map((rev) => (
              <tr key={rev.id}>
                <td className={styles.pick}>
                  <label>
                    <input
                      type="radio"
                      name="from"
                      value={rev.revNo}
                      defaultChecked={rev.revNo === defaultFrom}
                      aria-label={`${rev.revNo}판을 비교 기준(이전)으로`}
                    />
                    <span className={styles.pickLabel}>이전</span>
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="to"
                      value={rev.revNo}
                      defaultChecked={rev.revNo === defaultTo}
                      aria-label={`${rev.revNo}판을 비교 대상(이후)으로`}
                    />
                    <span className={styles.pickLabel}>이후</span>
                  </label>
                </td>
                <td className={styles.rev}>
                  <Link href={`${viewPath}?rev=${rev.revNo}`}>{rev.revNo}판</Link>
                  {KIND_LABELS[rev.kind] && <span className={styles.kind}>{KIND_LABELS[rev.kind]}</span>}
                </td>
                <td className={styles.time}>
                  <time dateTime={rev.createdAt.toISOString()}>{formatDateTime(rev.createdAt)}</time>
                </td>
                <td className={styles.author}>{rev.authorName}</td>
                <td className={styles.delta}>
                  <SizeDelta value={rev.sizeDelta} />
                  {rev.revNo > 1 && (
                    <Link
                      href={`${titleToPath(page.fullTitle, '/diff')}?to=${rev.revNo}`}
                      className={styles.prevDiff}
                      aria-label={`${rev.revNo}판에서 바뀐 내용`}
                    >
                      차이
                    </Link>
                  )}
                </td>
                <td className={styles.summary}>
                  {rev.summary || <span className={styles.muted}>요약 없음</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </form>

      <nav className={styles.pager} aria-label="이력 쪽 이동">
        {before !== undefined && <Link href={titleToPath(page.fullTitle, '/history')}>최신 판부터</Link>}
        {nextBefore !== null && (
          <Link href={`${titleToPath(page.fullTitle, '/history')}?before=${nextBefore}`}>더 이전 판</Link>
        )}
      </nav>
    </section>
  );
}
