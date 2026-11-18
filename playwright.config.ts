import { defineConfig, devices } from '@playwright/test';
import { ADMIN_STATE } from './tests/e2e/accounts';

const PORT = 3100;
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  projects: [
    // 관리자로 한 번 로그인해서 쿠키를 저장한다 (tests/e2e/auth.setup.ts)
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], storageState: ADMIN_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 7'], storageState: ADMIN_STATE },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    // 매번 빈 테스트 데이터로 시작하고, 테스트 관리자를 만든 뒤 서버를 띄운다
    command: `node -e "require('fs').rmSync('data-test',{recursive:true,force:true})" && npx tsx --conditions=react-server scripts/e2e-seed.mts && npx next dev --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // 테스트는 실제 위키 데이터(data/)를 건드리지 않도록 별도 폴더를 쓴다.
      DATA_DIR: './data-test',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
