import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { GovernanceApi, Store, TeachingWeek, Term } from '@/features/governance/governanceApi';
import type { AccountProfile } from '@/shared/api/authApi';

import { DashboardPage } from './DashboardPage';
import { ToastProvider } from '@/shared/ui/feedback/ToastProvider';

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
    saveStartupPeriod: vi.fn(),
    listTerms: vi.fn().mockResolvedValue([]),
    listStores: vi.fn().mockResolvedValue([]),
    listTeachingWeeks: vi.fn().mockResolvedValue([]),
    bootstrapTemplate: vi.fn(),
    createTemplate: vi.fn(),
    listTemplateVersions: vi.fn().mockResolvedValue([]),
    publishTemplate: vi.fn(),
    saveStarterTemplate: vi.fn(),
    publishStartupConfiguration: vi.fn(),
    listTemplateComponents: vi.fn(),
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

function renderDashboard(api: GovernanceApi) {
  return render(<ToastProvider><DashboardPage api={api} profile={profile} /></ToastProvider>);
}

describe('DashboardPage', () => {
  it('uses a two-part startup workspace without duplicate introduction copy', async () => {
    renderDashboard(createApi());

    expect(await screen.findByRole('list', { name: '启动配置流程' })).toBeVisible();
    expect(screen.getByLabelText('当前步骤配置')).toBeVisible();
    expect(screen.queryByRole('heading', { name: '启动清单' })).not.toBeInTheDocument();
    expect(screen.queryByText('按顺序完成三项配置，即可开始安排并运行实训班次。')).not.toBeInTheDocument();
    expect(screen.queryByText('当前配置')).not.toBeInTheDocument();
    const configuration = screen.getByLabelText('当前步骤配置');
    expect(within(configuration).queryByRole('heading', { level: 1, name: '建立实训周期' })).not.toBeInTheDocument();
    expect(within(configuration).queryByText('一次确认本期实训范围：系统将同时创建周期、实际运营门店和首个教学周，避免留下未完成的基础配置。')).not.toBeInTheDocument();
  });

  it('shows the horizontal startup flow and the current configuration form together', async () => {
    renderDashboard(createApi());

    const rail = await screen.findByRole('list', { name: '启动配置流程' });
    expect(rail).toBeVisible();
    expect(within(rail).getByText('建立实训周期')).toBeVisible();
    expect(within(rail).getByText('配置运营模板')).toBeVisible();
    expect(within(rail).getByText('组织实训人员')).toBeVisible();
    expect(await screen.findByRole('textbox', { name: '周期代码' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '返回工作台' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '创建实训周期' })).toHaveAttribute('form', 'startup-period-form');
  });

  it('places initial period creation inside the supporting action pane', async () => {
    renderDashboard(createApi());

    const configuration = screen.getByLabelText('当前步骤配置');
    const pane = await within(configuration).findByRole('complementary', { name: '完成实训周期' });
    expect(within(pane).getByRole('heading', { name: '完成实训周期' })).toBeVisible();
    const forward = within(pane).getByTestId('startup-period-forward');
    expect(forward).toHaveAttribute('aria-label', '创建实训周期');
    expect(forward).toHaveAttribute('form', 'startup-period-form');
    expect(forward).toHaveAttribute('type', 'submit');
    expect(screen.getByRole('heading', { level: 1, name: '实训周期' })).not.toContainElement(forward);
  });

  it('marks the selected startup step without rendering a current-step text label', async () => {
    renderDashboard(createApi());

    const rail = await screen.findByRole('list', { name: '启动配置流程' });
    expect(within(rail).queryByText('当前步骤')).not.toBeInTheDocument();
    expect(within(rail).getByText('建立实训周期').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('lets P1 return to a completed step and keeps the action toolbar above the form', async () => {
    const user = userEvent.setup();
    const api = createApi();
    api.listTerms = vi.fn().mockResolvedValue([term]);
    api.listStores = vi.fn().mockResolvedValue([store]);
    api.listTeachingWeeks = vi.fn().mockResolvedValue([firstTeachingWeek]);
    api.listTemplateVersions = vi.fn().mockResolvedValue([]);

    renderDashboard(api);

    expect(await screen.findByRole('textbox', { name: '模板代码' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '建立实训周期' }));

    expect(await screen.findByRole('textbox', { name: '周期名称' })).toHaveValue(term.name);
    expect(screen.getByRole('button', { name: '保存修改' })).toHaveAttribute('form', 'startup-period-form');
    expect(screen.queryByRole('button', { name: '返回上一步' })).not.toBeInTheDocument();
  });

  it('advances to template configuration in the same page after initialization succeeds', async () => {
    const user = userEvent.setup();
    let initialized = false;
    const api = createApi();
    api.listTerms = vi.fn().mockImplementation(async () => initialized ? [term] : []);
    api.listStores = vi.fn().mockImplementation(async () => initialized ? [store] : []);
    api.listTeachingWeeks = vi.fn().mockImplementation(async () => initialized ? [firstTeachingWeek] : []);
    api.initialize = vi.fn().mockImplementation(async () => {
      initialized = true;
      return { term, store, firstTeachingWeek };
    });

    renderDashboard(api);

    await user.type(await screen.findByRole('textbox', { name: '周期代码' }), term.code);
    await user.type(screen.getByRole('textbox', { name: '周期名称' }), term.name);
    await user.click(screen.getByRole('group', { name: '开始日期' }));
    await user.keyboard('20260901');
    await user.click(screen.getByRole('group', { name: '结束日期' }));
    await user.keyboard('20270120');
    await user.type(screen.getByRole('textbox', { name: '门店代码' }), store.code);
    await user.type(screen.getByRole('textbox', { name: '门店名称' }), store.name);
    await user.type(screen.getByRole('textbox', { name: '首周名称' }), firstTeachingWeek.name);
    await user.click(screen.getByRole('group', { name: '首周开始日期' }));
    await user.keyboard('20260901');
    await user.click(screen.getByRole('group', { name: '首周结束日期' }));
    await user.keyboard('20260907');

    await user.click(screen.getByRole('button', { name: '创建实训周期' }));

    expect(await screen.findByRole('textbox', { name: '模板代码' })).toBeVisible();
    const rail = screen.getByRole('list', { name: '启动配置流程' });
    expect(within(rail).getByText('配置运营模板').closest('li')).toHaveAttribute('aria-current', 'step');
  });

  it('keeps people organization current until an active account belongs to an active team', async () => {
    const api = createApi();
    api.listTerms = vi.fn().mockResolvedValue([term]);
    api.listStores = vi.fn().mockResolvedValue([store]);
    api.listTeachingWeeks = vi.fn().mockResolvedValue([firstTeachingWeek]);
    api.listTemplateVersions = vi.fn().mockResolvedValue([{
      id: 'template-id', termId: term.id, storeId: store.id, templateCode: 'DAILY-OPS', templateRevision: 1, name: '日常运营模板', status: 'DRAFT', effectiveFrom: '2026-09-01', effectiveUntil: null, configuration: {}, version: 1, updatedAt: '2026-08-21T00:00:00Z',
    }]);
    api.listTeams = vi.fn().mockResolvedValue([{ id: 'team-id', termId: term.id, code: 'TEAM-A', name: 'A 组', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]);
    api.listMemberships = vi.fn().mockResolvedValue([{ id: 'membership-id', termId: term.id, accountId: 'disabled-account', teamId: 'team-id', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]);
    api.listAccounts = vi.fn().mockResolvedValue([]);

    renderDashboard(api);

    expect(await screen.findByRole('heading', { name: '组织实训人员' })).toBeVisible();
    const rail = screen.getByRole('list', { name: '启动配置流程' });
    expect(within(rail).getByText('组织实训人员').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(screen.queryByText('启动清单已完成')).not.toBeInTheDocument();
  });

  it('only publishes the draft period and template from the final people step', async () => {
    const user = userEvent.setup();
    const api = createApi();
    api.listTerms = vi.fn().mockResolvedValue([term]);
    api.listStores = vi.fn().mockResolvedValue([store]);
    api.listTeachingWeeks = vi.fn().mockResolvedValue([firstTeachingWeek]);
    api.listTemplateVersions = vi.fn().mockResolvedValue([{
      id: 'template-id', termId: term.id, storeId: store.id, templateCode: 'DAILY-OPS', templateRevision: 1, name: '日常运营模板', status: 'DRAFT', effectiveFrom: '2026-09-01', effectiveUntil: null, configuration: {}, version: 4, updatedAt: '2026-08-21T00:00:00Z',
    }]);
    api.listTeams = vi.fn().mockResolvedValue([{ id: 'team-id', termId: term.id, code: 'TEAM-A', name: 'A 组', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]);
    api.listMemberships = vi.fn().mockResolvedValue([{ id: 'membership-id', termId: term.id, accountId: 'account-id', teamId: 'team-id', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]);
    api.listAccounts = vi.fn().mockResolvedValue([{ id: 'account-id', loginId: 'P3-001', displayName: '林同学', status: 'ACTIVE', roles: ['P3'] }]);
    api.publishStartupConfiguration = vi.fn().mockResolvedValue({
      term: { ...term, status: 'PUBLISHED', version: 2 },
      template: { id: 'template-id', termId: term.id, storeId: store.id, templateCode: 'DAILY-OPS', templateRevision: 1, name: '日常运营模板', status: 'PUBLISHED', effectiveFrom: '2026-09-01', effectiveUntil: null, configuration: {}, version: 5, updatedAt: '2026-08-21T00:00:00Z' },
    });

    renderDashboard(api);

    expect(await screen.findByRole('heading', { name: '组织实训人员' })).toBeVisible();
    expect(screen.getByRole('button', { name: '发布实训配置' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '发布模板' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '发布实训配置' }));

    expect(api.publishStartupConfiguration).toHaveBeenCalledWith('term-id', {
      templateVersionId: 'template-id', termVersion: 1, templateVersion: 4,
    });
    expect(await screen.findByRole('status')).toHaveTextContent('实训配置已发布，周期与运营模板现已生效。');
  });

  it('surfaces startup synchronization errors in a retriable toast', async () => {
    const user = userEvent.setup();
    const api = createApi();
    const listTerms = vi.fn().mockRejectedValue(new Error('network failure'));
    api.listTerms = listTerms;

    renderDashboard(api);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('无法同步启动状态，请检查网络后重试。');
    expect(alert.closest('.MuiSnackbar-root')).toBeInTheDocument();
    const callsBeforeRetry = listTerms.mock.calls.length;
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(listTerms).toHaveBeenCalledTimes(callsBeforeRetry + 1);
  });
});
