import { ApiClient } from './httpClient';
import { ApiError, type ApiErrorPayload } from './ApiError';

export type RoleCode = 'P1' | 'P2' | 'P3' | 'T1' | 'EXTERNAL_REVIEWER';

export interface SessionResponse {
  accessToken: string;
  tokenType: 'access' | 'password_change';
  expiresInSeconds: number;
}

export interface AccountProfile {
  id: string;
  loginId: string;
  displayName: string;
  roles: RoleCode[];
}

export interface AuthApi {
  login(input: { loginId: string; password: string }): Promise<SessionResponse>;
  changePassword(input: { newPassword: string }): Promise<SessionResponse>;
  refresh(): Promise<SessionResponse>;
  logout(): Promise<void>;
  me(): Promise<AccountProfile>;
}

export async function refreshSession(): Promise<SessionResponse> {
  const response = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!response.ok) {
    let payload: ApiErrorPayload | undefined;
    try { payload = await response.json() as ApiErrorPayload; } catch { payload = undefined; }
    throw new ApiError(response.status, payload);
  }
  return response.json() as Promise<SessionResponse>;
}

export function createAuthApi(client: ApiClient): AuthApi {
  return {
    login: (input) => client.post<SessionResponse>('/api/v1/auth/login', input, { skipRefresh: true }),
    changePassword: (input) => client.post<SessionResponse>('/api/v1/auth/change-password', input, { skipRefresh: true }),
    refresh: refreshSession,
    logout: () => client.post<void>('/api/v1/auth/logout', undefined, { skipRefresh: true }),
    me: () => client.get<AccountProfile>('/api/v1/auth/me'),
  };
}
