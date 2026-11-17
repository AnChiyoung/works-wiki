import { defineConfig } from 'drizzle-kit';

// 스키마를 바꾼 뒤 `npm run db:generate`로 마이그레이션 파일을 만든다.
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/server/db/schema.ts',
  out: './src/server/db/migrations',
});
