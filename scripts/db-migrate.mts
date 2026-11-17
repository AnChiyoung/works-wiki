// npm run db:migrate — DATA_DIR/wiki.db에 아직 적용하지 않은 마이그레이션을 적용한다.
import nextEnv from '@next/env';

// Next.js와 같은 규칙으로 .env.local 등을 읽는다.
nextEnv.loadEnvConfig(process.cwd());

const { getDb } = await import('@/server/db');
const { migrateDatabase } = await import('@/server/db/client');
const { getConfig } = await import('@/server/config');

migrateDatabase(getDb());
console.log(`마이그레이션 완료: ${getConfig().dataDir}`);
