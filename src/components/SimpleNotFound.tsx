// 이력·차이 화면처럼 "새로 만들기"가 필요 없는 곳의 404 화면
export function SimpleNotFound({ message = '문서나 판이 없습니다.' }: { message?: string }) {
  return (
    <section>
      <h1>찾을 수 없습니다</h1>
      <p>{message}</p>
    </section>
  );
}
