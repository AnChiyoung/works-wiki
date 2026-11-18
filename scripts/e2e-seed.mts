// 화면 테스트 전용: 빈 테스트 DB에 기본 데이터와 테스트 관리자를 넣는다.
// playwright.config.ts의 webServer 명령이 서버를 띄우기 직전에 실행한다. 실제 위키 데이터에는 쓰지 않는다.
import nextEnv from '@next/env';
import { E2E_ADMIN } from '../tests/e2e/accounts';

nextEnv.loadEnvConfig(process.cwd());

const { getDb } = await import('@/server/db');
const { initDatabase } = await import('@/server/db/seed');
const { getConfig } = await import('@/server/config');
const { createUser } = await import('@/server/services/users');

const { dataDir } = getConfig();
if (!/data-test$/.test(dataDir.replace(/[\\/]+$/, ''))) {
  console.error(`테스트 DB가 아닌 곳(${dataDir})에는 테스트 계정을 만들지 않습니다.`);
  process.exit(1);
}

const db = getDb();
initDatabase(db);
await createUser(db, { ...E2E_ADMIN, role: 'admin' });
console.log(`테스트 관리자 준비 완료: ${E2E_ADMIN.username}`);
