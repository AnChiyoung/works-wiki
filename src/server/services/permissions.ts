import { eq } from 'drizzle-orm';
import type { DbOrTx } from '@/server/db/client';
import { type Namespace, type Permission, type User, userPermissions } from '@/server/db/schema';

// 권한 판단: plan.md §5 "권한 판단". 모든 규칙은 이 파일의 can() 하나에 모은다.

export type WikiAction = 'view' | Permission | 'admin';

/** 판단에 필요한 사용자 정보. 권한 목록은 요청마다 DB에서 읽어 넘긴다(바뀐 권한이 바로 적용되게). */
export type Actor = Pick<User, 'id' | 'username' | 'role' | 'status'> & {
  permissions: readonly Permission[];
};

export type PageTarget = {
  namespace: Namespace;
  /** 이름공간 접두어를 뺀 제목 */
  title: string;
  protection: 'none' | 'admin';
};

/** `사용자:아이디` 또는 그 하위 문서 `사용자:아이디/…` */
function isOwnUserPage(actor: Actor, page: PageTarget): boolean {
  return page.title === actor.username || page.title.startsWith(`${actor.username}/`);
}

/** 순수 함수. 판단 순서는 plan.md §5의 1~8단계를 그대로 따른다. */
export function can(actor: Actor | null, action: WikiAction, page?: PageTarget): boolean {
  // 1. 열람·검색·이력 보기는 누구나
  if (action === 'view') return true;
  // 2. 로그인하지 않았음
  if (!actor) return false;
  // 3. 관리자
  if (actor.role === 'admin') return true;
  // 4. 활성 회원이 아님 (system 사용자도 화면 권한은 없다)
  if (actor.role !== 'member' || actor.status !== 'active') return false;
  // 5. 관리 기능
  if (action === 'admin') return false;
  if (page) {
    // 6. 관리자만 편집으로 보호된 문서
    if (page.protection === 'admin') return false;
    // 7. 남의 사용자 문서
    if (page.namespace === 'user' && !isOwnUserPage(actor, page)) return false;
  }
  // 8. 행동에 필요한 권한
  return actor.permissions.includes(action);
}

/** 회원이 가진 기능별 권한 목록 */
export function getUserPermissions(db: DbOrTx, userId: number): Permission[] {
  return db
    .select({ permission: userPermissions.permission })
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId))
    .all()
    .map((row) => row.permission);
}
