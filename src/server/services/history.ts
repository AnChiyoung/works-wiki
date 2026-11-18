import { and, desc, eq, lt } from 'drizzle-orm';
import type { DbOrTx } from '@/server/db/client';
import { type Revision, pages, revisions, users } from '@/server/db/schema';
import type { PageInfo } from './pages';
import { parseTitle, toFullTitle } from './title';

// 문서 이력 (AC-4.1). 목록에는 원문을 넣지 않는다.

export const HISTORY_PAGE_SIZE = 50;

export type RevisionSummary = Pick<
  Revision,
  'id' | 'revNo' | 'summary' | 'size' | 'sizeDelta' | 'kind' | 'createdAt'
> & { authorName: string };

export type RevisionList = {
  page: Pick<PageInfo, 'id' | 'namespace' | 'title' | 'fullTitle'>;
  /** 최신순 */
  items: RevisionSummary[];
  /** 다음 쪽을 읽을 때 `before`로 넘길 판 번호. 더 없으면 null */
  nextBefore: number | null;
};

/** 문서의 판 목록을 최신순으로. `before`를 주면 그 판 번호보다 앞선 판부터. 없는 문서면 null. */
export function listRevisions(
  db: DbOrTx,
  fullTitle: string,
  { limit = HISTORY_PAGE_SIZE, before }: { limit?: number; before?: number } = {},
): RevisionList | null {
  const { namespace, title } = parseTitle(fullTitle);
  const page = db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.namespace, namespace), eq(pages.title, title)))
    .get();
  if (!page) return null;

  // 다음 쪽이 있는지 알기 위해 하나 더 읽는다
  const rows = db
    .select({
      id: revisions.id,
      revNo: revisions.revNo,
      summary: revisions.summary,
      size: revisions.size,
      sizeDelta: revisions.sizeDelta,
      kind: revisions.kind,
      createdAt: revisions.createdAt,
      authorName: users.username,
    })
    .from(revisions)
    .innerJoin(users, eq(users.id, revisions.authorId))
    .where(
      before === undefined
        ? eq(revisions.pageId, page.id)
        : and(eq(revisions.pageId, page.id), lt(revisions.revNo, before)),
    )
    .orderBy(desc(revisions.revNo))
    .limit(limit + 1)
    .all();

  const items = rows.slice(0, limit);
  return {
    page: { id: page.id, namespace, title, fullTitle: toFullTitle(namespace, title) },
    items,
    nextBefore: rows.length > limit ? (items.at(-1)?.revNo ?? null) : null,
  };
}
