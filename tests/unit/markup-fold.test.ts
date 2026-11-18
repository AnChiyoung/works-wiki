import { describe, expect, it } from 'vitest';
import { extractWikiData, renderMarkup } from '@/server/render/markup';
import { sanitize } from '@/server/render/sanitize';

const html = (source: string) => renderMarkup(source).html;

/** 비교하기 쉽게 줄바꿈을 지운다 */
const flat = (out: string) => out.replace(/\n/g, '');

describe('접기 상자 (T053, SX-40~43)', () => {
  it('SX-40 ::: 접기 제목 … ::: 는 처음에 접힌 상자', () => {
    expect(flat(html('::: 접기 줄거리 보기\n내용\n:::'))).toBe(
      '<details class="wiki-fold"><summary>줄거리 보기</summary><div class="wiki-fold-body"><p>내용</p></div></details>',
    );
  });

  it('SX-41 ::: 펼침 제목 은 처음에 펼쳐진 상자', () => {
    expect(flat(html('::: 펼침 열린 상자\n내용\n:::'))).toBe(
      '<details class="wiki-fold" open><summary>열린 상자</summary><div class="wiki-fold-body"><p>내용</p></div></details>',
    );
  });

  it('SX-42 제목을 생략하면 "펼치기"', () => {
    expect(html('::: 접기\n내용\n:::')).toContain('<summary>펼치기</summary>');
    expect(html(':::펼침   \n내용\n:::')).toContain('<summary>펼치기</summary>');
  });

  it('제목에는 인라인 문법을 쓸 수 있고, HTML은 글자로 보인다', () => {
    expect(html('::: 접기 **굵은** 제목\n내용\n:::')).toContain(
      '<summary><strong>굵은</strong> 제목</summary>',
    );
    expect(html('::: 접기 <b>x</b>\n내용\n:::')).toContain('<summary>&lt;b&gt;x&lt;/b&gt;</summary>');
  });

  it('안쪽 마크다운과 위키 링크가 렌더링되고 링크 목록에 들어간다', () => {
    const source = '::: 접기 제목\n**마크다운**과 [[링크]]\n\n- 목록\n\n```\ncode\n```\n:::';
    const out = html(source);
    expect(out).toMatch(
      /<div class="wiki-fold-body">\s*<p><strong>마크다운<\/strong>과 <a [^>]*>링크<\/a><\/p>/,
    );
    expect(out).toContain('<ul>');
    expect(out).toContain('<pre><code>code');
    expect(extractWikiData(source).links).toEqual(['링크']);
  });

  it('SX-43 바깥보다 콜론을 하나 더 쓰면 겹쳐 쓸 수 있다', () => {
    const out = flat(html('::: 접기 바깥\n앞\n:::: 펼침 안쪽\n안\n::::\n뒤\n:::\n밖'));
    expect(out).toBe(
      '<details class="wiki-fold"><summary>바깥</summary><div class="wiki-fold-body"><p>앞</p>' +
        '<details class="wiki-fold" open><summary>안쪽</summary><div class="wiki-fold-body"><p>안</p></div></details>' +
        '<p>뒤</p></div></details><p>밖</p>',
    );
  });

  it('닫는 줄은 여는 줄과 콜론 수가 같아야 한다', () => {
    // 안쪽의 :::: 는 바깥 ::: 를 닫지 않는다
    const out = flat(html('::: 접기 상자\n가\n::::\n나\n:::\n다'));
    expect(out).toBe(
      '<details class="wiki-fold"><summary>상자</summary><div class="wiki-fold-body"><p>가::::나</p></div></details><p>다</p>',
    );
  });

  it('닫는 줄이 없으면 문서 끝까지 상자가 된다', () => {
    expect(flat(html('앞\n\n::: 접기 끝까지\n가\n\n나'))).toBe(
      '<p>앞</p><details class="wiki-fold"><summary>끝까지</summary><div class="wiki-fold-body"><p>가</p><p>나</p></div></details>',
    );
  });

  it('빈 상자도 만들 수 있다', () => {
    expect(flat(html('::: 접기 빈 상자\n:::'))).toBe(
      '<details class="wiki-fold"><summary>빈 상자</summary><div class="wiki-fold-body"></div></details>',
    );
  });

  it('문단 바로 다음 줄에서도 상자를 시작한다', () => {
    expect(flat(html('문단\n::: 접기 상자\n내용\n:::'))).toBe(
      '<p>문단</p><details class="wiki-fold"><summary>상자</summary><div class="wiki-fold-body"><p>내용</p></div></details>',
    );
  });

  it('목록 안에서도 쓸 수 있다', () => {
    expect(flat(html('- 항목\n  ::: 접기 상자\n  내용\n  :::\n- 다음'))).toContain(
      '<li>항목<details class="wiki-fold"><summary>상자</summary><div class="wiki-fold-body"><p>내용</p></div></details></li>',
    );
  });

  it('접기·펼침이 아니거나 콜론이 모자라면 글자 그대로', () => {
    expect(html('::: 경고 조심\n내용\n:::')).toBe('<p>::: 경고 조심\n내용\n:::</p>\n');
    expect(html(':: 접기 제목')).toBe('<p>:: 접기 제목</p>\n');
    expect(html('::: 접기제목')).toBe('<p>::: 접기제목</p>\n');
    expect(html('```\n::: 접기 코드\n```')).toBe('<pre><code>::: 접기 코드\n</code></pre>\n');
  });

  it('상자 안의 제목도 번호와 목차에 들어간다', () => {
    const result = renderMarkup('## 바깥 제목\n::: 접기 상자\n## 안쪽 제목\n:::');
    expect(result.toc.map((t) => t.text)).toEqual(['바깥 제목', '안쪽 제목']);
  });

  it('정화 단계는 details·summary의 정해진 속성만 남긴다', () => {
    expect(
      sanitize(
        '<details class="wiki-fold evil" open ontoggle="alert(1)"><summary onclick="x">a</summary></details>',
      ),
    ).toBe('<details class="wiki-fold" open><summary>a</summary></details>');
    expect(sanitize('<div class="wiki-fold-body" style="x" id="y">b</div>')).toBe(
      '<div class="wiki-fold-body">b</div>',
    );
  });
});
