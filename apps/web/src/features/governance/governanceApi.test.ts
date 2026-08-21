import { describe, expect, it, vi } from 'vitest';

import { ApiClient } from '@/shared/api/httpClient';

import { createGovernanceApi } from './governanceApi';

describe('GovernanceApi', () => {
  it('initializes a term, store, and first teaching week through the single server command', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      term: { id: 'term-id' }, store: { id: 'store-id' }, firstTeachingWeek: { id: 'week-id' },
    }), { status: 201, headers: { 'Content-Type': 'application/json' } }));
    const client = new ApiClient({ fetch, getAccessToken: () => 'access-token', refresh: vi.fn(), clearSession: vi.fn() });

    await createGovernanceApi(client).initialize({
      term: { code: '2026-AUTUMN', name: '2026 秋季实训', startDate: '2026-09-01', endDate: '2027-01-20' },
      store: { code: 'DRINK-LAB', name: '饮品实训门店' },
      firstTeachingWeek: { name: '导入与准备', startDate: '2026-09-01', endDate: '2026-09-07', phaseCode: 'PREPARATION' },
    });

    expect(fetch).toHaveBeenCalledWith('/api/v1/admin/initialization', expect.objectContaining({
      method: 'POST',
      headers: expect.any(Headers),
      body: JSON.stringify({
        term: { code: '2026-AUTUMN', name: '2026 秋季实训', startDate: '2026-09-01', endDate: '2027-01-20' },
        store: { code: 'DRINK-LAB', name: '饮品实训门店' },
        firstTeachingWeek: { name: '导入与准备', startDate: '2026-09-01', endDate: '2026-09-07', phaseCode: 'PREPARATION' },
      }),
    }));
  });

  it('uses the governed template publication endpoint with its optimistic version', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'template-id', status: 'PUBLISHED' }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    const client = new ApiClient({ fetch, getAccessToken: () => 'access-token', refresh: vi.fn(), clearSession: vi.fn() });

    await createGovernanceApi(client).publishTemplate('template-id', 3);

    expect(fetch).toHaveBeenCalledWith('/api/v1/admin/template-versions/template-id/publish', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ version: 3 }),
    }));
  });

  it('creates the starter template and executable components atomically on the server', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'template-id', status: 'DRAFT' }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    }));
    const client = new ApiClient({ fetch, getAccessToken: () => 'access-token', refresh: vi.fn(), clearSession: vi.fn() });

    await createGovernanceApi(client).bootstrapTemplate({
      termId: 'term-id', storeId: 'store-id', templateCode: 'DAILY-OPS', name: '日常运营模板', effectiveFrom: '2026-09-01',
      configuration: { roles: [], tasks: [] },
      role: { code: 'BARISTA', name: '吧台制作', configuration: { required: true } },
      sopTask: { code: 'OPENING-CHECK', name: '开档检查', configuration: { roleCode: 'BARISTA', evidenceRequired: false, requiresP2Acceptance: false } },
    });

    expect(fetch).toHaveBeenCalledWith('/api/v1/admin/template-versions/bootstrap', expect.objectContaining({
      method: 'POST', body: JSON.stringify({
        termId: 'term-id', storeId: 'store-id', templateCode: 'DAILY-OPS', name: '日常运营模板', effectiveFrom: '2026-09-01',
        configuration: { roles: [], tasks: [] },
        role: { code: 'BARISTA', name: '吧台制作', configuration: { required: true } },
        sopTask: { code: 'OPENING-CHECK', name: '开档检查', configuration: { roleCode: 'BARISTA', evidenceRequired: false, requiresP2Acceptance: false } },
      }),
    }));
  });

  it('uses the governed people and organization endpoints rather than page-local state', async () => {
    const fetch = vi.fn().mockImplementation(() => Promise.resolve(new Response(JSON.stringify({ items: [] }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    })));
    const client = new ApiClient({ fetch, getAccessToken: () => 'access-token', refresh: vi.fn(), clearSession: vi.fn() });
    const api = createGovernanceApi(client);

    await api.listAccounts('ACTIVE');
    await api.listPendingRegistrations();
    await api.createTeam({ termId: 'term-id', code: 'TEAM-A', name: 'A 组' });
    await api.createMembership('term-id', { accountId: 'account-id', teamId: 'team-id' });

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/admin/accounts?status=ACTIVE', expect.objectContaining({ method: 'GET' }));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/admin/registration-requests?status=PENDING', expect.objectContaining({ method: 'GET' }));
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/v1/admin/teams', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ termId: 'term-id', code: 'TEAM-A', name: 'A 组' }),
    }));
    expect(fetch).toHaveBeenNthCalledWith(4, '/api/v1/admin/terms/term-id/memberships', expect.objectContaining({
      method: 'POST', body: JSON.stringify({ accountId: 'account-id', teamId: 'team-id' }),
    }));
  });
});
