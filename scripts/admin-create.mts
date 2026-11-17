// npm run admin:create — 관리자 계정을 만든다 (AC-8.1).
// 비밀번호는 명령행 인자로 받지 않는다(셸 기록에 남지 않게). 입력할 때 화면에도 보이지 않는다.
import nextEnv from '@next/env';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

nextEnv.loadEnvConfig(process.cwd());

const { getDb } = await import('@/server/db');
const { initDatabase } = await import('@/server/db/seed');
const { getConfig } = await import('@/server/config');
const { checkPassword, checkUsername, createUser } = await import('@/server/services/users');

// 비밀번호를 입력하는 동안에는 키보드 입력이 화면에 되울려 나오지 않게 한다.
let muted = false;
const echo = new Writable({
  write(chunk, _encoding, callback) {
    if (!muted) process.stdout.write(chunk);
    callback();
  },
});
const isTty = Boolean(process.stdin.isTTY);
const rl = createInterface({ input: process.stdin, output: echo, terminal: isTty });
const lines = rl[Symbol.asyncIterator]();

async function ask(question: string, { hidden = false } = {}): Promise<string> {
  process.stdout.write(question);
  muted = hidden;
  const { value, done } = await lines.next();
  muted = false;
  if (hidden && isTty) process.stdout.write('\n');
  if (done) throw new Error('입력이 끝났습니다.');
  return String(value);
}

function fail(message: string): never {
  console.error(`\n관리자를 만들지 못했습니다: ${message}`);
  rl.close();
  process.exit(1);
}

try {
  const db = getDb();
  initDatabase(db);
  console.log(`관리자 계정 만들기 (DB: ${getConfig().dataDir})`);

  const username = (await ask('아이디: ')).trim();
  checkUsername(username);
  const password = await ask('비밀번호 (화면에 보이지 않습니다): ', { hidden: true });
  checkPassword(password);
  const again = await ask('비밀번호 확인: ', { hidden: true });
  if (password !== again) fail('두 비밀번호가 다릅니다.');

  const { id } = await createUser(db, { username, password, role: 'admin' });
  console.log(`\n관리자 "${username}" 계정을 만들었습니다. (id ${id})`);
  rl.close();
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
