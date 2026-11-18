import { describe, expect, it } from 'vitest';
import { extractWikiData, renderMarkup } from '@/server/render/markup';

type Anchor = { href: string; className: string; title: string; text: string; inner: string };

/** 렌더링 결과에서 위키 링크(<a class="wiki-link…">)만 뽑는다 */
function wikiLinks(source: string, existingTitles?: Iterable<string>): Anchor[] {
  const { html } = renderMarkup(source, existingTitles ? { existingTitles: new Set(existingTitles) } : {});
  return [...html.matchAll(/<a ([^>]*)>(.*?)<\/a>/g)]
    .map(([, attrs, inner]) => {
      const attr = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(attrs!)?.[1] ?? '';
      return {
        href: attr('href'),
        className: attr('class'),
        title: attr('title'),
        inner: inner!,
        text: inner!.replace(/<[^>]+>/g, ''),
      };
    })
    .filter((a) => a.className.split(' ').includes('wiki-link'));
}

const path = (title: string) => `/w/${title.split('/').map(encodeURIComponent).join('/')}`;

describe('위키 링크 (T049, SX-22~25)', () => {
  it('SX-22 [[문서]]는 그 문서로 가는 링크', () => {
    expect(wikiLinks('[[대한민국]]을 보라')).toEqual([
      {
        href: path('대한민국'),
        className: 'wiki-link',
        title: '대한민국',
        text: '대한민국',
        inner: '대한민국',
      },
    ]);
  });

  it('SX-23 [[문서|보이는 글]], 보이는 글 안의 서식도 렌더링한다', () => {
    const [link] = wikiLinks('[[대한민국|우리 **나라**]]');
    expect(link).toMatchObject({ href: path('대한민국'), title: '대한민국', text: '우리 나라' });
    expect(link!.inner).toBe('우리 <strong>나라</strong>');
  });

  it('SX-24 [[문서#문단]]은 그 문서의 문단 주소로', () => {
    const [link] = wikiLinks('[[서울특별시#역사]]');
    expect(link).toMatchObject({
      href: `${path('서울특별시')}#${encodeURIComponent('역사')}`,
      title: '서울특별시',
      text: '서울특별시#역사',
    });
  });

  it('[[#문단]]은 같은 문서 안의 문단으로', () => {
    const [link] = wikiLinks('[[#역사]]');
    expect(link).toMatchObject({ href: `#${encodeURIComponent('역사')}`, text: '역사' });
  });

  it('SX-24a 제목의 #은 \\#로 쓴다', () => {
    expect(wikiLinks(String.raw`[[C\#]]`)[0]).toMatchObject({ href: path('C#'), title: 'C#', text: 'C#' });
    expect(wikiLinks(String.raw`[[C\#|C샵]]`)[0]).toMatchObject({ href: path('C#'), text: 'C샵' });
    expect(wikiLinks(String.raw`[[C\##문법]]`)[0]).toMatchObject({
      href: `${path('C#')}#${encodeURIComponent('문법')}`,
      title: 'C#',
      text: 'C##문법',
    });
  });

  it.each(['C/C++', 'Node.js', '.NET', 'F#', '100%'])('AC-3.10 특수문자 제목 %s', (title) => {
    const source = `[[${title.replace('#', String.raw`\#`)}]]`;
    expect(wikiLinks(source)[0]).toMatchObject({ href: path(title), title, text: title });
  });

  it('제목은 정규화한다 (앞뒤·연속 공백)', () => {
    expect(wikiLinks('[[  서울   특별시 ]]')[0]).toMatchObject({
      href: path('서울 특별시'),
      title: '서울 특별시',
    });
  });

  it('SX-25 없는 문서로 가는 링크는 빨간 링크', () => {
    const links = wikiLinks('[[있는 문서]] [[없는 문서]] [[ 있는  문서 ]]', ['있는 문서']);
    expect(links.map((l) => [l.className, l.title])).toEqual([
      ['wiki-link', '있는 문서'],
      ['wiki-link new', '없는 문서 (없는 문서)'],
      ['wiki-link', '있는 문서'],
    ]);
    // 없는 문서도 그 문서 주소로 간다. 문서 화면이 "새로 만들기"를 보여준다 (AC-1.3)
    expect(links[1]!.href).toBe(path('없는 문서'));
  });

  it('있는 문서 목록을 넘기지 않으면 모두 있는 문서로 본다', () => {
    expect(wikiLinks('[[아무 문서]]')[0]!.className).toBe('wiki-link');
  });

  it('[[:분류:이름]]은 분류에 넣지 않고 분류 페이지로 가는 링크 (SX-27)', () => {
    const result = renderMarkup('[[:분류:도시]]');
    expect(result.categories).toEqual([]);
    expect(wikiLinks('[[:분류:도시]]')[0]).toMatchObject({ href: path('분류:도시'), text: '분류:도시' });
  });

  it.each(['[[]]', '[[a/../b]]', '[[/앞 슬래시]]', '[[ ]]', '[[가\n나]]', '[[닫지 않음'])(
    '쓸 수 없는 제목·모양이면 링크가 아니라 글자로: %j',
    (source) => {
      const { html } = renderMarkup(source);
      expect(html).not.toContain('wiki-link');
      expect(html).toContain('[[');
    },
  );

  it('코드 안의 [[ ]]는 링크가 아니다', () => {
    expect(wikiLinks('`[[대한민국]]`')).toEqual([]);
    expect(wikiLinks('```\n[[대한민국]]\n```')).toEqual([]);
  });

  it('보이는 글의 HTML은 글자로, 주소는 언제나 위키 안 경로', () => {
    const { html } = renderMarkup('[[javascript:alert(1)|<b>눌러</b>]]');
    expect(html).toContain('&lt;b&gt;눌러&lt;/b&gt;');
    expect(html).not.toMatch(/href="javascript:/i);
    expect(wikiLinks('[[javascript:alert(1)]]')[0]!.href).toBe(path('javascript:alert(1)'));
  });

  it('제목 안의 위키 링크도 동작하고 목차 글자는 링크 글자만', () => {
    const { html, toc } = renderMarkup('# [[대한민국]] 역사\n# 둘째');
    expect(html).toContain('class="wiki-link"');
    expect(toc[0]!.text).toBe('대한민국 역사');
  });
});

describe('분류 (T050 미리 확인, SX-26)', () => {
  it('[[분류:이름]]은 본문에 보이지 않고 분류 목록에 들어간다', () => {
    const result = renderMarkup('서울은 도시다.\n\n[[분류:도시]]\n[[분류:수도]]\n[[분류: 도시 ]]');
    expect(result.categories).toEqual(['도시', '수도']);
    expect(result.html).not.toContain('분류');
    // 분류만 있던 문단은 빈 <p>로 남지 않는다
    expect(result.html.trim()).toBe('<p>서울은 도시다.</p>');
  });
});

describe('링크·분류 뽑기 (T049, 저장할 때 색인용)', () => {
  it('렌더링 없이 링크 대상(정규화, 중복 없이 순서대로)과 분류를 돌려준다', () => {
    const source = [
      '[[대한민국]] [[서울특별시#역사]] [[ 대한민국 ]]',
      String.raw`[[C\#|C샵]] [[:분류:도시]] [[#같은 문서]]`,
      '`[[코드 안]]` [[a/../b]]',
      '[[분류:도시]]',
    ].join('\n');
    expect(extractWikiData(source)).toEqual({
      links: ['대한민국', '서울특별시', 'C#', '분류:도시'],
      categories: ['도시'],
    });
  });

  it('렌더링 결과에도 같은 목록이 들어 있다', () => {
    const result = renderMarkup('[[가]] [[나]] [[분류:다]]');
    expect(result.links).toEqual(['가', '나']);
    expect(result.categories).toEqual(['다']);
  });
});
