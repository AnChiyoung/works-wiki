import { describe, expect, it } from 'vitest';
import { renderMarkup } from '@/server/render/markup';

const numbers = (source: string) => renderMarkup(source).toc.map((t) => t.number);

describe('제목 자동 번호 (T015, SX-10~15)', () => {
  it('깊이에 따라 1. / 1.1. / 1.1.1. 번호를 붙인다', () => {
    expect(numbers('# 가\n## 나\n### 다\n## 라\n# 마')).toEqual(['1.', '1.1.', '1.1.1.', '1.2.', '2.']);
  });

  it('중간에 문단을 넣으면 뒤 번호가 바뀐다', () => {
    expect(numbers('# 가\n# 나')).toEqual(['1.', '2.']);
    expect(numbers('# 가\n# 새 문단\n# 나')).toEqual(['1.', '2.', '3.']);
  });

  it('단계를 건너뛰어도 빈 단계 없이 이어진다', () => {
    expect(numbers('# 가\n### 나\n### 다\n## 라')).toEqual(['1.', '1.1.', '1.2.', '1.3.']);
  });

  it('첫 제목이 ##여도 1.부터 시작한다', () => {
    expect(numbers('## 가\n### 나')).toEqual(['1.', '1.1.']);
  });

  it('6단계까지 번호를 붙인다', () => {
    expect(numbers('# a\n## b\n### c\n#### d\n##### e\n###### f').at(-1)).toBe('1.1.1.1.1.1.');
  });

  it('제목 태그는 깊이 + 1 (문서 제목이 h1이므로). 최대 h6', () => {
    const { html } = renderMarkup('# 가\n### 나\n#### 다\n##### 라\n###### 마\n###### 바');
    expect(html).toContain('<h2 id="s-1" class="wiki-heading" data-level="1">');
    expect(html).toContain('<h3 id="s-1.1" class="wiki-heading" data-level="2">');
    expect(html).toContain('<h6 id="s-1.1.1.1.1" class="wiki-heading" data-level="5">');
    expect(html).not.toContain('<h1');
  });
});

describe('목차와 고정 주소 (T015, SX-16, SX-17)', () => {
  it('제목마다 고정 주소(id)와 목차 항목을 만든다', () => {
    const { toc } = renderMarkup('# 개요\n## 설치 방법');
    expect(toc).toEqual([
      { depth: 1, number: '1.', id: 's-1', text: '개요' },
      { depth: 2, number: '1.1.', id: 's-1.1', text: '설치 방법' },
    ]);
  });

  it('제목이 2개 이상이면 첫 제목 바로 위에 목차를 넣는다', () => {
    const { html } = renderMarkup('소개 글\n\n# 개요\n# 설치');
    const intro = html.indexOf('<p>소개 글</p>');
    const nav = html.indexOf('<nav id="toc" class="toc" aria-label="목차">');
    const first = html.indexOf('<h2 id="s-1"');
    expect(intro).toBeGreaterThanOrEqual(0);
    expect(intro).toBeLessThan(nav);
    expect(nav).toBeLessThan(first);
    expect(html).toContain('<a href="#s-2">2.</a> 설치');
  });

  it('제목 번호를 누르면 목차로 간다', () => {
    const { html } = renderMarkup('# 개요\n# 설치');
    expect(html).toContain(
      '<a class="heading-number" href="#toc">1.</a> <span class="heading-text">개요</span>',
    );
  });

  it('제목이 1개면 목차를 넣지 않고, 번호도 링크가 아니다', () => {
    const { html, toc } = renderMarkup('# 하나뿐');
    expect(toc).toHaveLength(1);
    expect(html).not.toContain('<nav');
    expect(html).not.toContain('href="#toc"');
    expect(html).toContain('1.');
  });

  it('제목이 없으면 목차도 번호도 없다', () => {
    const { html, toc } = renderMarkup('그냥 글');
    expect(toc).toEqual([]);
    expect(html).toBe('<p>그냥 글</p>\n');
  });

  it('서식이 들어간 제목: 본문에는 서식을, 목차에는 글자만', () => {
    const { html, toc } = renderMarkup('# **굵은** `코드` 제목\n# 둘');
    expect(toc[0]!.text).toBe('굵은 코드 제목');
    expect(html).toContain('<strong>굵은</strong> <code>코드</code> 제목');
  });

  it('목차 글자의 HTML 기호는 글자로 보인다', () => {
    const { html } = renderMarkup('# a <b> & c\n# 둘');
    expect(html).toContain('a &lt;b&gt; &amp; c');
    expect(html).not.toContain('<b>');
  });
});

describe('정화 후에도 제목 구조가 남는다 (T015)', () => {
  it('번호 링크·글자 span의 클래스가 지워지지 않는다', () => {
    expect(renderMarkup('# 하나뿐').html).toContain('<span class="heading-number">1.</span>');
  });
});
