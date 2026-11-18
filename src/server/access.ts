import 'server-only';
import { cache } from 'react';
import { getCurrentUser } from '@/server/current-user';
import { getDb } from '@/server/db';
import { getPage } from '@/server/services/pages';
import { type Actor, can, canWritePage, getUserPermissions } from '@/server/services/permissions';
import { parseTitle } from '@/server/services/title';

// 화면·서버 액션·API에서 쓰는 권한 확인 (AC-2.1). 규칙 자체는 services/permissions.ts의 can()에 있다.

/** 지금 요청의 사용자와 권한 목록. 권한은 요청마다 DB에서 읽는다(바뀐 권한이 바로 적용되게). */
export const getActor = cache(async (): Promise<Actor | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  return { ...user, permissions: getUserPermissions(getDb(), user.id) };
});

/** 이 제목의 문서를 저장(편집·새로 만들기)할 수 있는지. 쓸 수 없는 제목이면 TitleError. */
export async function canWriteTitle(fullTitle: string): Promise<boolean> {
  const actor = await getActor();
  if (!actor) return false;
  const { namespace, title } = parseTitle(fullTitle);
  const existing = getPage(getDb(), fullTitle);
  return canWritePage(
    actor,
    { namespace, title },
    existing ? { protection: existing.page.protection, hasRevision: existing.revision !== null } : null,
  );
}

/**
 * 문서를 하나라도 만들거나 고칠 수 있는 사람인지. 미리보기 API처럼 특정 문서와 상관없는 곳,
 * 그리고 제목을 알 수 없는 "문서가 없습니다" 화면에서 쓴다. 실제 저장은 canWriteTitle로 다시 확인한다.
 */
export async function canWriteAny(): Promise<boolean> {
  const actor = await getActor();
  return can(actor, 'edit') || can(actor, 'create');
}
