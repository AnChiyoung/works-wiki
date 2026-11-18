import { MissingPage } from '@/components/MissingPage';
import { canWriteAny } from '@/server/access';

// AC-1.3: 없는 문서. 상태 코드는 404.
// not-found 화면은 주소(params)를 받지 못하므로 제목은 MissingPage가 브라우저 주소에서 읽는다.
// 그래서 "새로 만들기" 버튼은 문서를 만들 수 있는 사람인지로만 정한다. 실제 저장할 때 제목별로 다시 확인한다.
export default async function PageNotFound() {
  return <MissingPage canCreate={await canWriteAny()} />;
}
