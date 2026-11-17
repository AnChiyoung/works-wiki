import { sql } from 'drizzle-orm';
import {
  type AnySQLiteColumn,
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

// 데이터 모델: specs/001-wiki-core/plan.md §4
// 각 테이블은 필요한 단계에서 추가한다. (M1: users, pages, revisions, settings / M2: sessions, user_permissions)

const createdAt = () =>
  integer('created_at', { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

export const USER_ROLES = ['admin', 'member', 'system'] as const;
export const USER_STATUSES = ['pending', 'active', 'blocked'] as const;

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  /** argon2id 해시. 로그인할 수 없는 계정(system)은 '!' */
  passwordHash: text('password_hash').notNull(),
  /** system: 사람이 아닌 자동 작업의 작성자. 로그인 불가 */
  role: text('role', { enum: USER_ROLES }).notNull(),
  status: text('status', { enum: USER_STATUSES }).notNull().default('active'),
  createdAt: createdAt(),
});

export const NAMESPACES = ['main', 'category', 'file', 'wiki', 'user'] as const;
export const PROTECTIONS = ['none', 'admin'] as const;

export const pages = sqliteTable(
  'pages',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    namespace: text('namespace', { enum: NAMESPACES }).notNull(),
    /** 이름공간 접두어를 뺀 정규화된 제목 */
    title: text('title').notNull(),
    /** 최신 판. 문서를 처음 만드는 트랜잭션 안에서만 잠깐 비어 있다 */
    latestRevId: integer('latest_rev_id').references((): AnySQLiteColumn => revisions.id),
    /** 넘겨주기 대상 (전체 제목). M5 */
    redirectTo: text('redirect_to'),
    protection: text('protection', { enum: PROTECTIONS }).notNull().default('none'),
    deletedAt: integer('deleted_at', { mode: 'timestamp_ms' }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('pages_namespace_title_unique').on(t.namespace, t.title)],
);

export const REVISION_KINDS = ['create', 'edit', 'move', 'revert', 'delete', 'restore'] as const;

export const revisions = sqliteTable(
  'revisions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    pageId: integer('page_id')
      .notNull()
      .references((): AnySQLiteColumn => pages.id),
    /** 문서별 판 번호 (1, 2, 3 …) */
    revNo: integer('rev_no').notNull(),
    authorId: integer('author_id')
      .notNull()
      .references(() => users.id),
    content: text('content').notNull(),
    summary: text('summary').notNull().default(''),
    /** UTF-8 바이트 수 */
    size: integer('size').notNull(),
    sizeDelta: integer('size_delta').notNull(),
    kind: text('kind', { enum: REVISION_KINDS }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('revisions_page_rev_unique').on(t.pageId, t.revNo),
    // 최근 변경 목록(M4)
    index('revisions_created_at_idx').on(t.createdAt),
  ],
);

export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

/** 로그인 세션. id는 쿠키에 담는 토큰 원문이 아니라 그 SHA-256 해시다 (plan.md §7) */
export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => [index('sessions_user_id_idx').on(t.userId)],
);

export const PERMISSIONS = ['edit', 'create', 'move', 'upload'] as const;

/** 회원별 기능 권한. 관리자는 행이 없어도 모든 권한을 가진다 */
export const userPermissions = sqliteTable(
  'user_permissions',
  {
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    permission: text('permission', { enum: PERMISSIONS }).notNull(),
    grantedBy: integer('granted_by')
      .notNull()
      .references(() => users.id),
    grantedAt: integer('granted_at', { mode: 'timestamp_ms' })
      .notNull()
      .default(sql`(unixepoch('subsec') * 1000)`),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.permission] }),
    check(
      'user_permissions_permission_check',
      sql.raw(`permission in (${PERMISSIONS.map((p) => `'${p}'`).join(', ')})`),
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type Revision = typeof revisions.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Permission = (typeof PERMISSIONS)[number];
export type Namespace = (typeof NAMESPACES)[number];
