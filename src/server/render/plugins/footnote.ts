import type { MarkdownIt } from 'markdown-it';
import footnotePlugin from 'markdown-it-footnote';

// 각주 (syntax.md SX-31~33). 문법 해석은 markdown-it-footnote에 맡기고 화면 모양만 바꾼다.
// - 이름으로 쓴 각주도 처음 나온 순서대로 숫자로 매긴다 (패키지 기본 동작, SX-32).
// - 같은 각주를 여러 번 가리켜도 [1]로 보인다 (패키지 기본은 [1:1]). 주소(id)는 서로 다르게 유지한다.
// - 각주 목록에는 "각주" 제목을 붙인다. 말풍선(SX-33)은 문서 화면의 스크립트가 만든다.

export function wikiFootnotePlugin(md: MarkdownIt): void {
  md.use(footnotePlugin);
  const rules = md.renderer.rules;

  rules.footnote_caption = (tokens, idx) => `[${Number((tokens[idx]!.meta as { id: number }).id) + 1}]`;
  // 패키지 기본 ↩︎는 Windows에서 이모지 상자로 보여서 글자 화살표로 바꾼다
  const defaultAnchor = rules.footnote_anchor!;
  rules.footnote_anchor = (tokens, idx, options, env, self) =>
    defaultAnchor(tokens, idx, options, env, self)
      .replace('↩︎', '↑')
      .replace('class="footnote-backref"', 'class="footnote-backref" aria-label="본문으로 돌아가기"');
  rules.footnote_block_open = () =>
    '<section class="footnotes" aria-label="각주">\n<p class="footnotes-title">각주</p>\n<ol class="footnotes-list">\n';
}
