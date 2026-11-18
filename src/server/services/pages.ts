import { and, eq, max } from 'drizzle-orm';
import type { DbOrTx } from '@/server/db/client';
import { type Namespace, type Revision, pages, revisions, users } from '@/server/db/schema';
import { parseTitle, toFullTitle } from './title';

// 문서 조회·저장. 함수마다 db를 인자로 받아서 테스트에서는 메모리 DB를, 앱에서는 getDb()를 넘긴다.

/** 문서 원문 최대 크기 (UTF-8 바이트) */
export const MAX_CONTENT_BYTES = 1_000_000;
export const MAX_SUMMARY_LENGTH = 200;

export type ContentErrorCode = 'empty' | 'too_large';

export class ContentError extends Error {
  constructor(public readonly code: ContentErrorCode) {
    super(
      code === 'empty'
        ? '내용이 비어 있습니다.'
        : `문서가 너무 큽니다. (최대 ${MAX_CONTENT_BYTES.toLocaleString('ko-KR')}바이트)`,
    );
    this.name = 'ContentError';
  }
}

export type PageInfo = {
  id: number;
  namespace: Namespace;
  title: string;
  fullTitle: string;
  protection: 'none' | 'admin';
  redirectTo: string | null;
  deletedAt: Date | null;
};

export type RevisionInfo = Pick<
  Revision,
  'id' | 'revNo' | 'content' | 'summary' | 'size' | 'sizeDelta' | 'kind' | 'createdAt'
> & { authorName: string };

export type PageWithRevision = {
  page: PageInfo;
  /** 요청한 판이 없으면 null */
  revision: RevisionInfo | null;
};

/** 줄바꿈을 LF로 통일한다. 브라우저 입력창은 CRLF로 보내기 때문에, 같은 내용인지 비교하려면 필요하다. */
export function normalizeContent(content: string): string {
  return content.replace(/\r\n?/g, '\n');
}

function byteLength(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

/**
 * 문서와 판(기본: 최신 판)을 조회한다. 문서가 없으면 null.
 * 제목은 parseTitle로 정규화하므로, 쓸 수 없는 제목이면 TitleError가 난다.
 */
export function getPage(
  db: DbOrTx,
  fullTitle: string,
  options: { rev?: number } = {},
): PageWithRevision | null {
  const { namespace, title } = parseTitle(fullTitle);
  const page = db
    .select()
    .from(pages)
    .where(and(eq(pages.namespace, namespace), eq(pages.title, title)))
    .get();
  if (!page) return null;

  const revisionCondition =
    options.rev === undefined
      ? eq(revisions.id, page.latestRevId ?? -1)
      : and(eq(revisions.pageId, page.id), eq(revisions.revNo, options.rev));

  const row = db
    .select({
      id: revisions.id,
      revNo: revisions.revNo,
      content: revisions.content,
      summary: revisions.summary,
      size: revisions.size,
      sizeDelta: revisions.sizeDelta,
      kind: revisions.kind,
      createdAt: revisions.createdAt,
      authorName: users.username,
    })
    .from(revisions)
    .innerJoin(users, eq(users.id, revisions.authorId))
    .where(revisionCondition)
    .get();

  return {
    page: {
      id: page.id,
      namespace: page.namespace,
      title: page.title,
      fullTitle: toFullTitle(page.namespace, page.title),
      protection: page.protection,
      redirectTo: page.redirectTo,
      deletedAt: page.deletedAt,
    },
    revision: row ?? null,
  };
}

export type SavePageInput = {
  fullTitle: string;
  content: string;
  summary?: string;
  authorId: number;
  /** 편집을 시작할 때의 최신 판 id. 편집 충돌 검사(M3, AC-2.5)에서 쓴다 */
  baseRevId?: number | null;
  /** 판의 종류. 생략하면 새 문서는 create, 있는 문서는 edit. 되돌리기(revert.ts)가 'revert'를 넘긴다 */
  kind?: 'revert';
};

export type SavePageResult = {
  pageId: number;
  fullTitle: string;
  /** false면 내용이 같아서 새 판을 만들지 않았다 */
  changed: boolean;
  revNo: number;
};

/**
 * 문서를 저장한다. 하나의 트랜잭션에서
 * 문서가 없으면 만들고 1판(create)을, 있으면 다음 판(edit)을 추가하고 최신 판을 갱신한다.
 * 최신 판과 내용이 같으면 아무것도 바꾸지 않는다.
 */
export function savePage(db: DbOrTx, input: SavePageInput): SavePageResult {
  const { namespace, title } = parseTitle(input.fullTitle);
  const content = normalizeContent(input.content);
  const summary = (input.summary ?? '').trim().slice(0, MAX_SUMMARY_LENGTH);

  if (content.trim() === '') throw new ContentError('empty');
  const size = byteLength(content);
  if (size > MAX_CONTENT_BYTES) throw new ContentError('too_large');

  return db.transaction((tx) => {
    const existing = tx
      .select({ id: pages.id, latestRevId: pages.latestRevId })
      .from(pages)
      .where(and(eq(pages.namespace, namespace), eq(pages.title, title)))
      .get();

    const latest = existing?.latestRevId
      ? tx
          .select({ content: revisions.content, size: revisions.size, revNo: revisions.revNo })
          .from(revisions)
          .where(eq(revisions.id, existing.latestRevId))
          .get()
      : undefined;

    if (existing && latest && latest.content === content) {
      return {
        pageId: existing.id,
        fullTitle: toFullTitle(namespace, title),
        changed: false,
        revNo: latest.revNo,
      };
    }

    const pageId =
      existing?.id ?? tx.insert(pages).values({ namespace, title }).returning({ id: pages.id }).get().id;

    const lastRevNo =
      tx
        .select({ value: max(revisions.revNo) })
        .from(revisions)
        .where(eq(revisions.pageId, pageId))
        .get()?.value ?? 0;
    const revNo = lastRevNo + 1;

    const rev = tx
      .insert(revisions)
      .values({
        pageId,
        revNo,
        authorId: input.authorId,
        content,
        summary,
        size,
        sizeDelta: size - (latest?.size ?? 0),
        kind: input.kind ?? (existing ? 'edit' : 'create'),
      })
      .returning({ id: revisions.id })
      .get();

    tx.update(pages).set({ latestRevId: rev.id }).where(eq(pages.id, pageId)).run();

    return { pageId, fullTitle: toFullTitle(namespace, title), changed: true, revNo };
  });
}
