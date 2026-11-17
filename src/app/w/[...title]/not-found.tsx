import { MissingPage } from '@/components/MissingPage';
import { canEditM1 } from '@/server/edit-guard';

// AC-1.3: 없는 문서. 상태 코드는 404.
// not-found 화면은 주소(params)를 받지 못하므로 제목은 MissingPage가 브라우저 주소에서 읽는다.
export default function PageNotFound() {
  return <MissingPage canCreate={canEditM1()} />;
}
