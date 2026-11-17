import 'server-only';
import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  DATA_DIR: z.string().trim().min(1, '비어 있을 수 없습니다').default('./data'),
  WIKI_OPEN_EDIT: z.stringbool({ error: 'true 또는 false여야 합니다' }).default(false),
  WIKI_NAME: z
    .string()
    .trim()
    .min(1, '비어 있을 수 없습니다')
    .max(50, '50자 이하여야 합니다')
    .default('개발 위키'),
});

export type Config = {
  /** DB, 업로드 파일, 백업이 저장되는 폴더 (절대 경로) */
  dataDir: string;
  /** M1 임시: 로그인 없이 편집 허용. M2에서 제거한다. */
  openEdit: boolean;
  /** 화면에 보이는 위키 이름 */
  wikiName: string;
};

export class ConfigError extends Error {
  constructor(public readonly issues: string[]) {
    super(`환경 설정이 올바르지 않습니다:\n${issues.map((i) => `  - ${i}`).join('\n')}`);
    this.name = 'ConfigError';
  }
}

/** 환경 변수를 검증해 설정을 만든다. 잘못된 값이 있으면 ConfigError를 던진다. */
export function loadConfig(env: Record<string, string | undefined>, cwd = process.cwd()): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new ConfigError(result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`));
  }
  const { DATA_DIR, WIKI_OPEN_EDIT, WIKI_NAME } = result.data;
  return {
    dataDir: path.resolve(cwd, DATA_DIR),
    openEdit: WIKI_OPEN_EDIT,
    wikiName: WIKI_NAME,
  };
}

let cached: Config | undefined;

/** 현재 프로세스의 설정. 처음 부를 때 한 번만 검증한다. */
export function getConfig(): Config {
  cached ??= loadConfig(process.env);
  return cached;
}
