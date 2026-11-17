import MarkdownIt, { type MarkdownIt as MarkdownItInstance } from 'markdown-it';
import { sanitize } from './sanitize';

// 위키 원문 → 안전한 HTML. 규칙: specs/001-wiki-core/syntax.md
// 순수 함수로 유지한다. (DB 조회 등 부수 효과 없음 → 단독 테스트 가능)

export type TocItem = {
  /** 1부터 시작하는 깊이 (단계를 건너뛰어도 빈 단계 없이 센다) */
  depth: number;
  /** 화면에 보이는 번호. 예: '1.2.' */
  number: string;
  /** 고정 주소. 예: 's-1.2' */
  id: string;
  /** 서식을 뺀 제목 글자 */
  text: string;
};

export type RenderResult = {
  html: string;
  toc: TocItem[];
};

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

function createMarkdown(): MarkdownItInstance {
  const md = new MarkdownIt('default', {
    html: false, // 원시 HTML은 글자로 (SX-46)
    linkify: false,
    typographer: false,
    breaks: false,
  });

  // SX-8: 외부 링크는 새 탭 + 외부 링크 표시
  const defaultLinkOpen =
    md.renderer.rules.link_open ??
    ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
  md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!;
    const href = String(token.attrGet('href') ?? '');
    if (isExternal(href)) {
      token.attrSet('target', '_blank');
      token.attrSet('rel', 'noopener noreferrer');
      token.attrSet('class', 'external');
    }
    return defaultLinkOpen(tokens, idx, options, env, self);
  };

  // 외부 이미지는 https 주소만 넣고, 늦게 불러온다. 그 밖의 주소는 대체 글자만 보인다.
  const defaultImage = md.renderer.rules.image!;
  md.renderer.rules.image = (tokens, idx, options, env, self) => {
    const token = tokens[idx]!;
    if (!/^https:\/\//i.test(String(token.attrGet('src') ?? ''))) {
      return md.utils.escapeHtml(self.renderInlineAsText(token.children ?? [], options, env));
    }
    token.attrSet('loading', 'lazy');
    return defaultImage(tokens, idx, options, env, self);
  };

  return md;
}

const md = createMarkdown();

/** 위키 원문을 렌더링한다. 결과 HTML은 정화(sanitize)를 거친 상태다. */
export function renderMarkup(source: string): RenderResult {
  const env: { toc: TocItem[] } = { toc: [] };
  const raw = md.render(source, env);
  return { html: sanitize(raw), toc: env.toc };
}
