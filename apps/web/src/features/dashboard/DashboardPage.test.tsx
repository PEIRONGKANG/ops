import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { GovernanceApi } from '@/features/governance/governanceApi';

import { DashboardPage } from './DashboardPage';

function createApi(): GovernanceApi {
  return {
    initialize: vi.fn(),
    listTerms: vi.fn().mockResolvedValue([]),
    listStores: vi.fn().mockResolvedValue([]),
    listTeachingWeeks: vi.fn(),
    bootstrapTemplate: vi.fn(),
    createTemplate: vi.fn(),
    listTemplateVersions: vi.fn().mockResolvedValue([]),
    publishTemplate: vi.fn(),
    listAccounts: vi.fn().mockResolvedValue([]),
    listPendingRegistrations: vi.fn(),
    approveRegistration: vi.fn(),
    listTeams: vi.fn(),
    createTeam: vi.fn(),
    listMemberships: vi.fn(),
    createMembership: vi.fn(),
  };
}

describe('DashboardPage', () => {
  it('opens the real term setup workspace from the current checklist item', async () => {
    const user = userEvent.setup();
    const onOpenTermWorkspace = vi.fn();

    render(<DashboardPage api={createApi()} onOpenPeopleWorkspace={vi.fn()} onOpenTemplateWorkspace={vi.fn()} onOpenTermWorkspace={onOpenTermWorkspace} profile={{
      id: 'p1-id', loginId: 'P1', displayName: '系统管理员', roles: ['P1'],
    }} />);

    await user.click(await screen.findByRole('button', { name: '建立实训周期' }));

    expect(onOpenTermWorkspace).toHaveBeenCalledOnce();
  });

  it('unlocks the template workspace only after the server confirms the initialization scope', async () => {
    const user = userEvent.setup();
    const onOpenTemplateWorkspace = vi.fn();
    const api = createApi();
    api.listTerms = vi.fn().mockResolvedValue([{ id: 'term-id', code: '2026-AUTUMN', name: '2026 秋季实训', startDate: '2026-09-01', endDate: '2027-01-20', status: 'DRAFT', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]);
    api.listStores = vi.fn().mockResolvedValue([{ id: 'store-id', code: 'DRINK-LAB', name: '饮品实训门店', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]);
    api.listTemplateVersions = vi.fn().mockResolvedValue([]);
    api.listTeams = vi.fn().mockResolvedValue([]);
    api.listMemberships = vi.fn().mockResolvedValue([]);

    render(<DashboardPage api={api} onOpenPeopleWorkspace={vi.fn()} onOpenTemplateWorkspace={onOpenTemplateWorkspace} onOpenTermWorkspace={vi.fn()} profile={{
      id: 'p1-id', loginId: 'P1', displayName: '系统管理员', roles: ['P1'],
    }} />);

    await user.click(await screen.findByRole('button', { name: '配置运营模板' }));

    expect(onOpenTemplateWorkspace).toHaveBeenCalledOnce();
  });
});
