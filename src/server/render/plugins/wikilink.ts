import type { MarkdownIt, StateCore, StateInline } from 'markdown-it';
import { parseTitle, titleToPath } from '@/server/services/title';

// 위키 링크와 분류 (syntax.md SX-22~27)
//
// [[문서]]  [[문서|보이는 글]]  [[문서#문단]]  [[#문단]]  [[C\#]]  [[:분류:이름]]  [[분류:이름]]
//
// - 제목은 parseTitle로 정규화한다. 쓸 수 없는 제목이면 링크로 만들지 않고 글자 그대로 둔다.
// - 제목에 들어간 #은 \#로 쓴다. 이스케이프하지 않은 첫 #부터는 문단 이름이다.
// - [[분류:이름]]은 본문에 아무것도 남기지 않고 env.categories에 이름을 넣는다.
// - 렌더러는 DB를 보지 않는다. 있는 문서 목록(env.existingTitles)을 받아서 없는 문서를 빨간 링크로 표시한다.
//   목록이 없으면 모두 있는 문서로 본다.

export type WikiEnv = {
  /** 있는 문서의 전체 제목. 없으면 모든 링크를 있는 문서로 본다 */
  existingTitles?: ReadonlySet<string>;
  /** 링크 대상 전체 제목 (정규화, 중복 없이 나온 순서대로) */
  links: string[];
  /** 분류 이름 (접두어 없이, 중복 없이 나온 순서대로) */
  categories: string[];
};

type Target =
  | { kind: 'page'; fullTitle: string; section: string }
  | { kind: 'anchor'; section: string }
  | { kind: 'category'; name: string };

function addOnce(list: string[], value: string): void {
  if (!list.includes(value)) list.push(value);
}

/** 이스케이프하지 않은 첫 #에서 제목과 문단을 나누고, \#를 #로 바꾼다 */
function splitSection(raw: string): { title: string; section: string } {
  const match = /^((?:[^#\\]|\\.)*)(?:#(.*))?$/s.exec(raw);
  const unescape = (text: string) => text.replace(/\\#/g, '#');
  return { title: unescape(match?.[1] ?? raw).trim(), section: unescape(match?.[2] ?? '').trim() };
}

function parseTarget(raw: string): Target | null {
  const linkOnly = raw.trimStart().startsWith(':');
  const { title, section } = splitSection(linkOnly ? raw.trimStart().slice(1) : raw);

  if (title === '') return !linkOnly && section !== '' ? { kind: 'anchor', section } : null;

  let parsed;
  try {
    parsed = parseTitle(title);
  } catch {
    return null;
  }
  if (!linkOnly && parsed.namespace === 'category') return { kind: 'category', name: parsed.title };
  return { kind: 'page', fullTitle: parsed.fullTitle, section };
}

function wikiLinkRule(state: StateInline, silent: boolean): boolean {
  const start = state.pos;
  const { src } = state;
  if (src.charCodeAt(start) !== 0x5b /* [ */ || src.charCodeAt(start + 1) !== 0x5b) return false;

  const end = src.indexOf(']]', start + 2);
  if (end === -1 || end + 2 > state.posMax) return false;
  const inner = src.slice(start + 2, end);
  if (inner.includes('\n')) return false;

  // 제목에는 |를 쓸 수 없으므로 첫 |가 제목과 보이는 글의 경계다
  const bar = inner.indexOf('|');
  const target = parseTarget(bar === -1 ? inner : inner.slice(0, bar));
  if (!target) return false;

  if (silent) {
    state.pos = end + 2;
    return true;
  }

  const env = state.env as WikiEnv;

  if (target.kind === 'category') {
    addOnce(env.categories, target.name);
    state.pos = end + 2;
    return true;
  }

  const sectionHash = target.section ? `#${encodeURIComponent(target.section)}` : '';
  let href: string;
  let display: string;
  const attrs: [string, string][] = [];
  if (target.kind === 'anchor') {
    href = sectionHash;
    display = target.section;
    attrs.push(['class', 'wiki-link']);
  } else {
    addOnce(env.links, target.fullTitle);
    href = titleToPath(target.fullTitle) + sectionHash;
    display = target.fullTitle + (target.section ? `#${target.section}` : '');
    const missing = env.existingTitles !== undefined && !env.existingTitles.has(target.fullTitle);
    attrs.push(
      ['class', missing ? 'wiki-link new' : 'wiki-link'],
      ['title', missing ? `${target.fullTitle} (없는 문서)` : target.fullTitle],
    );
  }

  const open = state.push('link_open', 'a', 1);
  open.attrs = [['href', href], ...attrs];
  open.markup = 'wikilink';

  const labelStart = bar === -1 ? -1 : start + 2 + bar + 1;
  if (labelStart !== -1 && src.slice(labelStart, end).trim() !== '') {
    // 보이는 글은 일반 인라인 문법으로 렌더링한다 (굵게 등). 안에서 또 링크가 생기지 않게 linkLevel을 올린다.
    const oldMax = state.posMax;
    state.pos = labelStart;
    state.posMax = end;
    state.linkLevel++;
    state.md.inline.tokenize(state);
    state.linkLevel--;
    state.posMax = oldMax;
  } else {
    state.push('text', '', 0).content = display;
  }

  state.push('link_close', 'a', -1);
  state.pos = end + 2;
  return true;
}

/** 분류만 있던 문단처럼 보이는 내용이 없는 문단은 빼서 빈 <p>가 남지 않게 한다 */
function removeEmptyParagraphs(state: StateCore): void {
  const tokens = state.tokens;
  for (let i = tokens.length - 3; i >= 0; i--) {
    const [open, inline, close] = [tokens[i]!, tokens[i + 1]!, tokens[i + 2]!];
    if (open.type !== 'paragraph_open' || inline.type !== 'inline' || close.type !== 'paragraph_close')
      continue;
    const empty = (inline.children ?? []).every(
      (t) => t.type === 'softbreak' || (t.type === 'text' && t.content.trim() === ''),
    );
    if (empty) tokens.splice(i, 3);
  }
}

export function wikiLinkPlugin(md: MarkdownIt): void {
  md.inline.ruler.before('link', 'wikilink', wikiLinkRule);
  md.core.ruler.push('wiki_empty_paragraphs', removeEmptyParagraphs);
}
