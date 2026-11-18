// 서버 액션·API 라우트를 단위 테스트에서 부를 때 next/headers(cookies, headers)를 흉내 낸다.
// 쓰는 쪽 테스트 파일에서: vi.mock('next/headers', () => import('../helpers/request-context'))
export const jar = new Map<string, string>();
export const requestHeaders = new Headers();

export async function cookies() {
  return {
    get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
  };
}

export async function headers() {
  return requestHeaders;
}
