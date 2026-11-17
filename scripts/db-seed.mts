// npm run db:seed — 마이그레이션을 적용하고 기본 데이터(system 사용자, 대문)를 넣는다.
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());

const { getDb } = await import('@/server/db');
const { initDatabase } = await import('@/server/db/seed');
const { getConfig } = await import('@/server/config');

initDatabase(getDb());
console.log(`기본 데이터 준비 완료: ${getConfig().dataDir}`);
