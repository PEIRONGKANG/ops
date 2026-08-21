import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { GovernanceApi } from './governanceApi';
import { TemplateWorkspacePage } from './TemplateWorkspacePage';

function createApi(overrides: Partial<GovernanceApi> = {}): GovernanceApi {
  return {
    initialize: vi.fn(),
    listTerms: vi.fn().mockResolvedValue([{ id: 'term-id', code: '2026-AUTUMN', name: '2026 秋季实训', startDate: '2026-09-01', endDate: '2027-01-20', status: 'DRAFT', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]),
    listStores: vi.fn().mockResolvedValue([{ id: 'store-id', code: 'DRINK-LAB', name: '饮品实训门店', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]),
    listTeachingWeeks: vi.fn(),
    bootstrapTemplate: vi.fn().mockResolvedValue({ id: 'template-id', termId: 'term-id', storeId: 'store-id', templateCode: 'DAILY-OPS', templateRevision: 1, name: '日常运营模板', status: 'DRAFT', effectiveFrom: '2026-09-01', effectiveUntil: null, version: 1, updatedAt: '2026-08-21T00:00:00Z' }),
    createTemplate: vi.fn().mockResolvedValue({ id: 'template-id', termId: 'term-id', storeId: 'store-id', templateCode: 'DAILY-OPS', templateRevision: 1, name: '日常运营模板', status: 'DRAFT', effectiveFrom: '2026-09-01', effectiveUntil: null, version: 1, updatedAt: '2026-08-21T00:00:00Z' }),
    listTemplateVersions: vi.fn().mockResolvedValue([]),
    publishTemplate: vi.fn().mockResolvedValue({ id: 'template-id', termId: 'term-id', storeId: 'store-id', templateCode: 'DAILY-OPS', templateRevision: 1, name: '日常运营模板', status: 'PUBLISHED', effectiveFrom: '2026-09-01', effectiveUntil: null, version: 2, updatedAt: '2026-08-21T00:00:00Z' }),
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

describe('TemplateWorkspacePage', () => {
  it('creates a governed draft with the first role and SOP, then publishes its returned version', async () => {
    const user = userEvent.setup();
    const api = createApi();

    render(<TemplateWorkspacePage api={api} onBack={vi.fn()} />);

    expect(await screen.findByRole('heading', { name: '配置运营模板' })).toBeVisible();
    await user.type(screen.getByLabelText('模板代码'), 'DAILY-OPS');
    await user.type(screen.getByLabelText('模板名称'), '日常运营模板');
    fireEvent.change(screen.getByLabelText('生效日期'), { target: { value: '2026-09-01' } });
    await user.type(screen.getByLabelText('岗位代码'), 'BARISTA');
    await user.type(screen.getByLabelText('岗位名称'), '吧台制作');
    await user.type(screen.getByLabelText('SOP 代码'), 'OPENING-CHECK');
    await user.type(screen.getByLabelText('SOP 名称'), '开档检查');
    await user.click(screen.getByRole('button', { name: '创建草稿模板' }));

    expect(api.bootstrapTemplate).toHaveBeenCalledWith({
      termId: 'term-id', storeId: 'store-id', templateCode: 'DAILY-OPS', name: '日常运营模板', effectiveFrom: '2026-09-01',
      configuration: {
        roles: [{ code: 'BARISTA', name: '吧台制作' }],
        tasks: [{ code: 'OPENING-CHECK', name: '开档检查' }],
      },
      role: { code: 'BARISTA', name: '吧台制作', configuration: { required: true } },
      sopTask: { code: 'OPENING-CHECK', name: '开档检查', configuration: { roleCode: 'BARISTA', evidenceRequired: false, requiresP2Acceptance: false } },
    });
    expect(await screen.findByText('草稿')).toBeVisible();

    await user.click(screen.getByRole('button', { name: '发布模板' }));

    expect(api.publishTemplate).toHaveBeenCalledWith('template-id', 1);
    expect(await screen.findByText('已发布')).toBeVisible();
  });

  it('refreshes the visible template when the governance scope changes', async () => {
    const user = userEvent.setup();
    const api = createApi({
      listTerms: vi.fn().mockResolvedValue([
        { id: 'term-id', code: '2026-AUTUMN', name: '2026 秋季实训', startDate: '2026-09-01', endDate: '2027-01-20', status: 'DRAFT', version: 1, updatedAt: '2026-08-21T00:00:00Z' },
        { id: 'term-2', code: '2027-SPRING', name: '2027 春季实训', startDate: '2027-02-20', endDate: '2027-06-30', status: 'DRAFT', version: 1, updatedAt: '2026-08-21T00:00:00Z' },
      ]),
      listTemplateVersions: vi.fn().mockImplementation(({ termId }: { termId?: string }) => Promise.resolve([{
        id: termId === 'term-2' ? 'template-2' : 'template-1', termId, storeId: 'store-id', templateCode: termId === 'term-2' ? 'SPRING-OPS' : 'AUTUMN-OPS', templateRevision: 1,
        name: termId === 'term-2' ? '春季运营模板' : '秋季运营模板', status: 'DRAFT', effectiveFrom: '2026-09-01', effectiveUntil: null, version: 1, updatedAt: '2026-08-21T00:00:00Z',
      }])),
    });

    render(<TemplateWorkspacePage api={api} onBack={vi.fn()} />);

    expect(await screen.findByText('秋季运营模板')).toBeVisible();
    await user.click(screen.getByRole('combobox', { name: '实训周期' }));
    await user.click(screen.getByRole('option', { name: '2027 春季实训 · 2027-SPRING' }));

    expect(await screen.findByText('春季运营模板')).toBeVisible();
  });
});
