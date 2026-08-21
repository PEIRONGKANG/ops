import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { GovernanceApi, Store, TeachingWeek, Term } from '@/features/governance/governanceApi';
import type { AccountProfile } from '@/shared/api/authApi';

import { DashboardPage } from './DashboardPage';

const term: Term = {
  id: 'term-id', code: '2026-AUTUMN', name: '2026 秋季实训', startDate: '2026-09-01', endDate: '2027-01-20', status: 'DRAFT', version: 1, updatedAt: '2026-08-21T00:00:00Z',
};

const store: Store = {
  id: 'store-id', code: 'DRINK-LAB', name: '饮品实训门店', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z',
};

const firstTeachingWeek: TeachingWeek = {
  id: 'week-id', termId: term.id, weekNumber: 1, name: '导入与准备', startDate: '2026-09-01', endDate: '2026-09-07', phaseCode: 'PREPARATION', version: 1, updatedAt: '2026-08-21T00:00:00Z',
};

function createApi(): GovernanceApi {
  return {
    initialize: vi.fn(),
    listTerms: vi.fn().mockResolvedValue([]),
    listStores: vi.fn().mockResolvedValue([]),
    listTeachingWeeks: vi.fn().mockResolvedValue([]),
    bootstrapTemplate: vi.fn(),
    createTemplate: vi.fn(),
    listTemplateVersions: vi.fn().mockResolvedValue([]),
    publishTemplate: vi.fn(),
    listAccounts: vi.fn().mockResolvedValue([]),
    listPendingRegistrations: vi.fn().mockResolvedValue([]),
    approveRegistration: vi.fn(),
    listTeams: vi.fn().mockResolvedValue([]),
    createTeam: vi.fn(),
    listMemberships: vi.fn().mockResolvedValue([]),
    createMembership: vi.fn(),
  };
}

const profile: AccountProfile = { id: 'p1-id', loginId: 'P1', displayName: '系统管理员', roles: ['P1'] };

describe('DashboardPage', () => {
  it('shows the horizontal startup flow and the current configuration form together', async () => {
    render(<DashboardPage api={createApi()} profile={profile} />);

    const rail = await screen.findByRole('list', { name: '启动配置流程' });
    expect(rail).toBeVisible();
    expect(within(rail).getByText('建立实训周期')).toBeVisible();
    expect(within(rail).getByText('配置运营模板')).toBeVisible();
    expect(within(rail).getByText('组织实训人员')).toBeVisible();
    expect(await screen.findByRole('textbox', { name: '周期代码' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '返回工作台' })).not.toBeInTheDocument();
  });

  it('advances to template configuration in the same page after initialization succeeds', async () => {
    const user = userEvent.setup();
    let initialized = false;
    const api = createApi();
    api.listTerms = vi.fn().mockImplementation(async () => initialized ? [term] : []);
    api.listStores = vi.fn().mockImplementation(async () => initialized ? [store] : []);
    api.initialize = vi.fn().mockImplementation(async () => {
      initialized = true;
      return { term, store, firstTeachingWeek };
    });

    render(<DashboardPage api={api} profile={profile} />);

    await user.type(await screen.findByRole('textbox', { name: '周期代码' }), term.code);
    await user.type(screen.getByRole('textbox', { name: '周期名称' }), term.name);
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: term.startDate } });
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: term.endDate } });
    await user.type(screen.getByRole('textbox', { name: '门店代码' }), store.code);
    await user.type(screen.getByRole('textbox', { name: '门店名称' }), store.name);
    await user.type(screen.getByRole('textbox', { name: '首周名称' }), firstTeachingWeek.name);
    fireEvent.change(screen.getByLabelText('首周开始日期'), { target: { value: firstTeachingWeek.startDate } });
    fireEvent.change(screen.getByLabelText('首周结束日期'), { target: { value: firstTeachingWeek.endDate } });

    await user.click(screen.getByRole('button', { name: '创建实训周期' }));

    expect(await screen.findByRole('textbox', { name: '模板代码' })).toBeVisible();
    const rail = screen.getByRole('list', { name: '启动配置流程' });
    expect(within(rail).getByText('配置运营模板').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('keeps people organization current until an active account belongs to an active team', async () => {
    const api = createApi();
    api.listTerms = vi.fn().mockResolvedValue([term]);
    api.listStores = vi.fn().mockResolvedValue([store]);
    api.listTemplateVersions = vi.fn().mockResolvedValue([{
      id: 'template-id', termId: term.id, storeId: store.id, templateCode: 'DAILY-OPS', templateRevision: 1, name: '日常运营模板', status: 'PUBLISHED', effectiveFrom: '2026-09-01', effectiveUntil: null, version: 1, updatedAt: '2026-08-21T00:00:00Z',
    }]);
    api.listTeams = vi.fn().mockResolvedValue([{ id: 'team-id', termId: term.id, code: 'TEAM-A', name: 'A 组', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]);
    api.listMemberships = vi.fn().mockResolvedValue([{ id: 'membership-id', termId: term.id, accountId: 'disabled-account', teamId: 'team-id', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]);
    api.listAccounts = vi.fn().mockResolvedValue([]);

    render(<DashboardPage api={api} profile={profile} />);

    expect(await screen.findByRole('heading', { name: '组织实训人员' })).toBeVisible();
    const rail = screen.getByRole('list', { name: '启动配置流程' });
    expect(within(rail).getByText('组织实训人员').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByText('启动清单已完成')).not.toBeInTheDocument();
  });
});
