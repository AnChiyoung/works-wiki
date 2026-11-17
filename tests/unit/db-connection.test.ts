import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-db-'));
process.env.DATA_DIR = dataDir;

const { getDb } = await import('@/server/db');

afterAll(() => {
  getDb().$client.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

describe('DB 연결 (T007)', () => {
  it('DATA_DIR/wiki.db 파일을 만든다', () => {
    getDb();
    expect(fs.existsSync(path.join(dataDir, 'wiki.db'))).toBe(true);
  });

  it('여러 번 불러도 같은 연결을 돌려준다', () => {
    expect(getDb()).toBe(getDb());
  });

  it('WAL 모드와 외래 키 검사가 켜져 있다', () => {
    const sqlite = getDb().$client;
    expect(sqlite.pragma('journal_mode', { simple: true })).toBe('wal');
    expect(sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
  });
});
