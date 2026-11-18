import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { safeRedirectPath } from '@/lib/redirect';
import { getCurrentUser } from '@/server/current-user';
import { LoginForm } from './LoginForm';
import styles from './page.module.css';

export const metadata: Metadata = { title: '로그인', robots: { index: false } };

type Props = { searchParams: Promise<{ next?: string | string[] }> };

export default async function LoginPage({ searchParams }: Props) {
  const { next: rawNext } = await searchParams;
  const next = safeRedirectPath(Array.isArray(rawNext) ? rawNext[0] : rawNext);
  // 이미 로그인했으면 돌아갈 곳으로 바로 보낸다
  if (await getCurrentUser()) redirect(next);

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>로그인</h1>
      <LoginForm next={next} />
    </div>
  );
}
