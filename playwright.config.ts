import { defineConfig, devices } from '@playwright/test';

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
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    // 매번 빈 테스트 데이터로 시작한다
    command: `node -e "require('fs').rmSync('data-test',{recursive:true,force:true})" && npx next dev --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // 테스트는 실제 위키 데이터(data/)를 건드리지 않도록 별도 폴더를 쓴다.
      DATA_DIR: './data-test',
      WIKI_OPEN_EDIT: 'true',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
