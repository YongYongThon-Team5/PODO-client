import type { components } from './schema';

type ErrorDetail = components['schemas']['ErrorDetail'];

/** 서버 오류 코드 → 화면에 보여줄 문구. 목록에 없으면 서버 message를 쓴다. */
const MESSAGES: Record<string, string> = {
  COLOR_ALREADY_USED: '다른 아이가 이미 쓰는 색이에요. 다른 색을 골라 주세요.',
  OPTIONS_NOT_CONFIGURED: '선택 목록을 준비 중이에요. 잠시 후 다시 시도해 주세요.',
};

const BY_STATUS: Record<number, string> = {
  401: '로그인이 필요해요.',
  404: '찾을 수 없는 정보예요.',
  413: '사진 용량이 너무 커요. 5MB 이하로 골라 주세요.',
  415: 'JPG, PNG, WebP 사진만 올릴 수 있어요.',
  503: '잠시 후 다시 시도해 주세요.',
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly requestId: string | null;
  readonly details: ErrorDetail['details'] | null;

  constructor(status: number, detail?: ErrorDetail) {
    const code = detail?.code ?? null;
    super((code && MESSAGES[code]) || detail?.message || BY_STATUS[status] || '문제가 생겼어요. 다시 시도해 주세요.');
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.requestId = detail?.requestId ?? null;
    this.details = detail?.details ?? null;
  }
}

/** openapi-fetch 결과에서 data를 꺼내고, 실패면 ApiError로 던진다 */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.response.ok) return result.data as T;
  const body = result.error as { error?: ErrorDetail } | undefined;
  throw new ApiError(result.response.status, body?.error);
}
