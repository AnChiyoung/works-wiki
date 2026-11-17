import type { MarkdownIt, StateCore, Token } from 'markdown-it';
import type { TocItem } from '../markup';

// 제목 자동 번호, 고정 주소, 목차 (syntax.md SX-10~17)
//
// - 쓰는 사람이 정한 #의 개수가 아니라 "실제 깊이"로 번호를 매긴다. (#  다음 ### → 1.1.)
// - 제목 태그는 깊이 + 1 (문서 제목이 h1). 최대 h6.
// - 제목이 2개 이상이면 첫 제목 바로 앞에 목차를 넣는다.
// 결과 목차는 env.toc에 담긴다.

type Heading = { openIdx: number; depth: number; counters: number[]; text: string };

function plainText(inline: Token): string {
  return (inline.children ?? [])
    .filter((t) => t.type === 'text' || t.type === 'code_inline')
    .map((t) => t.content)
    .join('');
}

function collectHeadings(tokens: Token[]): Heading[] {
  const headings: Heading[] = [];
  const levelStack: number[] = []; // 현재 경로에 있는 제목들의 # 개수
  const counters: number[] = [];

  tokens.forEach((token, idx) => {
    if (token.type !== 'heading_open') return;
    const level = Number(token.tag.slice(1));
    while (levelStack.length > 0 && levelStack[levelStack.length - 1]! >= level) levelStack.pop();
    levelStack.push(level);

    const depth = levelStack.length;
    counters.length = depth; // 더 깊은 단계의 번호는 버린다
    counters[depth - 1] = (counters[depth - 1] ?? 0) + 1;

    headings.push({ openIdx: idx, depth, counters: [...counters], text: plainText(tokens[idx + 1]!) });
  });
  return headings;
}

function htmlInline(state: StateCore, content: string): Token {
  const token = new state.Token('html_inline', '', 0);
  token.content = content;
  return token;
}

export function headingsPlugin(md: MarkdownIt): void {
  const escape = md.utils.escapeHtml;

  md.core.ruler.push('wiki_headings', (state) => {
    const tokens = state.tokens;
    const headings = collectHeadings(tokens);
    const showToc = headings.length >= 2;

    const toc: TocItem[] = headings.map(({ openIdx, depth, counters, text }) => {
      const number = `${counters.join('.')}.`;
      const id = `s-${counters.join('.')}`;
      const tag = `h${Math.min(depth + 1, 6)}`;

      const open = tokens[openIdx]!;
      const inline = tokens[openIdx + 1]!;
      const close = tokens[openIdx + 2]!;
      open.tag = tag;
      close.tag = tag;
      open.attrSet('id', id);
      open.attrSet('class', 'wiki-heading');
      open.attrSet('data-level', String(depth));

      const numberHtml = showToc
        ? `<a class="heading-number" href="#toc">${number}</a>`
        : `<span class="heading-number">${number}</span>`;
      inline.children = [
        htmlInline(state, `${numberHtml} <span class="heading-text">`),
        ...(inline.children ?? []),
        htmlInline(state, '</span>'),
      ];

      return { depth, number, id, text };
    });

    if (showToc) {
      const items = toc
        .map(
          (t) =>
            `<li class="toc-item toc-depth-${t.depth}"><a href="#${t.id}">${t.number}</a> ${escape(t.text)}</li>`,
        )
        .join('');
      const nav = new state.Token('html_block', '', 0);
      nav.content = `<nav id="toc" class="toc" aria-label="목차"><p class="toc-title">목차</p><ul>${items}</ul></nav>\n`;
      tokens.splice(headings[0]!.openIdx, 0, nav);
    }

    (state.env as { toc?: TocItem[] }).toc = toc;
  });
}
