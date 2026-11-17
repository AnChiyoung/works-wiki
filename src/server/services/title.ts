import type { Namespace } from '@/server/db/schema';

// 이 파일은 브라우저에서도 쓸 수 있도록 서버 전용 코드에 의존하지 않는다. (링크 만들기 등)

export const MAX_TITLE_LENGTH = 200;

/** 화면에 쓰는 접두어 → DB 이름공간 */
const PREFIX_TO_NAMESPACE: Record<string, Exclude<Namespace, 'main'>> = {
  분류: 'category',
  파일: 'file',
  위키: 'wiki',
  사용자: 'user',
};

const NAMESPACE_TO_PREFIX = Object.fromEntries(
  Object.entries(PREFIX_TO_NAMESPACE).map(([prefix, ns]) => [ns, prefix]),
) as Record<Exclude<Namespace, 'main'>, string>;

// 위키 문법 기호와 충돌하는 문자, 제어 문자.
// '#'은 C#, F# 같은 제목 때문에 허용한다. 위키 링크에서는 \#로 쓴다. (syntax.md SX-24)
const FORBIDDEN_CHARS = /[|[\]{}\u0000-\u001f\u007f]/;

export type TitleErrorCode = 'empty' | 'too_long' | 'forbidden_char' | 'bad_path';

const MESSAGES: Record<TitleErrorCode, string> = {
  empty: '제목이 비어 있습니다.',
  too_long: `제목은 ${MAX_TITLE_LENGTH}자 이하여야 합니다.`,
  forbidden_char: '제목에 | [ ] { } 와 줄바꿈 같은 제어 문자는 쓸 수 없습니다.',
  bad_path: "제목은 '/'로 시작하거나 끝날 수 없고, '//', '.', '..' 조각을 쓸 수 없습니다.",
};

export class TitleError extends Error {
  constructor(public readonly code: TitleErrorCode) {
    super(MESSAGES[code]);
    this.name = 'TitleError';
  }
}

export type ParsedTitle = {
  namespace: Namespace;
  /** 접두어를 뺀 제목 */
  title: string;
  /** 접두어를 포함한 전체 제목 (화면 표시, 링크에 쓴다) */
  fullTitle: string;
};

function normalize(raw: string): string {
  return raw.normalize('NFC').replace(/\s+/g, ' ').trim();
}

function validate(title: string): void {
  if (title === '') throw new TitleError('empty');
  if ([...title].length > MAX_TITLE_LENGTH) throw new TitleError('too_long');
  if (FORBIDDEN_CHARS.test(title)) throw new TitleError('forbidden_char');
  // '/'는 URL 경로 구분자로 쓰이므로 빈 조각이나 '.', '..' 조각이 생기면 주소가 깨진다.
  if (title.split('/').some((part) => part === '' || part === '.' || part === '..')) {
    throw new TitleError('bad_path');
  }
}

/** 입력한 제목을 정규화하고 이름공간을 분리한다. 쓸 수 없는 제목이면 TitleError를 던진다. */
export function parseTitle(raw: string): ParsedTitle {
  // 줄바꿈 같은 제어 문자는 공백 정리 전에 검사해야 공백으로 바뀌어 통과하는 일이 없다.
  if (/[\u0000-\u0008\u000a-\u001f\u007f]/.test(raw)) throw new TitleError('forbidden_char');

  const normalized = normalize(raw);
  const match = /^([^:]+):(.*)$/.exec(normalized);
  const namespace = match ? PREFIX_TO_NAMESPACE[match[1]!] : undefined;

  if (match && namespace) {
    const title = normalize(match[2]!);
    validate(title);
    return { namespace, title, fullTitle: `${match[1]}:${title}` };
  }

  validate(normalized);
  return { namespace: 'main', title: normalized, fullTitle: normalized };
}

/** DB의 이름공간과 제목으로 전체 제목을 만든다. */
export function toFullTitle(namespace: Namespace, title: string): string {
  return namespace === 'main' ? title : `${NAMESPACE_TO_PREFIX[namespace]}:${title}`;
}

/** 전체 제목 → URL 경로. '/'는 경로 구분자로 남기고 나머지는 모두 인코딩한다. */
export function titleToPath(fullTitle: string, base = '/w'): string {
  return `${base}/${fullTitle.split('/').map(encodeURIComponent).join('/')}`;
}

/** URL 경로 조각(인코딩된 상태) → 전체 제목 */
export function titleFromPathSegments(segments: string[]): string {
  return segments.map((s) => decodeURIComponent(s)).join('/');
}
