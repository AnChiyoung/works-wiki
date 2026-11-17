import { describe, expect, it } from 'vitest';
import { TitleError, parseTitle, titleFromPathSegments, titleToPath } from '@/server/services/title';

describe('제목 정규화와 해석 (T011, AC-1.2, AC-3.10)', () => {
  it('일반 문서 제목', () => {
    expect(parseTitle('대문')).toEqual({ namespace: 'main', title: '대문', fullTitle: '대문' });
  });

  it('공백이 들어간 한글 제목', () => {
    expect(parseTitle('서울 특별시').fullTitle).toBe('서울 특별시');
  });

  it('앞뒤 공백을 지우고 연속 공백은 하나로 줄인다', () => {
    expect(parseTitle('  서울 \t  특별시  ').fullTitle).toBe('서울 특별시');
  });

  it('NFD로 입력된 한글을 NFC로 바꾼다', () => {
    const nfd = '대문'.normalize('NFD');
    expect(nfd).not.toBe('대문');
    expect(parseTitle(nfd).title).toBe('대문');
  });

  it.each(['C/C++', 'Node.js', '.NET', 'C#', 'F#', 'ASP.NET Core', '100%', 'a+b=c'])(
    '개발 문서에 흔한 기호가 들어간 제목: %s',
    (raw) => {
      expect(parseTitle(raw).fullTitle).toBe(raw);
    },
  );

  it('이름공간 접두어를 분리한다', () => {
    expect(parseTitle('분류:도시')).toEqual({ namespace: 'category', title: '도시', fullTitle: '분류:도시' });
    expect(parseTitle('파일:로고.png').namespace).toBe('file');
    expect(parseTitle('위키:도움말').namespace).toBe('wiki');
    expect(parseTitle('사용자:홍길동').namespace).toBe('user');
  });

  it('접두어 뒤의 공백도 정리한다', () => {
    expect(parseTitle('분류:  도시 ').fullTitle).toBe('분류:도시');
  });

  it('등록되지 않은 접두어는 일반 문서 제목의 일부다', () => {
    expect(parseTitle('TypeScript: 시작하기')).toEqual({
      namespace: 'main',
      title: 'TypeScript: 시작하기',
      fullTitle: 'TypeScript: 시작하기',
    });
  });

  it.each([
    ['', 'empty'],
    ['   ', 'empty'],
    ['분류:', 'empty'],
    ['a|b', 'forbidden_char'],
    ['[문서]', 'forbidden_char'],
    ['{{틀}}', 'forbidden_char'],
    ['줄\n바꿈', 'forbidden_char'],
    ['/앞 슬래시', 'bad_path'],
    ['뒤 슬래시/', 'bad_path'],
    ['a//b', 'bad_path'],
    ['a/../b', 'bad_path'],
    ['.', 'bad_path'],
    ['..', 'bad_path'],
    ['가'.repeat(201), 'too_long'],
  ])('쓸 수 없는 제목 %j → %s', (raw, code) => {
    expect(() => parseTitle(raw)).toThrow(TitleError);
    try {
      parseTitle(raw);
    } catch (e) {
      expect((e as TitleError).code).toBe(code);
    }
  });
});

describe('제목 ↔ URL 경로 (T011)', () => {
  it.each([
    ['대문', '/w/%EB%8C%80%EB%AC%B8'],
    ['서울 특별시', '/w/%EC%84%9C%EC%9A%B8%20%ED%8A%B9%EB%B3%84%EC%8B%9C'],
    ['C/C++', '/w/C/C%2B%2B'],
    ['C#', '/w/C%23'],
    ['100%', '/w/100%25'],
    ['Node.js', '/w/Node.js'],
    ['분류:도시', '/w/%EB%B6%84%EB%A5%98%3A%EB%8F%84%EC%8B%9C'],
  ])('%s → %s', (title, path) => {
    expect(titleToPath(title)).toBe(path);
  });

  it('다른 경로 접두어를 쓸 수 있다', () => {
    expect(titleToPath('C/C++', '/edit')).toBe('/edit/C/C%2B%2B');
  });

  it.each(['대문', '서울 특별시', 'C/C++', 'C#', '100%', 'Node.js', '분류:도시'])(
    '경로 조각에서 제목을 되살린다: %s',
    (title) => {
      const segments = titleToPath(title)
        .replace(/^\/w\//, '')
        .split('/');
      expect(titleFromPathSegments(segments)).toBe(title);
    },
  );
});
