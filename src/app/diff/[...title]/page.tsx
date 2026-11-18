import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DiffView } from '@/components/DiffView';
import { formatDateTime } from '@/lib/format';
import { getDb } from '@/server/db';
import { computeDiff } from '@/server/services/diff';
import { type RevisionInfo, getPage } from '@/server/services/pages';
import { TitleError, titleFromPathSegments, titleToPath } from '@/server/services/title';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ title: string[] }>;
  searchParams: Promise<{ from?: string | string[]; to?: string | string[] }>;
};

/** 판 번호. 없으면 undefined, 숫자가 아니면 'invalid' */
function parseRevNo(raw: string | string[] | undefined): number | undefined | 'invalid' {
  if (raw === undefined) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && /^[1-9]\d{0,8}$/.test(value) ? Number(value) : 'invalid';
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // generateMetadata의 params는 이미 디코딩되어 있다 (w/[...title]/page.tsx 주석 참고)
  const { title } = await params;
  return { title: `차이: ${title.join('/')}`, robots: { index: false } };
}

function RevisionLabel({ rev, path }: { rev: RevisionInfo | null; path: string }) {
  if (!rev) return <span className={styles.muted}>(빈 문서)</span>;
  return (
    <span>
      <Link href={`${path}?rev=${rev.revNo}`}>{rev.revNo}판</Link>{' '}
      <span className={styles.muted}>
        {formatDateTime(rev.createdAt)} · {rev.authorName}
      </span>
    </span>
  );
}

// US-4 두 판 비교 (AC-4.2, T043)
export default async function DiffPage({ params, searchParams }: Props) {
  const { title } = await params;
  const query = await searchParams;
  let from = parseRevNo(query.from);
  let to = parseRevNo(query.to);
  if (from === 'invalid' || to === 'invalid') notFound();

  const db = getDb();
  let latest;
  try {
    latest = getPage(db, titleFromPathSegments(title));
  } catch (error) {
    if (error instanceof TitleError || error instanceof URIError) notFound();
    throw error;
  }
  if (!latest?.revision) notFound();
  const { page } = latest;

  // to가 없으면 최신 판, from이 없으면 to의 바로 앞 판 (1판이면 빈 문서와 비교)
  to ??= latest.revision.revNo;
  from ??= to - 1;
  if (from > to) [from, to] = [to, from];

  const newer = getPage(db, page.fullTitle, { rev: to })?.revision ?? null;
  const older = from === 0 ? null : (getPage(db, page.fullTitle, { rev: from })?.revision ?? null);
  if (!newer || (from !== 0 && !older)) notFound();

  const { rows, added, removed } = computeDiff(older?.content ?? '', newer.content);
  const viewPath = titleToPath(page.fullTitle);

  return (
    <section>
      <header className={styles.header}>
        <h1 className={styles.title}>
          <Link href={viewPath}>{page.fullTitle}</Link> <span className={styles.sub}>차이</span>
        </h1>
        <nav className={styles.links} aria-label="차이 화면 이동">
          <Link href={titleToPath(page.fullTitle, '/history')}>이력</Link>
        </nav>
      </header>

      <dl className={styles.revs}>
        <div>
          <dt>이전</dt>
          <dd>
            <RevisionLabel rev={older} path={viewPath} />
          </dd>
        </div>
        <div>
          <dt>이후</dt>
          <dd>
            <RevisionLabel rev={newer} path={viewPath} />
            {newer.summary && <span className={styles.summary}> — {newer.summary}</span>}
          </dd>
        </div>
      </dl>

      {added + removed === 0 ? (
        <p className={styles.same} role="status">
          두 판의 내용이 같습니다.
        </p>
      ) : (
        <>
          <p className={styles.counts}>
            <span className={styles.plus}>+{added}줄</span> <span className={styles.minus}>−{removed}줄</span>
          </p>
          <DiffView rows={rows} />
        </>
      )}
    </section>
  );
}
