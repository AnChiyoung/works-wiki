import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const src = fileURLToPath(new URL('./src', import.meta.url));
const emptyModule = fileURLToPath(new URL('./tests/helpers/empty-module.ts', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@': src,
      // 'server-only'는 브라우저 번들에 섞이는 것을 막는 표시용 패키지라 테스트에서는 빈 모듈로 바꾼다.
      'server-only': emptyModule,
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
