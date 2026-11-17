import { describe, expect, it } from 'vitest';
import { renderMarkup } from '@/server/render/markup';

const html = (source: string) => renderMarkup(source).html;

describe('기본 마크다운 (T014, SX-1~9)', () => {
  it('SX-1 굵게', () => {
    expect(html('**굵게**')).toContain('<strong>굵게</strong>');
  });

  it('SX-2 기울임', () => {
    expect(html('*기울임*')).toContain('<em>기울임</em>');
  });

  it('SX-3 취소선', () => {
    expect(html('~~취소선~~')).toContain('<s>취소선</s>');
  });

  it('SX-4 인라인 코드 (안의 기호는 글자로)', () => {
    expect(html('`a < b`')).toContain('<code>a &lt; b</code>');
  });

  it('SX-5 인용', () => {
    expect(html('> 인용')).toMatch(/<blockquote>\s*<p>인용<\/p>\s*<\/blockquote>/);
  });

  it('SX-6 코드 블록 (언어 표시, 안의 HTML은 글자로)', () => {
    const out = html('```ts\nconst a = "<b>";\n```');
    expect(out).toContain('<pre><code class="language-ts">');
    expect(out).toContain('&lt;b&gt;');
    expect(out).not.toContain('<b>');
  });

  it('SX-7 가로 구분선', () => {
    expect(html('위\n\n---\n\n아래')).toContain('<hr />');
  });

  it('SX-8 외부 링크는 새 탭에서 열리고 외부 링크 표시가 붙는다', () => {
    const out = html('[예시](https://example.com/a?b=1)');
    expect(out).toContain('href="https://example.com/a?b=1"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
    expect(out).toContain('class="external"');
  });

  it('SX-8 위키 안쪽 링크는 같은 탭에서 열린다', () => {
    const out = html('[대문](/w/대문)');
    expect(out).toContain('href="/w/%EB%8C%80%EB%AC%B8"');
    expect(out).not.toContain('target=');
  });

  it('SX-9 표 (정렬 포함)', () => {
    const out = html('| 언어 | 점수 |\n|:---|---:|\n| TS | 10 |');
    expect(out).toContain('<table>');
    expect(out).toContain('<th style="text-align:left">언어</th>');
    expect(out).toContain('<td style="text-align:right">10</td>');
  });

  it('외부 이미지는 https 주소만 넣는다', () => {
    expect(html('![로고](https://example.com/a.png)')).toContain(
      '<img src="https://example.com/a.png" alt="로고"',
    );
  });

  it('단락과 목록', () => {
    const out = html('첫 줄\n\n- 하나\n- 둘');
    expect(out).toContain('<p>첫 줄</p>');
    expect(out).toMatch(/<ul>\s*<li>하나<\/li>\s*<li>둘<\/li>\s*<\/ul>/);
  });
});

describe('안전 규칙 (T014, SX-46~48)', () => {
  it.each([
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<iframe src="https://evil.example"></iframe>',
    '<a href="https://example.com" onclick="alert(1)">x</a>',
    '<div style="position:fixed">x</div>',
  ])('SX-46 HTML 태그는 글자로 보인다: %s', (source) => {
    const out = html(source);
    expect(out).not.toMatch(/<(script|img|iframe|a|div)[\s>]/);
    expect(out).toContain('&lt;');
  });

  it.each([
    '[x](javascript:alert(1))',
    '[x](JaVaScRiPt:alert(1))',
    '[x](data:text/html,<b>x</b>)',
    '[x](vbscript:msgbox)',
  ])('SX-47 위험한 주소는 링크가 되지 않는다: %s', (source) => {
    const out = html(source);
    expect(out).not.toMatch(/href="\s*(javascript|data|vbscript):/i);
    expect(out).not.toContain('<a ');
  });

  it('SX-47 위험한 주소의 이미지는 넣지 않는다', () => {
    expect(html('![x](javascript:alert(1))')).not.toContain('<img');
    expect(html('![x](http://example.com/a.png)')).not.toContain('<img');
  });

  it('SX-48 사용자가 class, style, id를 직접 넣을 수 없다', () => {
    const out = html('<span class="x" style="color:red" id="y">글자</span>');
    expect(out).not.toMatch(/<span/);
  });
});

describe('번호 목록 (SX-20)', () => {
  it('쓴 숫자와 상관없이 1부터 매긴다 (start 속성을 넣지 않는다)', () => {
    const out = renderMarkup('3. 셋\n7. 일곱').html;
    expect(out).toContain('<ol>');
    expect(out).not.toContain('start=');
  });
});
