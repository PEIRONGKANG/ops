import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { GovernanceApi } from './governanceApi';
import { ToastProvider } from '@/shared/ui/feedback/ToastProvider';
import { PeopleWorkspacePage } from './PeopleWorkspacePage';

function createApi(overrides: Partial<GovernanceApi> = {}): GovernanceApi {
  return {
    initialize: vi.fn(),
    listTerms: vi.fn().mockResolvedValue([{ id: 'term-id', code: '2026-AUTUMN', name: '2026 秋季实训', startDate: '2026-09-01', endDate: '2027-01-20', status: 'DRAFT', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]),
    listStores: vi.fn(),
    listTeachingWeeks: vi.fn(),
    bootstrapTemplate: vi.fn(),
    createTemplate: vi.fn(),
    listTemplateVersions: vi.fn(),
    publishTemplate: vi.fn(),
    listAccounts: vi.fn().mockResolvedValue([{ id: 'account-id', loginId: 'P3-001', displayName: '林同学', status: 'ACTIVE', roles: ['P3'] }]),
    listPendingRegistrations: vi.fn().mockResolvedValue([{ id: 'request-id', loginId: 'P3-002', displayName: '陈同学' }]),
    approveRegistration: vi.fn().mockResolvedValue({ account: { id: 'account-2', loginId: 'P3-002', displayName: '陈同学', roles: ['P3'] }, temporaryPassword: 'Initial-Password-1' }),
    listTeams: vi.fn().mockResolvedValue([]),
    createTeam: vi.fn().mockResolvedValue({ id: 'team-id', termId: 'term-id', code: 'TEAM-A', name: 'A 组', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' }),
    listMemberships: vi.fn().mockResolvedValue([]),
    createMembership: vi.fn().mockResolvedValue({ id: 'membership-id', termId: 'term-id', accountId: 'account-id', teamId: 'team-id', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' }),
    ...overrides,
  };
}

function renderPeople(api: GovernanceApi, embedded = false) {
  return render(<ToastProvider><PeopleWorkspacePage api={api} embedded={embedded} onBack={vi.fn()} /></ToastProvider>);
}

describe('PeopleWorkspacePage', () => {
  it('keeps people organization within the shared workspace body when embedded', async () => {
    renderPeople(createApi(), true);

    expect(await screen.findByRole('heading', { name: '待审批账号' })).toBeVisible();
    expect(screen.queryByRole('heading', { level: 1, name: '组织实训人员' })).not.toBeInTheDocument();
    expect(screen.queryByText('审批账号、建立团队，并将已启用账号纳入当前实训周期。账号状态与团队归属均以服务端为准。')).not.toBeInTheDocument();
  });

  it('approves a pending person with an explicit role and one-time temporary password', async () => {
    const user = userEvent.setup();
    const api = createApi();

    renderPeople(api);

    expect(await screen.findByText('陈同学')).toBeVisible();
    await user.type(screen.getByLabelText('审批说明（陈同学）'), '已核验班级名单。');
    await user.click(screen.getByRole('button', { name: '批准陈同学' }));

    expect(api.approveRegistration).toHaveBeenCalledWith('request-id', { roles: ['P3'], reason: '已核验班级名单。' });
    expect(await screen.findByText('Initial-Password-1')).toBeVisible();
    const toast = await screen.findByRole('alert');
    expect(toast).toHaveTextContent('已批准陈同学，临时密码已生成。');
    expect(toast.closest('.MuiSnackbar-root')).toBeInTheDocument();
  });

  it('creates a team and adds an active account as a term member', async () => {
    const user = userEvent.setup();
    const api = createApi({ listPendingRegistrations: vi.fn().mockResolvedValue([]) });

    renderPeople(api);

    await screen.findByRole('heading', { name: '组织实训人员' });
    await user.type(screen.getByLabelText('团队代码'), 'TEAM-A');
    await user.type(screen.getByLabelText('团队名称'), 'A 组');
    await user.click(screen.getByRole('button', { name: '创建团队' }));
    await user.click(screen.getByRole('button', { name: '加入本期成员' }));

    expect(api.createTeam).toHaveBeenCalledWith({ termId: 'term-id', code: 'TEAM-A', name: 'A 组' });
    expect(api.createMembership).toHaveBeenCalledWith('term-id', { accountId: 'account-id', teamId: 'team-id' });
    expect(await screen.findByText('A 组')).toBeVisible();
  });

  it('clears the previous term team selection while the new term is loading', async () => {
    const user = userEvent.setup();
    let resolveSecondTermTeams: ((teams: Array<{ id: string; termId: string; code: string; name: string; status: 'ACTIVE'; version: number; updatedAt: string }>) => void) | undefined;
    const api = createApi({
      listTerms: vi.fn().mockResolvedValue([
        { id: 'term-id', code: '2026-AUTUMN', name: '2026 秋季实训', startDate: '2026-09-01', endDate: '2027-01-20', status: 'DRAFT', version: 1, updatedAt: '2026-08-21T00:00:00Z' },
        { id: 'term-2', code: '2027-SPRING', name: '2027 春季实训', startDate: '2027-02-20', endDate: '2027-06-30', status: 'DRAFT', version: 1, updatedAt: '2026-08-21T00:00:00Z' },
      ]),
      listPendingRegistrations: vi.fn().mockResolvedValue([]),
      listTeams: vi.fn().mockImplementation((requestedTermId: string) => {
        if (requestedTermId === 'term-id') {
          return Promise.resolve([{ id: 'old-team', termId: 'term-id', code: 'OLD', name: '旧周期团队', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]);
        }
        return new Promise((resolve) => { resolveSecondTermTeams = resolve; });
      }),
    });

    renderPeople(api);

    expect(await screen.findByText('旧周期团队 · OLD')).toBeVisible();
    await user.click(screen.getByRole('combobox', { name: '实训周期' }));
    await user.click(screen.getByRole('option', { name: '2027 春季实训 · 2027-SPRING' }));

    expect(screen.getByRole('combobox', { name: '团队' })).not.toHaveTextContent('旧周期团队');
    resolveSecondTermTeams?.([{ id: 'new-team', termId: 'term-2', code: 'NEW', name: '新周期团队', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]);
    expect(await screen.findByText('新周期团队 · NEW')).toBeVisible();
  });
});
