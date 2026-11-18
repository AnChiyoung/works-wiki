import { parseRevNo } from '@/lib/rev';
import { getDb } from '@/server/db';
import { getPage } from '@/server/services/pages';
import { TitleError } from '@/server/services/title';

// GET /raw/:title(?rev=번호) — 문서 원문을 텍스트로 (원칙 7: 데이터는 사용자의 것, T040)

type Context = { params: Promise<{ title: string[] }> };

function notFound() {
  return new Response('문서나 판이 없습니다.\n', {
    status: 404,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

export async function GET(req: Request, { params }: Context) {
  const { title } = await params;
  const rev = parseRevNo(new URL(req.url).searchParams.get('rev'));
  if (rev === 'invalid') return notFound();

  let result;
  try {
    // 주의: 페이지와 달리 라우트 핸들러는 이미 디코딩된 조각을 받는다(Next.js 16.4). 다시 디코딩하면 100% 같은 제목이 깨진다.
    // 화면 테스트(tests/e2e/history.spec.ts의 원문 보기)가 이 동작이 바뀌면 알려준다.
    result = getPage(getDb(), title.join('/'), { rev });
  } catch (error) {
    if (error instanceof TitleError || error instanceof URIError) return notFound();
    throw error;
  }
  if (!result?.revision) return notFound();

  return new Response(result.revision.content, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      // 원문이 HTML처럼 해석되지 않게 한다
      'x-content-type-options': 'nosniff',
      ...(rev !== undefined && { 'x-robots-tag': 'noindex' }),
    },
  });
}
