import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { getConfig } from '@/server/config';
import { openDatabase, type Db } from './client';

export type { Db } from './client';

// 개발 모드에서는 코드를 고칠 때마다 모듈이 다시 불려 와도 연결이 새로 생기지 않도록
// globalThis에 연결을 보관한다.
const globalForDb = globalThis as typeof globalThis & { __wikiDb?: Db };

/** 앱 전체에서 함께 쓰는 DB 연결. DATA_DIR/wiki.db 파일을 연다. */
export function getDb(): Db {
  if (!globalForDb.__wikiDb) {
    const { dataDir } = getConfig();
    fs.mkdirSync(dataDir, { recursive: true });
    globalForDb.__wikiDb = openDatabase(path.join(dataDir, 'wiki.db'));
  }
  return globalForDb.__wikiDb;
}
