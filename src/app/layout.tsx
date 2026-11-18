import type { Metadata, Viewport } from 'next';
import { SiteHeader } from '@/components/SiteHeader';
import { getConfig } from '@/server/config';
import { getCurrentUser } from '@/server/current-user';
import '@/styles/globals.css';
import '@/styles/wiki-content.css';
import styles from './layout.module.css';

// 위키 이름 등 설정값을 빌드할 때가 아니라 요청할 때 읽도록 한다. (.env.local을 바꾸고 재시작만 하면 반영)
export const dynamic = 'force-dynamic';

export function generateMetadata(): Metadata {
  const { wikiName } = getConfig();
  return {
    title: { default: wikiName, template: `%s - ${wikiName}` },
    description: '개발 지식을 정리하는 위키',
  };
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <html lang="ko">
      <body>
        <SiteHeader wikiName={getConfig().wikiName} username={user?.username ?? null} />
        <main className={styles.main}>{children}</main>
      </body>
    </html>
  );
}
