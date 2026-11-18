import Link from 'next/link';
import { MAIN_PAGE_TITLE } from '@/lib/wiki';
import { titleToPath } from '@/server/services/title';
import { AccountMenu } from './AccountMenu';
import styles from './SiteHeader.module.css';

export function SiteHeader({ wikiName, username }: { wikiName: string; username: string | null }) {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href={titleToPath(MAIN_PAGE_TITLE)} className={styles.brand}>
          {wikiName}
        </Link>
        {/* 검색은 M4에서 동작한다 */}
        <form className={styles.search} role="search" action="/search">
          <input
            type="search"
            name="q"
            placeholder="검색 (준비 중)"
            aria-label="문서 검색"
            disabled
            className={styles.searchInput}
          />
        </form>
        <AccountMenu username={username} />
      </div>
    </header>
  );
}
