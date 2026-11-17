// 서버가 시작될 때 한 번 실행된다. 설정이 잘못되었으면 이유를 알려주고 서버를 끈다.
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
}
