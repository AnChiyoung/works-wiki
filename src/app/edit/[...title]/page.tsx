import type { Metadata } from 'next';
import { forbidden, notFound } from 'next/navigation';
import { getDb } from '@/server/db';
import { canEditM1 } from '@/server/edit-guard';
import { getPage } from '@/server/services/pages';
import { TitleError, parseTitle, titleFromPathSegments } from '@/server/services/title';
import { EditForm } from './EditForm';
import styles from './page.module.css';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ title: string[] }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  // generateMetadata의 params는 이미 디코딩되어 있다. (w/[...title]/page.tsx 주석 참고)
  const { title } = await params;
  return { title: `편집: ${title.join('/')}`, robots: { index: false } };
}

// US-2 문서 작성·편집
export default async function EditPage({ params }: Props) {
  if (!canEditM1()) forbidden(); // AC-2.1, T024

  const { title } = await params;
  let fullTitle: string;
  try {
    fullTitle = parseTitle(titleFromPathSegments(title)).fullTitle;
  } catch (error) {
    if (error instanceof TitleError || error instanceof URIError) notFound();
    throw error;
  }

  const existing = getPage(getDb(), fullTitle);
  const isNew = !existing?.revision;

  return (
    <section>
      <h1 className={styles.title}>
        {fullTitle} <span className={styles.badge}>{isNew ? '새 문서' : '편집'}</span>
      </h1>
      <EditForm
        fullTitle={fullTitle}
        initialContent={existing?.revision?.content ?? ''}
        baseRevId={existing?.revision?.id ?? null}
      />
    </section>
  );
}
