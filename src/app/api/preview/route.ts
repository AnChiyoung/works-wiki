import { z } from 'zod';
import { canWriteAny } from '@/server/access';
import { renderMarkup } from '@/server/render/markup';
import { MAX_CONTENT_BYTES, normalizeContent } from '@/server/services/pages';

// POST /api/preview — 편집 화면의 미리보기 (AC-2.2, T022)

/** JSON으로 감싸면 줄바꿈 등이 늘어나므로 본문 한도보다 조금 넉넉하게 받는다. */
const MAX_BODY_BYTES = Math.ceil(MAX_CONTENT_BYTES * 1.2);

const bodySchema = z.object({ content: z.string() });

function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

/** 같은 사이트의 화면에서 보낸 요청인지 확인한다. (CSRF 방지) */
function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return json({ error: '허용되지 않은 요청입니다.' }, 403);
  if (!(await canWriteAny())) return json({ error: '편집 권한이 없습니다.' }, 403);

  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
    return json({ error: '내용이 너무 큽니다.' }, 413);
  }
  const text = await req.text();
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return json({ error: '내용이 너무 큽니다.' }, 413);

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(JSON.parse(text));
  } catch {
    return json({ error: '요청 형식이 올바르지 않습니다.' }, 400);
  }

  const content = normalizeContent(body.content);
  if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES)
    return json({ error: '내용이 너무 큽니다.' }, 413);

  const { html, toc } = renderMarkup(content);
  return json({ html, toc });
}
