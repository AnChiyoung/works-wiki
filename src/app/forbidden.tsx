// forbidden()을 부르면 보이는 화면. 상태 코드 403.
export default function Forbidden() {
  return (
    <section>
      <h1>권한이 없습니다</h1>
      <p>이 기능을 쓸 권한이 없습니다.</p>
    </section>
  );
}
