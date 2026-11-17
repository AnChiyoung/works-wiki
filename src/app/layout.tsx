import type { Metadata } from 'next';
import '@/styles/globals.css';
import '@/styles/wiki-content.css';

export const metadata: Metadata = {
  title: '개발 위키',
  description: '개발 지식을 정리하는 위키',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
