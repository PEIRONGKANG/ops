import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { GovernanceApi } from './governanceApi';
import { ToastProvider } from '@/shared/ui/feedback/ToastProvider';
import { TermWorkspacePage } from './TermWorkspacePage';

function createApi(overrides: Partial<GovernanceApi> = {}): GovernanceApi {
  return {
    initialize: vi.fn(),
    listTerms: vi.fn().mockResolvedValue([]),
    listStores: vi.fn().mockResolvedValue([]),
    listTeachingWeeks: vi.fn().mockResolvedValue([]),
    bootstrapTemplate: vi.fn(),
    createTemplate: vi.fn(),
    listTemplateVersions: vi.fn(),
    publishTemplate: vi.fn(),
    listAccounts: vi.fn(),
    listPendingRegistrations: vi.fn(),
    approveRegistration: vi.fn(),
    listTeams: vi.fn(),
    createTeam: vi.fn(),
    listMemberships: vi.fn(),
    createMembership: vi.fn(),
    ...overrides,
  };
}

function renderTerm(api: GovernanceApi, embedded = false) {
  return render(<ToastProvider><TermWorkspacePage api={api} embedded={embedded} onBack={vi.fn()} /></ToastProvider>);
}

describe('TermWorkspacePage', () => {
  it('keeps the embedded period form compact while retaining Material calendar controls', async () => {
    renderTerm(createApi(), true);

    expect(await screen.findByRole('heading', { name: '实训周期' })).toBeVisible();
    expect(screen.queryByRole('heading', { level: 1, name: '建立实训周期' })).not.toBeInTheDocument();
    expect(screen.queryByText('一次确认本期实训范围：系统将同时创建周期、实际运营门店和首个教学周，避免留下未完成的基础配置。')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: '开始日期' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: /选择日期/ })).toHaveLength(4);
  });

  it('initializes the term, store, and first teaching week in one server command', async () => {
    const user = userEvent.setup();
    const api = createApi({
      initialize: vi.fn().mockResolvedValue({
        term: { id: 'term-id', code: '2026-AUTUMN', name: '2026 秋季实训', startDate: '2026-09-01', endDate: '2027-01-20', status: 'DRAFT', version: 1, updatedAt: '2026-08-21T00:00:00Z' },
        store: { id: 'store-id', code: 'DRINK-LAB', name: '饮品实训门店', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' },
        firstTeachingWeek: { id: 'week-id', termId: 'term-id', weekNumber: 1, name: '导入与准备', startDate: '2026-09-01', endDate: '2026-09-07', phaseCode: 'PREPARATION', version: 1, updatedAt: '2026-08-21T00:00:00Z' },
      }),
    });

    renderTerm(api);

    expect(await screen.findByRole('heading', { name: '建立实训周期' })).toBeVisible();
    await user.type(screen.getByLabelText('周期代码'), '2026-AUTUMN');
    await user.type(screen.getByLabelText('周期名称'), '2026 秋季实训');
    await user.click(screen.getByRole('group', { name: '开始日期' }));
    await user.keyboard('20260901');
    await user.click(screen.getByRole('group', { name: '结束日期' }));
    await user.keyboard('20270120');
    await user.type(screen.getByLabelText('门店代码'), 'DRINK-LAB');
    await user.type(screen.getByLabelText('门店名称'), '饮品实训门店');
    await user.type(screen.getByLabelText('首周名称'), '导入与准备');
    await user.click(screen.getByRole('group', { name: '首周开始日期' }));
    await user.keyboard('20260901');
    await user.click(screen.getByRole('group', { name: '首周结束日期' }));
    await user.keyboard('20260907');

    await user.click(screen.getByRole('button', { name: '创建实训周期' }));

    expect(api.initialize).toHaveBeenCalledWith({
      term: { code: '2026-AUTUMN', name: '2026 秋季实训', startDate: '2026-09-01', endDate: '2027-01-20' },
      store: { code: 'DRINK-LAB', name: '饮品实训门店' },
      firstTeachingWeek: { name: '导入与准备', startDate: '2026-09-01', endDate: '2026-09-07', phaseCode: 'PREPARATION' },
    });
    expect(await screen.findByRole('heading', { name: '2026 秋季实训' })).toBeVisible();
    expect(screen.getByText('饮品实训门店')).toBeVisible();
    expect(screen.getByText('第 1 教学周 · 导入与准备')).toBeVisible();
    const toast = await screen.findByRole('alert');
    expect(toast).toHaveTextContent('实训周期已建立。下一步可以配置运营模板。');
    expect(toast.closest('.MuiSnackbar-root')).toBeInTheDocument();
  });
});
