import type { MarkdownIt, StateBlock } from 'markdown-it';

// 접기 상자 (syntax.md SX-40~43)
//
// ::: 접기 제목        ::: 펼침 제목
// 내용                 내용
// :::                  :::
//
// - <details class="wiki-fold"><summary>제목</summary><div class="wiki-fold-body">…</div></details>
//   펼침은 open을 붙인다. 제목을 생략하면 "펼치기". 제목에는 인라인 문법을 쓸 수 있다.
// - 닫는 줄은 여는 줄과 콜론 수가 같아야 한다. 그래서 바깥보다 콜론을 하나 더 쓴 ::::로 겹쳐 쓴다 (SX-43).
//   (markdown-it-container는 콜론이 더 많은 줄로도 닫혀서 이 규칙과 맞지 않아 직접 만든다)
// - 닫는 줄이 없으면 그 블록(문서·목록 항목)의 끝까지 상자가 된다.
// - 접기·펼침이 아닌 ::: 줄은 글자 그대로 둔다.

const DEFAULT_TITLE = '펼치기';
const OPENER = /^[ \t]*(접기|펼침)(?:[ \t]+(.*?))?[ \t]*$/;

/** 줄 맨 앞의 콜론 수 (콜론 뒤 나머지 글자와 함께) */
function readColons(state: StateBlock, line: number): { count: number; rest: string } {
  const start = state.bMarks[line]! + state.tShift[line]!;
  const max = state.eMarks[line]!;
  let pos = start;
  while (pos < max && state.src.charCodeAt(pos) === 0x3a /* : */) pos++;
  return { count: pos - start, rest: state.src.slice(pos, max) };
}

function foldRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false; // 들여 쓴 코드 블록
  const { count, rest } = readColons(state, startLine);
  if (count < 3) return false;
  const opener = OPENER.exec(rest);
  if (!opener) return false;
  if (silent) return true;

  // 콜론 수가 같은 닫는 줄을 찾는다. 바깥 블록보다 덜 들여 쓴 줄이 나오면 거기서 끝난다.
  let nextLine = startLine;
  let closed = false;
  while (++nextLine < endLine) {
    const isEmpty = state.isEmpty(nextLine);
    if (!isEmpty && state.sCount[nextLine]! < state.blkIndent) break;
    if (isEmpty || state.sCount[nextLine]! - state.blkIndent >= 4) continue;
    const line = readColons(state, nextLine);
    if (line.count === count && line.rest.trim() === '') {
      closed = true;
      break;
    }
  }

  const oldParent = state.parentType;
  const oldLineMax = state.lineMax;
  // 타입 정의에 없는 이름이지만, markdown-it은 parentType을 비교에만 쓴다
  state.parentType = 'wiki_fold' as typeof state.parentType;
  state.lineMax = nextLine;

  const open = state.push('wiki_fold_open', 'details', 1);
  open.block = true;
  open.markup = ':'.repeat(count);
  open.map = [startLine, nextLine];
  open.attrs = [['class', 'wiki-fold']];
  if (opener[1] === '펼침') open.attrs.push(['open', '']);

  state.push('wiki_fold_summary_open', 'summary', 1);
  const title = state.push('inline', '', 0);
  title.content = opener[2]?.trim() || DEFAULT_TITLE;
  title.map = [startLine, startLine + 1];
  title.children = [];
  state.push('wiki_fold_summary_close', 'summary', -1);

  const body = state.push('wiki_fold_body_open', 'div', 1);
  body.block = true;
  body.attrs = [['class', 'wiki-fold-body']];
  state.md.block.tokenize(state, startLine + 1, nextLine);
  state.push('wiki_fold_body_close', 'div', -1).block = true;

  state.push('wiki_fold_close', 'details', -1).block = true;

  state.parentType = oldParent;
  state.lineMax = oldLineMax;
  state.line = nextLine + (closed ? 1 : 0);
  return true;
}

export function wikiFoldPlugin(md: MarkdownIt): void {
  md.block.ruler.before('fence', 'wiki_fold', foldRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  });
}
