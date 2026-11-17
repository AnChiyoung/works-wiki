// 서버가 시작될 때 한 번 실행된다. 실제 작업은 Node.js 전용 파일에서 한다.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
