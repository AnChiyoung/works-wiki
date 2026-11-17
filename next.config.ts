import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // better-sqlite3는 네이티브 모듈이라 번들에 넣지 않고 Node.js가 직접 불러오게 한다.
  serverExternalPackages: ['better-sqlite3', '@node-rs/argon2'],
  experimental: {
    // forbidden()/unauthorized()로 403·401 화면을 보여주기 위해 켠다.
    authInterrupts: true,
    serverActions: {
      // 문서 원문 최대 1MB(MAX_CONTENT_BYTES) + 폼 데이터 여유분
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;
