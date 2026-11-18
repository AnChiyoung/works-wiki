import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WikiContent } from '@/components/WikiContent';
import { formatDateTime, htmlToDescription } from '@/lib/format';
import { canWriteTitle } from '@/server/access';
import { getDb } from '@/server/db';
import { renderMarkup } from '@/server/render/markup';
import { getPage } from '@/server/services/pages';
import { TitleError, titleFromPathSegments, titleToPath } from '@/server/services/title';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ title: string[] }>;
  searchParams: Promise<{ notice?: string; rev?: string | string[] }>;
};

/** `?rev=3` → 3. 없으면 undefined, 숫자가 아니면 'invalid' (→ 404) */
function parseRev(raw: string | string[] | undefined): number | undefined | 'invalid' {
  if (raw === undefined) return undefined;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && /^[1-9]d{0,8}$/.test(value) ? Number(value) : 'invalid';
}

// 주의: Next.js 16.4에서 catch-all params는 페이지에는 인코딩된 채로(C%2B%2B),
// generateMetadata에는 디코딩된 채로(C++) 들어온다. 그래서 받는 쪽마다 처리를 다르게 한다.
// 100%, C++, C# 같은 제목의 화면 테스트(tests/e2e)가 이 동작이 바뀌면 알려준다.
function loadPage(fullTitle: () => string, rev?: number) {
  try {
    return getPage(getDb(), fullTitle(), { rev });
  } catch (error) {
    if (error instanceof TitleError || error instanceof URIError) return null;
    throw error;
  }
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { title } = await params;
  const rev = parseRev((await searchParams).rev);
  if (rev === 'invalid') return {};
  const result = loadPage(() => title.join('/'), rev);
  if (!result?.revision) return {};
  const description = htmlToDescription(renderMarkup(result.revision.content).html);
  if (rev === undefined) return { title: result.page.fullTitle, description };
  // 과거 판은 검색엔진에 색인하지 않는다 (T039)
  return { title: `${result.page.fullTitle} (${rev}판)`, description, robots: { index: false } };
}

// US-1 문서 보기
export default async function WikiPage({ params, searchParams }: Props) {
  const { title } = await params;
  const { notice, rev: rawRev } = await searchParams;
  const rev = parseRev(rawRev);
  if (rev === 'invalid') notFound();
  const result = loadPage(() => titleFromPathSegments(title), rev);
  if (!result?.revision) notFound(); // → not-found.tsx (T020). 없는 판도 404 (T039)

  const { page, revision } = result;
  const { html } = renderMarkup(revision.content);
  // 과거 판을 보는 중인지 (최신 판 번호를 ?rev=로 연 경우는 최신 판과 같게 보여준다)
  const latestRevNo = rev === undefined ? revision.revNo : loadPage(() => page.fullTitle)?.revision?.revNo;
  const isOld = revision.revNo !== latestRevNo;
  const canEdit = !isOld && (await canWriteTitle(page.fullTitle));

  return (
    <article>
      <header className={styles.header}>
        <h1 className={styles.title}>{page.fullTitle}</h1>
        {canEdit && (
          <nav className={styles.actions} aria-label="문서 동작">
            <Link href={titleToPath(page.fullTitle, '/edit')} className={styles.action}>
              편집
            </Link>
          </nav>
        )}
      </header>

      {isOld && (
        <p className={styles.oldRevision} role="note">
          <strong>{revision.revNo}판</strong> ({formatDateTime(revision.createdAt)}, {revision.authorName})
          입니다. 최신 판이 아닙니다. <Link href={titleToPath(page.fullTitle)}>최신 판 보기</Link>
        </p>
      )}

      {notice === 'unchanged' && (
        <p className={styles.notice} role="status">
          바뀐 내용이 없어서 저장하지 않았습니다.
        </p>
      )}

      <WikiContent html={html} />

      <footer className={styles.footer}>
        {isOld ? `${revision.revNo}판 수정:` : '마지막 수정:'}{' '}
        <time dateTime={revision.createdAt.toISOString()}>{formatDateTime(revision.createdAt)}</time>
        {' · '}
        <span>{revision.authorName}</span>
      </footer>
    </article>
  );
}
