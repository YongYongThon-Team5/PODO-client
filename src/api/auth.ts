/*
 * 로그인 세션 (docs/api-integration.md 3장)
 * - Access 토큰과 CSRF 토큰은 메모리에만 둔다. Refresh 토큰은 서버가 HttpOnly 쿠키로 관리.
 * - 프론트와 /api가 같은 출처여야 쿠키(SameSite=Strict)가 실린다. 개발은 Vite 프록시.
 */

import { ApiError } from './errors';

type AuthState = { status: 'unknown' | 'signedIn' | 'signedOut'; accountId: string | null };

let accessToken: string | null = null;
let csrfToken: string | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
let refreshing: Promise<boolean> | null = null;
let state: AuthState = { status: 'unknown', accountId: null };
const listeners = new Set<() => void>();

/** 만료 1분 전에 미리 갱신 */
const REFRESH_EARLY_SEC = 60;

function setState(next: AuthState) {
  state = next;
  listeners.forEach((l) => l());
}

export function subscribeAuth(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const getAuthState = () => state;
export const getAccessToken = () => accessToken;

export async function getCsrfToken(force = false): Promise<string> {
  if (csrfToken && !force) return csrfToken;
  const res = await fetch('/api/auth/csrf', { credentials: 'include' });
  if (!res.ok) throw new Error(`CSRF 토큰 조회 실패 (${res.status})`);
  const body = (await res.json()) as { csrfToken?: string };
  if (!body.csrfToken) throw new Error('CSRF 토큰이 비어 있음');
  csrfToken = body.csrfToken;
  return csrfToken;
}

function clearSession() {
  accessToken = null;
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  setState({ status: 'signedOut', accountId: null });
}

async function requestToken(): Promise<boolean> {
  const send = async (csrf: string) =>
    fetch('/api/auth/token', { method: 'POST', credentials: 'include', headers: { 'X-CSRF-Token': csrf } });

  let res = await send(await getCsrfToken());
  // CSRF 토큰이 Refresh 회전 등으로 무효가 됐으면 새로 받아 한 번 더
  if (res.status === 403) res = await send(await getCsrfToken(true));
  if (!res.ok) {
    clearSession();
    return false;
  }

  const body = (await res.json()) as { accessToken: string; expiresIn: number; accountId: string };
  accessToken = body.accessToken;
  setState({ status: 'signedIn', accountId: body.accountId });

  if (refreshTimer) clearTimeout(refreshTimer);
  const delay = Math.max(body.expiresIn - REFRESH_EARLY_SEC, 10) * 1000;
  refreshTimer = setTimeout(() => void refreshSession(), delay);
  return true;
}

/** Refresh 쿠키로 Access 토큰 발급·갱신. 동시에 여러 번 불려도 요청은 한 번만. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= requestToken()
    .catch(() => {
      clearSession();
      return false;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

/** 앱 시작·카카오 로그인 직후: 쿠키가 살아 있으면 로그인 상태로 복구 */
export const restoreSession = refreshSession;

export function startKakaoLogin() {
  // fetch가 아니라 페이지 이동이어야 카카오 인가 화면으로 넘어간다
  window.location.href = '/api/auth/login/kakao';
}

/**
 * 회원탈퇴 (DELETE /api/me). 서버가 모든 세션을 끊고 삭제를 접수하면 202.
 * Bearer + CSRF + Refresh 쿠키가 필요하다. 실패하면 ApiError를 던지고 로그인 상태는 그대로 둔다.
 */
export async function withdraw() {
  const send = async (csrf: string) => {
    const headers: Record<string, string> = { 'X-CSRF-Token': csrf };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    return fetch('/api/me', { method: 'DELETE', credentials: 'include', headers });
  };

  let res = await send(await getCsrfToken());
  // CSRF가 회전됐으면 새로 받아서, Access가 만료됐으면 갱신해서 한 번 더
  if (res.status === 403) res = await send(await getCsrfToken(true));
  else if (res.status === 401 && (await refreshSession())) res = await send(await getCsrfToken());

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: ConstructorParameters<typeof ApiError>[1] } | null;
    throw new ApiError(res.status, body?.error);
  }
  csrfToken = null;
  clearSession();
}

export async function logout() {
  try {
    const headers: Record<string, string> = { 'X-CSRF-Token': await getCsrfToken() };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', headers });
  } finally {
    csrfToken = null;
    clearSession();
  }
}
