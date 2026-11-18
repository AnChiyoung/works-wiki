'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { canWriteTitle, getActor } from '@/server/access';
import { getDb } from '@/server/db';
import { MAX_SUMMARY_LENGTH } from '@/server/services/pages';
import { RevertError, revertPage } from '@/server/services/revert';
import { TitleError, titleToPath } from '@/server/services/title';

export type RevertState = { error?: string };

const formSchema = z.object({
  title: z.string().min(1),
  toRevNo: z.coerce.number().int().positive(),
  summary: z
    .string()
    .max(MAX_SUMMARY_LENGTH * 2)
    .default(''),
  baseRevId: z.coerce.number().int().positive().nullable().catch(null),
});

/** 과거 판 화면의 "이 판으로 되돌리기" (AC-4.4, T045) */
export async function revertAction(_prev: RevertState, formData: FormData): Promise<RevertState> {
  const parsed = formSchema.safeParse({
    title: formData.get('title'),
    toRevNo: formData.get('toRevNo'),
    summary: formData.get('summary') ?? '',
    baseRevId: formData.get('baseRevId') || null,
  });
  if (!parsed.success) return { error: '입력값이 올바르지 않습니다.' };
  const { title, toRevNo, summary, baseRevId } = parsed.data;

  let result;
  try {
    // 화면에서 버튼을 숨기는 것과 별개로 서버에서 다시 확인한다 (되돌리기는 있는 문서의 편집 = edit 권한)
    const actor = await getActor();
    if (!actor || !(await canWriteTitle(title))) return { error: '되돌릴 권한이 없습니다.' };
    result = revertPage(getDb(), { fullTitle: title, toRevNo, summary, baseRevId, authorId: actor.id });
  } catch (error) {
    if (error instanceof RevertError || error instanceof TitleError) return { error: error.message };
    throw error;
  }

  redirect(`${titleToPath(result.fullTitle)}?notice=${result.changed ? `reverted-${toRevNo}` : 'unchanged'}`);
}
