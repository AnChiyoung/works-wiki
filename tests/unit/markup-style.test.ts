import { describe, expect, it } from 'vitest';
import { extractWikiData, renderMarkup } from '@/server/render/markup';
import { sanitize } from '@/server/render/sanitize';

const html = (source: string) => renderMarkup(source).html;

describe('글자 색·크기 (T052, SX-34~39, SX-48)', () => {
  it('SX-34 이름 색은 정해진 클래스가 된다 (한글·영어 이름)', () => {
    expect(html('{{색:빨강|중요}}')).toBe('<p><span class="wiki-color-red">중요</span></p>\n');
    expect(html('{{색:blue|파랑}}')).toContain('<span class="wiki-color-blue">파랑</span>');
    expect(html('{{색:남색|a}} {{색:GRAY|b}}')).toContain('<span class="wiki-color-navy">a</span>');
    expect(html('{{색:GRAY|b}}')).toContain('<span class="wiki-color-gray">b</span>');
  });

  it('지원하는 이름 색 8가지', () => {
    const names: [string, string][] = [
      ['빨강', 'red'],
      ['주황', 'orange'],
      ['노랑', 'yellow'],
      ['초록', 'green'],
      ['파랑', 'blue'],
      ['남색', 'navy'],
      ['보라', 'purple'],
      ['회색', 'gray'],
    ];
    for (const [ko, en] of names) {
      expect(html(`{{색:${ko}|x}}`)).toContain(`<span class="wiki-color-${en}">x</span>`);
      expect(html(`{{색:${en}|x}}`)).toContain(`<span class="wiki-color-${en}">x</span>`);
    }
  });

  it('SX-35 16진수 색은 검증한 뒤 color 하나만 style로 넣는다', () => {
    expect(html('{{색:#3366ff|글자}}')).toContain('<span style="color:#3366ff">글자</span>');
    expect(html('{{색:#36F|짧게}}')).toContain('<span style="color:#36f">짧게</span>');
  });

  it('SX-36 크기는 -2~+5 단계만 클래스로', () => {
    expect(html('{{크기:+2|큰 글자}}')).toContain('<span class="wiki-size-p2">큰 글자</span>');
    expect(html('{{크기:+5|a}}')).toContain('<span class="wiki-size-p5">a</span>');
    expect(html('{{크기:-2|a}}')).toContain('<span class="wiki-size-m2">a</span>');
    expect(html('{{크기:3|a}}')).toContain('<span class="wiki-size-p3">a</span>');
  });

  it('SX-37 겹쳐 쓸 수 있다', () => {
    expect(html('{{색:빨강|{{크기:+1|둘 다}}}}')).toContain(
      '<span class="wiki-color-red"><span class="wiki-size-p1">둘 다</span></span>',
    );
    expect(html('{{크기:+1|앞 {{색:파랑|가운데}} 뒤}}')).toContain(
      '<span class="wiki-size-p1">앞 <span class="wiki-color-blue">가운데</span> 뒤</span>',
    );
  });

  it('안쪽 글에는 다른 인라인 문법과 위키 링크를 쓸 수 있다', () => {
    const source = '{{색:초록|**굵게** [[참고 문서]]}}';
    expect(html(source)).toMatch(
      /<span class="wiki-color-green"><strong>굵게<\/strong> <a [^>]*class="wiki-link"[^>]*>참고 문서<\/a><\/span>/,
    );
    expect(extractWikiData(source).links).toEqual(['참고 문서']);
  });

  it('SX-38 허용 범위를 벗어난 값은 꾸밈 없이 안쪽 글자만 보인다', () => {
    for (const source of [
      '{{색:url(javascript:alert(1))|x}}',
      '{{색:red;background:url(x)|x}}',
      '{{색:#12|x}}',
      '{{색:#1234567|x}}',
      '{{색:#ggg|x}}',
      '{{색:분홍|x}}',
      '{{색:|x}}',
      '{{크기:+6|x}}',
      '{{크기:-3|x}}',
      '{{크기:큼|x}}',
      '{{크기:1.5|x}}',
      '{{크기:+2px|x}}',
    ]) {
      expect(html(source), source).toBe('<p>x</p>\n');
    }
  });

  it('크기 0은 꾸밈 없이 보인다', () => {
    expect(html('{{크기:0|x}}')).toBe('<p>x</p>\n');
  });

  it('SX-48 정화 뒤 다른 style이 남지 않는다', () => {
    const out = html('{{색:#fff;background:red|a}} {{색:red" style="x|b}}');
    expect(out).toBe('<p>a b</p>\n');
    expect(html('{{색:#abcdef|a}}').match(/style="[^"]*"/g)).toEqual(['style="color:#abcdef"']);
  });

  it('SX-48 이중 방어: 정화 단계도 span의 검증한 color 말고는 지운다', () => {
    expect(sanitize('<span style="color:#fff;background:url(x)">a</span>')).toBe(
      '<span style="color:#fff">a</span>',
    );
    expect(sanitize('<span style="color:red">a</span>')).toBe('<span>a</span>');
    expect(sanitize('<span class="wiki-color-red evil">a</span>')).toBe(
      '<span class="wiki-color-red">a</span>',
    );
    expect(sanitize('<p style="color:#fff">a</p>')).toBe('<p>a</p>');
  });

  it('닫히지 않은 {{가 많아도 오래 걸리지 않는다', () => {
    const started = performance.now();
    html('{{색:빨강|'.repeat(3000));
    expect(performance.now() - started).toBeLessThan(2000);
  });

  it('문법이 아닌 {{ }}는 글자 그대로', () => {
    expect(html('{{모름:x|y}}')).toBe('<p>{{모름:x|y}}</p>\n');
    expect(html('{{색:빨강 글자}}')).toBe('<p>{{색:빨강 글자}}</p>\n');
    expect(html('{{색:빨강|닫지 않음')).toBe('<p>{{색:빨강|닫지 않음</p>\n');
    expect(html('`{{색:빨강|코드}}`')).toBe('<p><code>{{색:빨강|코드}}</code></p>\n');
  });

  it('줄을 넘어가면 문법이 아니다', () => {
    expect(html('{{색:빨강|첫 줄\n둘째 줄}}')).toBe('<p>{{색:빨강|첫 줄\n둘째 줄}}</p>\n');
  });

  it('지나치게 깊게 겹치면 더 안쪽은 글자 그대로 두고 멈추지 않는다', () => {
    const depth = 5000;
    const source = '{{색:빨강|'.repeat(depth) + 'x' + '}}'.repeat(depth);
    const out = html(source);
    expect(out).toContain('x');
    expect(out.split('<span').length - 1).toBeLessThanOrEqual(20);
  });
});
