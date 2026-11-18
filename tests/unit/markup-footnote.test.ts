import { describe, expect, it } from 'vitest';
import { extractWikiData, renderMarkup } from '@/server/render/markup';

const html = (source: string) => renderMarkup(source).html;

/** 본문 위 첨자 각주 번호 [n]들 */
function refCaptions(out: string): string[] {
  return [...out.matchAll(/<sup class="footnote-ref"><a [^>]*>([^<]*)<\/a><\/sup>/g)].map((m) => m[1]!);
}

describe('각주 (T051, SX-31~32)', () => {
  it('SX-31 본문에 위 첨자 번호, 문서 끝에 각주 목록과 되돌아가기 링크', () => {
    const out = html('본문[^1] 이어서\n\n[^1]: 각주 내용');
    expect(out).toContain('<sup class="footnote-ref"><a href="#fn1" id="fnref1">[1]</a></sup>');
    expect(out).toMatch(
      /<section class="footnotes" aria-label="각주">\s*<p class="footnotes-title">각주<\/p>/,
    );
    expect(out).toMatch(
      /<li id="fn1" class="footnote-item">.*각주 내용.*<a href="#fnref1" class="footnote-backref" aria-label="본문으로 돌아가기">↑<\/a>/s,
    );
  });

  it('SX-32 이름으로 쓴 각주도 처음 나온 순서대로 숫자로 매긴다', () => {
    const out = html('가[^출처] 나[^1] 다[^메모]\n\n[^1]: 하나\n[^메모]: 메모\n[^출처]: 출처');
    expect(refCaptions(out)).toEqual(['[1]', '[2]', '[3]']);
    const items = [...out.matchAll(/<li id="fn(\d+)" class="footnote-item">(.*?)<\/li>/gs)].map((m) => [
      m[1],
      m[2]!.replace(/<[^>]+>|↑/g, '').trim(),
    ]);
    expect(items).toEqual([
      ['1', '출처'],
      ['2', '하나'],
      ['3', '메모'],
    ]);
  });

  it('같은 각주를 두 번 가리켜도 번호는 같게 보인다 (주소는 서로 다르게)', () => {
    const out = html('가[^a] 나[^a]\n\n[^a]: 같은 각주');
    expect(refCaptions(out)).toEqual(['[1]', '[1]']);
    expect(out).toContain('id="fnref1"');
    expect(out).toContain('id="fnref1:1"');
  });

  it('정의하지 않은 각주는 글자 그대로', () => {
    const out = html('본문[^없음]');
    expect(out).not.toContain('footnote');
    expect(out).toContain('[^없음]');
  });

  it('각주가 없으면 각주 목록도 없다', () => {
    expect(html('그냥 본문')).not.toContain('footnotes');
  });

  it('각주 안의 서식과 위키 링크도 동작하고, 링크 목록에 들어간다', () => {
    const source = '본문[^1]\n\n[^1]: **굵게** [[참고 문서]]';
    const out = html(source);
    expect(out).toMatch(/<li id="fn1"[^>]*>.*<strong>굵게<\/strong>.*class="wiki-link".*<\/li>/s);
    expect(extractWikiData(source).links).toEqual(['참고 문서']);
  });

  it('각주 안의 HTML·위험한 링크는 걸러진다 (SX-46, 47)', () => {
    const out = html('본문[^1]\n\n[^1]: <script>alert(1)</script> [눌러](javascript:alert(1))');
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toMatch(/href="javascript:/i);
  });
});
