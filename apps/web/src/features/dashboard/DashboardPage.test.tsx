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

    render(<DashboardPage api={createApi()} onOpenTermWorkspace={onOpenTermWorkspace} profile={{
      id: 'p1-id', loginId: 'P1', displayName: '系统管理员', roles: ['P1'],
    }} />);

    await user.click(await screen.findByRole('button', { name: '建立实训周期' }));

    expect(onOpenTermWorkspace).toHaveBeenCalledOnce();
  });
});
