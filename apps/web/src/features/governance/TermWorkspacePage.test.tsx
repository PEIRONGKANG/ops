import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { GovernanceApi } from './governanceApi';
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

describe('TermWorkspacePage', () => {
  it('initializes the term, store, and first teaching week in one server command', async () => {
    const user = userEvent.setup();
    const api = createApi({
      initialize: vi.fn().mockResolvedValue({
        term: { id: 'term-id', code: '2026-AUTUMN', name: '2026 秋季实训', startDate: '2026-09-01', endDate: '2027-01-20', status: 'DRAFT', version: 1, updatedAt: '2026-08-21T00:00:00Z' },
        store: { id: 'store-id', code: 'DRINK-LAB', name: '饮品实训门店', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' },
        firstTeachingWeek: { id: 'week-id', termId: 'term-id', weekNumber: 1, name: '导入与准备', startDate: '2026-09-01', endDate: '2026-09-07', phaseCode: 'PREPARATION', version: 1, updatedAt: '2026-08-21T00:00:00Z' },
      }),
    });

    render(<TermWorkspacePage api={api} onBack={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: '建立实训周期' })).toBeVisible();
    await user.type(screen.getByLabelText('周期代码'), '2026-AUTUMN');
    await user.type(screen.getByLabelText('周期名称'), '2026 秋季实训');
    fireEvent.change(screen.getByLabelText('开始日期'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('结束日期'), { target: { value: '2027-01-20' } });
    await user.type(screen.getByLabelText('门店代码'), 'DRINK-LAB');
    await user.type(screen.getByLabelText('门店名称'), '饮品实训门店');
    await user.type(screen.getByLabelText('首周名称'), '导入与准备');
    fireEvent.change(screen.getByLabelText('首周开始日期'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('首周结束日期'), { target: { value: '2026-09-07' } });

    await user.click(screen.getByRole('button', { name: '创建实训周期' }));

    expect(api.initialize).toHaveBeenCalledWith({
      term: { code: '2026-AUTUMN', name: '2026 秋季实训', startDate: '2026-09-01', endDate: '2027-01-20' },
      store: { code: 'DRINK-LAB', name: '饮品实训门店' },
      firstTeachingWeek: { name: '导入与准备', startDate: '2026-09-01', endDate: '2026-09-07', phaseCode: 'PREPARATION' },
    });
    expect(await screen.findByRole('heading', { name: '2026 秋季实训' })).toBeVisible();
    expect(screen.getByText('饮品实训门店')).toBeVisible();
    expect(screen.getByText('第 1 教学周 · 导入与准备')).toBeVisible();
  });
});
