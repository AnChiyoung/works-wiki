import { describe, expect, it } from 'vitest';
import { type Permission, userPermissions } from '@/server/db/schema';
import {
  type Actor,
  type PageTarget,
  type WikiAction,
  can,
  getUserPermissions,
} from '@/server/services/permissions';
import { createUser } from '@/server/services/users';
import { createTestDb } from '../helpers/db';

function actor(overrides: Partial<Actor> = {}): Actor {
  return { id: 2, username: 'kim', role: 'member', status: 'active', permissions: [], ...overrides };
}
const admin = actor({ id: 1, username: 'owner', role: 'admin' });
const page: PageTarget = { namespace: 'main', title: 'React', protection: 'none' };
const protectedPage: PageTarget = { ...page, protection: 'admin' };
const ALL: Permission[] = ['edit', 'create', 'move', 'upload'];
const WRITE_ACTIONS: WikiAction[] = ['edit', 'create', 'move', 'upload'];

describe('권한 판단 can() (T033, AC-2.1, plan.md §5)', () => {
  it('1. 열람은 누구나 (방문자, 차단 회원 포함)', () => {
    expect(can(null, 'view', page)).toBe(true);
    expect(can(actor({ status: 'blocked' }), 'view', protectedPage)).toBe(true);
  });

  it('2. 로그인하지 않았으면 열람 외에는 모두 거부', () => {
    for (const action of [...WRITE_ACTIONS, 'admin'] as const) expect(can(null, action, page)).toBe(false);
  });

  it('3. 관리자는 모두 허용 (보호 문서, 남의 사용자 문서, 관리 기능 포함)', () => {
    for (const action of [...WRITE_ACTIONS, 'admin'] as const) {
      expect(can(admin, action, protectedPage)).toBe(true);
      expect(can(admin, action, { namespace: 'user', title: 'kim', protection: 'none' })).toBe(true);
    }
  });

  it('4. 대기·차단 회원은 권한이 있어도 거부', () => {
    for (const status of ['pending', 'blocked'] as const) {
      for (const action of WRITE_ACTIONS) {
        expect(can(actor({ status, permissions: ALL }), action, page)).toBe(false);
      }
    }
  });

  it('4. system 사용자는 화면 권한이 없다', () => {
    expect(can(actor({ role: 'system', permissions: ALL }), 'edit', page)).toBe(false);
  });

  it('5. 관리 기능은 회원에게 거부 (권한을 다 가져도)', () => {
    expect(can(actor({ permissions: ALL }), 'admin')).toBe(false);
  });

  it('6. "관리자만 편집" 보호 문서는 권한이 있는 회원도 거부', () => {
    for (const action of ['edit', 'move'] as const) {
      expect(can(actor({ permissions: ALL }), action, protectedPage)).toBe(false);
    }
  });

  it('7. 남의 사용자 문서는 거부, 본인 문서와 그 하위 문서는 권한대로', () => {
    const editor = actor({ permissions: ['edit', 'create'] });
    const user = (title: string): PageTarget => ({ namespace: 'user', title, protection: 'none' });
    expect(can(editor, 'edit', user('lee'))).toBe(false);
    expect(can(editor, 'edit', user('lee/메모'))).toBe(false);
    expect(can(editor, 'edit', user('kimchi'))).toBe(false); // 아이디가 앞부분만 같은 경우
    expect(can(editor, 'edit', user('kim'))).toBe(true);
    expect(can(editor, 'create', user('kim/메모'))).toBe(true);
    // 본인 문서라도 권한이 없으면 거부
    expect(can(actor(), 'edit', user('kim'))).toBe(false);
  });

  it('8. 행동마다 필요한 권한이 있어야 허용', () => {
    for (const action of WRITE_ACTIONS) {
      const needed = action as Permission;
      expect(can(actor({ permissions: [needed] }), action, page)).toBe(true);
      expect(can(actor({ permissions: ALL.filter((p) => p !== needed) }), action, page)).toBe(false);
    }
  });

  it('8. 활성 회원이라도 기본 권한은 없다', () => {
    for (const action of WRITE_ACTIONS) expect(can(actor(), action, page)).toBe(false);
  });

  it('업로드처럼 문서가 없는 행동도 판단할 수 있다', () => {
    expect(can(actor({ permissions: ['upload'] }), 'upload')).toBe(true);
    expect(can(actor(), 'upload')).toBe(false);
  });
});

describe('회원 권한 읽기 (T033)', () => {
  it('DB에 준 권한만 돌려준다', async () => {
    const { db } = createTestDb();
    const owner = await createUser(db, { username: 'owner', password: 'long-enough-1', role: 'admin' });
    const kim = await createUser(db, { username: 'kim', password: 'long-enough-1', role: 'member' });
    expect(getUserPermissions(db, kim.id)).toEqual([]);
    db.insert(userPermissions)
      .values([
        { userId: kim.id, permission: 'edit', grantedBy: owner.id },
        { userId: kim.id, permission: 'upload', grantedBy: owner.id },
      ])
      .run();
    expect(getUserPermissions(db, kim.id).sort()).toEqual(['edit', 'upload']);
    expect(getUserPermissions(db, owner.id)).toEqual([]);
  });
});
