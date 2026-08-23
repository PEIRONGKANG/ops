import { describe, expect, it, vi } from 'vitest';

import { ApiClient } from '@/shared/api/httpClient';

import { createOperationsApi } from './operationsApi';

describe('operations api', () => {
  it('maps dashboard and shift reads to the role-scoped endpoints', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ assignedShifts: [], unreadNotificationCount: 2 }))
      .mockResolvedValueOnce(jsonResponse({ draftShifts: [], pendingApprovalShifts: [], blockingIncidentShifts: [], pendingHandoverShifts: [], operatingDate: '2026-08-23' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'shift-1', status: 'IN_PROGRESS' }));
    const api = createOperationsApi(client(fetch));

    await api.getPersonalDashboard();
    await api.getToday();
    await api.getShift('shift-1');

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/me/operations-dashboard', expect.objectContaining({ method: 'GET' }));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/operations/today', expect.objectContaining({ method: 'GET' }));
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/v1/shifts/shift-1', expect.objectContaining({ method: 'GET' }));
  });

  it('sends versioned task actions and multipart evidence uploads', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'task-1', status: 'SUBMITTED' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'evidence-1' }))
      .mockResolvedValueOnce(jsonResponse({ id: 'file-1' }));
    const api = createOperationsApi(client(fetch));
    const file = new File(['image'], 'evidence.jpg', { type: 'image/jpeg' });

    await api.submitTask('task-1', 4);
    await api.createEvidence({ taskCompletionId: 'task-1', kind: 'TEXT', textContent: '完成检查', occurredAt: '2026-08-23T08:00:00Z' });
    await api.uploadEvidenceFile('evidence-1', file);

    expect(fetch).toHaveBeenNthCalledWith(1, '/api/v1/task-completions/task-1/submit', expect.objectContaining({
      body: JSON.stringify({ version: 4 }),
    }));
    expect(fetch).toHaveBeenNthCalledWith(2, '/api/v1/evidence', expect.objectContaining({
      body: JSON.stringify({ taskCompletionId: 'task-1', kind: 'TEXT', textContent: '完成检查', occurredAt: '2026-08-23T08:00:00Z' }),
    }));
    expect(fetch).toHaveBeenNthCalledWith(3, '/api/v1/evidence/evidence-1/files', expect.objectContaining({ body: expect.any(FormData) }));
  });
});

function client(fetch: ReturnType<typeof vi.fn>) {
  return new ApiClient({ fetch, getAccessToken: () => 'token', refresh: vi.fn(), clearSession: vi.fn() });
}

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
