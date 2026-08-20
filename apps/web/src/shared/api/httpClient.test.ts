import { describe, expect, it, vi } from 'vitest';

import { ApiClient } from './httpClient';

describe('ApiClient', () => {
  it('retries concurrent unauthorised requests after one refresh', async () => {
    let accessToken = 'expired-token';
    const refresh = vi.fn(async () => {
      accessToken = 'new-token';
      return accessToken;
    });
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const authorization = new Headers(init?.headers).get('Authorization');
      if (authorization === 'Bearer expired-token') {
        return new Response(JSON.stringify({ code: 'UNAUTHORIZED', message: 'Expired' }), { status: 401 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    });
    const client = new ApiClient({
      fetch: fetchMock,
      getAccessToken: () => accessToken,
      refresh,
      clearSession: vi.fn(),
    });

    await Promise.all([client.get<{ ok: boolean }>('/protected-a'), client.get<{ ok: boolean }>('/protected-b')]);

    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls.filter(([, init]) => new Headers(init?.headers).get('Authorization') === 'Bearer new-token')).toHaveLength(2);
  });
});
