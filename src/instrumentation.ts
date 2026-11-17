// 서버가 시작될 때 한 번 실행된다.
// 1) 설정이 잘못되었으면 이유를 알려주고 서버를 끈다.
// 2) DB 마이그레이션과 기본 데이터를 적용한다. (이미 적용되어 있으면 아무것도 하지 않는다)
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { getConfig, ConfigError } = await import('@/server/config');
  try {
    getConfig();
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(`\n${error.message}\n.env.example을 참고해 값을 고친 뒤 다시 실행하세요.\n`);
      process.exit(1);
    }
    throw error;
  }

  const { getDb } = await import('@/server/db');
  const { initDatabase } = await import('@/server/db/seed');
  initDatabase(getDb());
}
