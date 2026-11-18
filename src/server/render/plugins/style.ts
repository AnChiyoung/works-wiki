import type { MarkdownIt, StateInline } from 'markdown-it';

// 글자 색·크기 (syntax.md SX-34~39, SX-48)
//
// {{색:빨강|글}}  {{색:#3366ff|글}}  {{크기:+2|글}}  {{색:빨강|{{크기:+1|겹쳐 쓰기}}}}
//
// - 이름 색은 정해진 목록만 클래스(wiki-color-red 등)로 바꾼다. 다크 모드 밝기는 CSS 변수가 맡는다 (SX-39).
// - 16진수 색은 #rgb, #rrggbb만 받아서 style="color:#…" 하나로 넣는다. 정화 단계도 같은 모양만 통과시킨다.
// - 크기는 -2~+5 단계만 클래스(wiki-size-m2 ~ wiki-size-p5)로 바꾼다.
// - 범위를 벗어난 값은 꾸밈 없이 안쪽 글자만 남긴다 (SX-38). 사용자가 쓴 글이 style에 그대로 들어가는 일은 없다.
// - 색·크기가 아닌 {{ }}, 닫는 }}가 없거나 줄을 넘는 것은 글자 그대로 둔다.

const COLOR_NAMES: Record<string, string> = {
  빨강: 'red',
  주황: 'orange',
  노랑: 'yellow',
  초록: 'green',
  파랑: 'blue',
  남색: 'navy',
  보라: 'purple',
  회색: 'gray',
};
const COLOR_CLASSES = new Set(Object.values(COLOR_NAMES));

export const STYLE_CLASSES = [
  ...[...COLOR_CLASSES].map((c) => `wiki-color-${c}`),
  ...[-2, -1, 1, 2, 3, 4, 5].map(sizeClass),
];

/** 겹쳐 쓰기 깊이 한도. 넘으면 더 안쪽은 글자 그대로 둔다 (아주 깊은 입력에서 멈추지 않게) */
const MAX_DEPTH = 20;

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

function sizeClass(step: number): string {
  return `wiki-size-${step < 0 ? 'm' : 'p'}${Math.abs(step)}`;
}

type Attr = [string, string];

/** 값이 허용 범위면 span에 붙일 속성, 아니면 null (꾸밈 없음) */
function colorAttr(value: string): Attr | null {
  if (HEX_COLOR.test(value)) return ['style', `color:${value.toLowerCase()}`];
  const name = COLOR_NAMES[value] ?? value.toLowerCase();
  return COLOR_CLASSES.has(name) ? ['class', `wiki-color-${name}`] : null;
}

function sizeAttr(value: string): Attr | null {
  if (!/^[+-]?\d$/.test(value)) return null;
  const step = Number(value);
  return step >= -2 && step <= 5 && step !== 0 ? ['class', sizeClass(step)] : null;
}

const KINDS: Record<string, (value: string) => Attr | null> = { 색: colorAttr, 크기: sizeAttr };

/** start의 {{와 짝이 맞는 }}의 위치. 같은 줄 안에서만 찾는다 */
function findClose(src: string, start: number, max: number): number {
  let depth = 0;
  for (let i = start; i < max - 1; i++) {
    const ch = src.charCodeAt(i);
    if (ch === 0x0a /* \n */) return -1;
    if (ch === 0x7b /* { */ && src.charCodeAt(i + 1) === 0x7b) {
      depth++;
      i++;
    } else if (ch === 0x7d /* } */ && src.charCodeAt(i + 1) === 0x7d) {
      depth--;
      if (depth === 0) {
        // }}}처럼 이어지면 가장 뒤의 }}를 짝으로 본다 ({{a|{b}}}의 안쪽 } 보존)
        while (i + 2 < max && src.charCodeAt(i + 2) === 0x7d) i++;
        return i;
      }
      i++;
    }
  }
  return -1;
}

const depths = new WeakMap<StateInline, number>();

function styleRule(state: StateInline, silent: boolean): boolean {
  const start = state.pos;
  const { src } = state;
  if (src.charCodeAt(start) !== 0x7b || src.charCodeAt(start + 1) !== 0x7b) return false;

  const header = /^\{\{(색|크기):([^|{}\n]*)\|/.exec(src.slice(start, Math.min(state.posMax, start + 64)));
  if (!header) return false;

  const depth = depths.get(state) ?? 0;
  if (depth >= MAX_DEPTH) return false;

  const close = findClose(src, start, state.posMax);
  if (close === -1) return false;

  if (silent) {
    state.pos = close + 2;
    return true;
  }

  const attr = KINDS[header[1]!]!(header[2]!.trim());
  if (attr) state.push('wiki_style_open', 'span', 1).attrs = [attr];

  const oldMax = state.posMax;
  state.pos = start + header[0].length;
  state.posMax = close;
  depths.set(state, depth + 1);
  state.md.inline.tokenize(state);
  depths.set(state, depth);
  state.posMax = oldMax;

  if (attr) state.push('wiki_style_close', 'span', -1);
  state.pos = close + 2;
  return true;
}

export function wikiStylePlugin(md: MarkdownIt): void {
  md.inline.ruler.before('wikilink', 'wikistyle', styleRule);
}
