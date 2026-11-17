'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { getDb } from '@/server/db';
import { canEditM1 } from '@/server/edit-guard';
import { ContentError, MAX_SUMMARY_LENGTH, savePage } from '@/server/services/pages';
import { TitleError, titleToPath } from '@/server/services/title';
import { getSystemUserId } from '@/server/services/users';

export type SaveState = { error?: string };

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
  if (!canEditM1()) return { error: '편집 권한이 없습니다.' }; // M2에서 can()으로 교체

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
    const db = getDb();
    result = savePage(db, { fullTitle: title, content, summary, baseRevId, authorId: getSystemUserId(db) });
  } catch (error) {
    if (error instanceof TitleError || error instanceof ContentError) return { error: error.message };
    throw error;
  }

  // redirect는 예외로 동작하므로 try 밖에서 부른다.
  redirect(titleToPath(result.fullTitle) + (result.changed ? '' : '?notice=unchanged'));
}
