export interface ApiErrorPayload {
  code?: string;
  message?: string;
  requestId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly requestId?: string;

  constructor(status: number, payload: ApiErrorPayload = {}) {
    super(payload.message ?? '请求暂时无法完成。');
    this.name = 'ApiError';
    this.status = status;
    this.code = payload.code ?? 'UNKNOWN_ERROR';
    this.requestId = payload.requestId;
  }
}
