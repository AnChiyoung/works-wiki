import { and, eq } from 'drizzle-orm';
import type { Db, DbOrTx } from './client';
import { migrateDatabase } from './client';
import { pages, revisions, users } from './schema';

export const SYSTEM_USERNAME = 'system';
export { MAIN_PAGE_TITLE } from '@/lib/wiki';
import { MAIN_PAGE_TITLE } from '@/lib/wiki';

const MAIN_PAGE_CONTENT = `개발 지식을 정리하는 위키입니다.

이 문서는 위키를 처음 만들 때 자동으로 생겼습니다. 자유롭게 고쳐 쓰세요.

# 문법 예시

## 제목

\`#\`의 개수로 제목의 깊이를 정하면 번호가 자동으로 붙습니다.

## 목록

- 첫 번째 깊이
  - 두 번째 깊이
    - 세 번째 깊이

1. 첫 번째
   1. 하위 항목
      1. 더 하위 항목

## 코드

\`\`\`ts
function hello(name: string) {
  return \`안녕하세요, \${name}\`;
}
\`\`\`

## 표

| 언어 | 용도 |
|---|---|
| TypeScript | 웹 |
| Go | 서버 |

> 인용문은 이렇게 씁니다.
`;

/** 내장 system 사용자를 만들고(없을 때만) id를 돌려준다. */
function ensureSystemUser(db: DbOrTx): number {
  const existing = db.select({ id: users.id }).from(users).where(eq(users.username, SYSTEM_USERNAME)).get();
  if (existing) return existing.id;
  const created = db
    .insert(users)
    .values({ username: SYSTEM_USERNAME, passwordHash: '!', role: 'system', status: 'active' })
    .returning({ id: users.id })
    .get();
  return created.id;
}

/** 대문 문서를 만든다(없을 때만). 문서 저장 서비스(T013)를 거치지 않고 1판을 직접 넣는다. */
function ensureMainPage(db: DbOrTx, authorId: number): void {
  const existing = db
    .select({ id: pages.id })
    .from(pages)
    .where(and(eq(pages.namespace, 'main'), eq(pages.title, MAIN_PAGE_TITLE)))
    .get();
  if (existing) return;

  const page = db
    .insert(pages)
    .values({ namespace: 'main', title: MAIN_PAGE_TITLE })
    .returning({ id: pages.id })
    .get();
  const size = Buffer.byteLength(MAIN_PAGE_CONTENT, 'utf8');
  const rev = db
    .insert(revisions)
    .values({
      pageId: page.id,
      revNo: 1,
      authorId,
      content: MAIN_PAGE_CONTENT,
      summary: '위키 시작',
      size,
      sizeDelta: size,
      kind: 'create',
    })
    .returning({ id: revisions.id })
    .get();
  db.update(pages).set({ latestRevId: rev.id }).where(eq(pages.id, page.id)).run();
}

/** 기본 데이터를 넣는다. 이미 있으면 건너뛰므로 여러 번 실행해도 안전하다. */
export function seedDatabase(db: Db): void {
  db.transaction((tx) => {
    const systemId = ensureSystemUser(tx);
    ensureMainPage(tx, systemId);
  });
}

/** 마이그레이션과 기본 데이터를 한 번에 적용한다. 서버 시작 시 실행된다. */
export function initDatabase(db: Db): void {
  migrateDatabase(db);
  seedDatabase(db);
}
