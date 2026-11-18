'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logoutAction } from '@/app/login/actions';
import styles from './SiteHeader.module.css';

/** 상단바 오른쪽: 로그인 전에는 "로그인" 링크, 로그인 후에는 아이디와 "로그아웃" 버튼 (T034) */
export function AccountMenu({ username }: { username: string | null }) {
  const pathname = usePathname();

  if (!username) {
    const href = pathname === '/login' ? '/login' : `/login?next=${encodeURIComponent(pathname)}`;
    return (
      <Link href={href} className={styles.account}>
        로그인
      </Link>
    );
  }

  return (
    <form action={logoutAction} className={styles.accountForm}>
      <input type="hidden" name="next" value={pathname} />
      <span className={styles.username}>{username}</span>
      <button type="submit" className={styles.logout}>
        로그아웃
      </button>
    </form>
  );
}
