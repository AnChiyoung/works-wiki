import { redirect } from 'next/navigation';
import { MAIN_PAGE_TITLE } from '@/lib/wiki';
import { titleToPath } from '@/server/services/title';

// AC-1.6: 첫 화면은 대문 문서
export default function Home() {
  redirect(titleToPath(MAIN_PAGE_TITLE));
}
