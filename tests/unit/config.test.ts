import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '@/server/config';

const cwd = path.resolve('/project');

describe('loadConfig (T006)', () => {
  it('값이 없으면 기본값을 쓴다', () => {
    expect(loadConfig({}, cwd)).toEqual({
      dataDir: path.resolve(cwd, 'data'),
      wikiName: '개발 위키',
    });
  });

  it('설정한 값을 읽는다', () => {
    const config = loadConfig({ DATA_DIR: './data-test', WIKI_NAME: '  내 위키 ' }, cwd);
    expect(config).toEqual({
      dataDir: path.resolve(cwd, 'data-test'),
      wikiName: '내 위키',
    });
  });

  it('잘못된 값이면 어떤 항목이 문제인지 알려준다', () => {
    let error: unknown;
    try {
      loadConfig({ DATA_DIR: '  ', WIKI_NAME: '   ' }, cwd);
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ConfigError);
    const issues = (error as ConfigError).issues;
    expect(issues).toHaveLength(2);
    expect(issues.some((i) => i.startsWith('DATA_DIR:'))).toBe(true);
    expect(issues.some((i) => i.startsWith('WIKI_NAME:'))).toBe(true);
  });
});
