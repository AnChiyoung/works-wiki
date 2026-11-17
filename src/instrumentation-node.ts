// 서버 시작 시 Node.js 런타임에서만 실행된다.
// 1) 설정이 잘못되었으면 이유를 알려주고 서버를 끈다.
// 2) DB 마이그레이션과 기본 데이터를 적용한다. (이미 적용되어 있으면 아무것도 하지 않는다)
import { ConfigError, getConfig } from '@/server/config';
import { getDb } from '@/server/db';
import { initDatabase } from '@/server/db/seed';

try {
  getConfig();
} catch (error) {
  if (error instanceof ConfigError) {
    console.error(`\n${error.message}\n.env.example을 참고해 값을 고친 뒤 다시 실행하세요.\n`);
    process.exit(1);
  }
  throw error;
}

initDatabase(getDb());
