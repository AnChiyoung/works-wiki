/** 화면 테스트 전용 계정. 빈 테스트 DB(data-test/)에만 만든다 (scripts/e2e-seed.mts). */
export const E2E_ADMIN = { username: 'e2e-admin', password: 'e2e-admin-password' } as const;

/** 관리자로 로그인한 쿠키를 저장해 두는 파일 (auth.setup.ts가 만든다, git에 올리지 않는다) */
export const ADMIN_STATE = 'playwright/.auth/admin.json';

/** 로그인하지 않은 방문자로 테스트할 때: test.use({ storageState: LOGGED_OUT }) */
export const LOGGED_OUT = { cookies: [], origins: [] };
