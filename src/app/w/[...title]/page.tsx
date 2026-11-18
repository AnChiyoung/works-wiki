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
  searchParams: Promise<{ notice?: string }>;
};

// 주의: Next.js 16.4에서 catch-all params는 페이지에는 인코딩된 채로(C%2B%2B),
// generateMetadata에는 디코딩된 채로(C++) 들어온다. 그래서 받는 쪽마다 처리를 다르게 한다.
// 100%, C++, C# 같은 제목의 화면 테스트(tests/e2e)가 이 동작이 바뀌면 알려준다.
function loadPage(fullTitle: () => string) {
  try {
    return getPage(getDb(), fullTitle());
  } catch (error) {
    if (error instanceof TitleError || error instanceof URIError) return null;
    throw error;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { title } = await params;
  const result = loadPage(() => title.join('/'));
  if (!result?.revision) return {};
  return {
    title: result.page.fullTitle,
    description: htmlToDescription(renderMarkup(result.revision.content).html),
  };
}

// US-1 문서 보기
export default async function WikiPage({ params, searchParams }: Props) {
  const { title } = await params;
  const result = loadPage(() => titleFromPathSegments(title));
  if (!result?.revision) notFound(); // → not-found.tsx (T020)

  const { page, revision } = result;
  const { html } = renderMarkup(revision.content);
  const { notice } = await searchParams;
  const canEdit = await canWriteTitle(page.fullTitle);

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

      {notice === 'unchanged' && (
        <p className={styles.notice} role="status">
          바뀐 내용이 없어서 저장하지 않았습니다.
        </p>
      )}

      <WikiContent html={html} />

      <footer className={styles.footer}>
        마지막 수정:{' '}
        <time dateTime={revision.createdAt.toISOString()}>{formatDateTime(revision.createdAt)}</time>
        {' · '}
        <span>{revision.authorName}</span>
      </footer>
    </article>
  );
}
