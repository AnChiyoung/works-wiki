'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { canWriteTitle, getActor } from '@/server/access';
import { getDb } from '@/server/db';
import { type DiffRow, computeDiff } from '@/server/services/diff';
import { ConflictError, ContentError, MAX_SUMMARY_LENGTH, savePage } from '@/server/services/pages';
import { TitleError, titleToPath } from '@/server/services/title';

/** 편집 충돌 정보 (AC-2.5). 차이는 최신 판(이전) → 내 내용(이후) */
export type SaveConflict = {
  latestRevId: number;
  revNo: number;
  authorName: string;
  /** ISO 시각 */
  createdAt: string;
  rows: DiffRow[];
  added: number;
  removed: number;
};

export type SaveState = { error?: string; conflict?: SaveConflict };

const formSchema = z.object({
  title: z.string().min(1),
  // 바이트 한도(1MB)는 savePage가 검사한다. 여기서는 터무니없이 큰 입력만 먼저 막는다.
  content: z.string().max(2_000_000),
  summary: z
    .string()
    .max(MAX_SUMMARY_LENGTH * 2)
    .default(''),
  baseRevId: z.coerce.number().int().positive().nullable().catch(null),
});

/** 편집 화면의 저장 버튼 (AC-2.3, AC-2.4, AC-2.6, AC-2.7) */
export async function savePageAction(_prev: SaveState, formData: FormData): Promise<SaveState> {
  const parsed = formSchema.safeParse({
    title: formData.get('title'),
    content: formData.get('content'),
    summary: formData.get('summary') ?? '',
    baseRevId: formData.get('baseRevId') || null,
  });
  if (!parsed.success) return { error: '입력값이 올바르지 않습니다.' };

  const { title, content, summary, baseRevId } = parsed.data;
  let result;
  try {
    // AC-2.1: 화면에서 버튼을 숨기는 것과 별개로 저장할 때 서버에서 다시 확인한다
    const actor = await getActor();
    if (!actor || !(await canWriteTitle(title))) return { error: '편집 권한이 없습니다.' };
    result = savePage(getDb(), { fullTitle: title, content, summary, baseRevId, authorId: actor.id });
  } catch (error) {
    if (error instanceof TitleError || error instanceof ContentError) return { error: error.message };
    if (error instanceof ConflictError) {
      const { latest } = error;
      const { rows, added, removed } = computeDiff(latest.content, content);
      return {
        error: error.message,
        conflict: {
          latestRevId: latest.id,
          revNo: latest.revNo,
          authorName: latest.authorName,
          createdAt: latest.createdAt.toISOString(),
          rows,
          added,
          removed,
        },
      };
    }
    throw error;
  }

  // redirect는 예외로 동작하므로 try 밖에서 부른다.
  redirect(titleToPath(result.fullTitle) + (result.changed ? '' : '?notice=unchanged'));
}
