import sanitizeHtml from 'sanitize-html';

// 렌더러가 만든 HTML을 허용 목록 방식으로 한 번 더 걸러낸다. (원칙 5, SX-46~48)
// 원시 HTML은 markdown-it 단계에서 이미 글자로 바뀌지만, 플러그인 실수까지 막기 위한 이중 방어다.
// 새 문법을 추가해서 태그·속성·클래스가 늘면 여기에도 추가해야 화면에 나온다.

const HEADINGS = ['h2', 'h3', 'h4', 'h5', 'h6'] as const;

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    ...HEADINGS,
    'p',
    'br',
    'hr',
    'strong',
    'em',
    's',
    'code',
    'pre',
    'blockquote',
    'ul',
    'ol',
    'li',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
    'a',
    'img',
    'span',
    'nav',
  ],
  allowedAttributes: {
    ...Object.fromEntries(HEADINGS.map((h) => [h, ['id', 'class', 'data-level']])),
    a: ['href', 'title', 'target', 'rel', 'class'],
    img: ['src', 'alt', 'title', 'loading'],
    // ol의 start는 넣지 않는다: 번호 목록은 쓴 숫자와 상관없이 1부터 매긴다 (SX-20)
    th: ['style'],
    td: ['style'],
    code: ['class'],
    span: ['class'],
    nav: ['id', 'class', 'aria-label'],
    li: ['class'],
    p: ['class'],
  },
  allowedClasses: {
    ...Object.fromEntries(HEADINGS.map((h) => [h, ['wiki-heading']])),
    a: ['external', 'heading-number', 'wiki-link', 'new'],
    code: ['language-*'],
    span: ['heading-text', 'heading-number'],
    nav: ['toc'],
    li: ['toc-item', 'toc-depth-*'],
    p: ['toc-title'],
  },
  allowedStyles: {
    th: { 'text-align': [/^(left|right|center)$/] },
    td: { 'text-align': [/^(left|right|center)$/] },
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['https'] },
  allowProtocolRelative: false,
  // 허용하지 않는 태그는 태그만 지우고 안쪽 글자는 남긴다.
  disallowedTagsMode: 'discard',
  // 주소가 걸러져 src가 없어진 이미지는 통째로 뺀다.
  exclusiveFilter: (frame) => frame.tag === 'img' && !frame.attribs.src,
};

export function sanitize(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}
