import 'server-only';
import { getConfig } from './config';

// M1 임시 편집 규칙 (T024). 로그인이 없으므로 WIKI_OPEN_EDIT=true일 때만 편집을 허용한다.
// 서버는 127.0.0.1에서만 접속되게 띄운다(package.json의 dev/start).
// M2에서 can()으로 교체
export function canEditM1(): boolean {
  return getConfig().openEdit;
}
