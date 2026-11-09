import createClient from 'openapi-fetch';
import type { paths } from './schema';
import { getAccessToken, refreshSession } from './auth';

/*
 * 모든 요청에 Bearer를 붙이고, 401이면 토큰을 한 번 갱신한 뒤 재시도한다.
 * baseUrl은 비워 둔다: 프론트와 같은 출처의 /api로 보낸다 (개발은 Vite 프록시).
 */
async function authFetch(request: Request): Promise<Response> {
  const retry = request.clone();

  const send = (req: Request) => {
    const token = getAccessToken();
    if (token) req.headers.set('Authorization', `Bearer ${token}`);
    return fetch(req, { credentials: 'include' });
  };

  const res = await send(request);
  if (res.status !== 401 || !getAccessToken()) return res;

  const refreshed = await refreshSession();
  return refreshed ? send(retry) : res;
}

export const api = createClient<paths>({ baseUrl: '', fetch: authFetch });
