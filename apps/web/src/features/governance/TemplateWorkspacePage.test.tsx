import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { GovernanceApi } from './governanceApi';
import { ToastProvider } from '@/shared/ui/feedback/ToastProvider';
import { TemplateWorkspacePage } from './TemplateWorkspacePage';

function createApi(overrides: Partial<GovernanceApi> = {}): GovernanceApi {
  return {
    initialize: vi.fn(),
    saveStartupPeriod: vi.fn(),
    listTerms: vi.fn().mockResolvedValue([{ id: 'term-id', code: '2026-AUTUMN', name: '2026 秋季实训', startDate: '2026-09-01', endDate: '2027-01-20', status: 'DRAFT', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]),
    listStores: vi.fn().mockResolvedValue([{ id: 'store-id', code: 'DRINK-LAB', name: '饮品实训门店', status: 'ACTIVE', version: 1, updatedAt: '2026-08-21T00:00:00Z' }]),
    listTeachingWeeks: vi.fn(),
    bootstrapTemplate: vi.fn().mockResolvedValue({ id: 'template-id', termId: 'term-id', storeId: 'store-id', templateCode: 'DAILY-OPS', templateRevision: 1, name: '日常运营模板', status: 'DRAFT', effectiveFrom: '2026-09-01', effectiveUntil: null, configuration: { roles: [{ code: 'BARISTA', name: '吧台制作' }], tasks: [{ code: 'OPENING-CHECK', name: '开档检查' }] }, version: 1, updatedAt: '2026-08-21T00:00:00Z' }),
    createTemplate: vi.fn().mockResolvedValue({ id: 'template-id', termId: 'term-id', storeId: 'store-id', templateCode: 'DAILY-OPS', templateRevision: 1, name: '日常运营模板', status: 'DRAFT', effectiveFrom: '2026-09-01', effectiveUntil: null, configuration: {}, version: 1, updatedAt: '2026-08-21T00:00:00Z' }),
    listTemplateVersions: vi.fn().mockResolvedValue([]),
    publishTemplate: vi.fn(),
    saveStarterTemplate: vi.fn().mockResolvedValue({
      template: { id: 'template-id', termId: 'term-id', storeId: 'store-id', templateCode: 'DAILY-OPS', templateRevision: 1, name: '更新后的运营模板', status: 'DRAFT', effectiveFrom: '2026-09-01', effectiveUntil: null, configuration: { roles: [{ code: 'BARISTA', name: '吧台制作' }], tasks: [{ code: 'OPENING-CHECK', name: '开档检查' }] }, version: 2, updatedAt: '2026-08-21T00:00:00Z' },
      role: { id: 'role-id', templateVersionId: 'template-id', componentType: 'ROLE', code: 'BARISTA', name: '吧台制作', configuration: { required: true }, version: 2, updatedAt: '2026-08-21T00:00:00Z' },
      sopTask: { id: 'task-id', templateVersionId: 'template-id', componentType: 'SOP_TASK', code: 'OPENING-CHECK', name: '开档检查', configuration: { roleCode: 'BARISTA', evidenceRequired: false, requiresP2Acceptance: false }, version: 2, updatedAt: '2026-08-21T00:00:00Z' },
    }),
    publishStartupConfiguration: vi.fn(),
    listTemplateComponents: vi.fn().mockImplementation((templateVersionId: string, componentPath: 'roles' | 'sop-tasks') => Promise.resolve(componentPath === 'roles'
      ? [{ id: 'role-id', templateVersionId, componentType: 'ROLE', code: 'BARISTA', name: '吧台制作', configuration: { required: true }, version: 1, updatedAt: '2026-08-21T00:00:00Z' }]
      : [{ id: 'task-id', templateVersionId, componentType: 'SOP_TASK', code: 'OPENING-CHECK', name: '开档检查', configuration: { roleCode: 'BARISTA', evidenceRequired: false, requiresP2Acceptance: false }, version: 1, updatedAt: '2026-08-21T00:00:00Z' }])),
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

function renderTemplate(api: GovernanceApi, embedded = false) {
  return render(<ToastProvider><TemplateWorkspacePage api={api} embedded={embedded} onBack={vi.fn()} /></ToastProvider>);
}

describe('TemplateWorkspacePage', () => {
  it('uses a compact Material calendar field without repeating its page introduction when embedded', async () => {
    renderTemplate(createApi(), true);

    const templateSection = await screen.findByRole('region', { name: '模板版本' });
    expect(templateSection).toBeVisible();
    expect(within(templateSection).getByLabelText('模板代码')).toBeVisible();
    expect(within(templateSection).getByLabelText('模板名称')).toBeVisible();
    expect(screen.queryByRole('heading', { level: 1, name: '配置运营模板' })).not.toBeInTheDocument();
    expect(screen.queryByText('模板定义稳定的岗位与 SOP。发布后版本不可直接修改；需要调整时建立下一修订版。')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: '生效日期' })).toBeVisible();
    expect(screen.getByRole('button', { name: /选择日期/ })).toBeVisible();
  });

  it('creates a governed draft with the first role and SOP, then keeps it editable without exposing direct publication', async () => {
    const user = userEvent.setup();
    const api = createApi();

    renderTemplate(api);

    expect(await screen.findByRole('heading', { name: '配置运营模板' })).toBeVisible();
    await user.type(screen.getByLabelText('模板代码'), 'DAILY-OPS');
    await user.type(screen.getByLabelText('模板名称'), '日常运营模板');
    await user.click(screen.getByRole('group', { name: '生效日期' }));
    await user.keyboard('20260901');
    await user.type(screen.getByLabelText('岗位代码'), 'BARISTA');
    await user.type(screen.getByLabelText('岗位名称'), '吧台制作');
    await user.type(screen.getByLabelText('SOP 代码'), 'OPENING-CHECK');
    await user.type(screen.getByLabelText('SOP 名称'), '开档检查');
    await user.click(screen.getByRole('button', { name: '保存模板草稿' }));

    expect(api.bootstrapTemplate).toHaveBeenCalledWith({
      termId: 'term-id', storeId: 'store-id', templateCode: 'DAILY-OPS', name: '日常运营模板', effectiveFrom: '2026-09-01',
      configuration: {
        roles: [{ code: 'BARISTA', name: '吧台制作' }],
        tasks: [{ code: 'OPENING-CHECK', name: '开档检查' }],
      },
      role: { code: 'BARISTA', name: '吧台制作', configuration: { required: true } },
      sopTask: { code: 'OPENING-CHECK', name: '开档检查', configuration: { roleCode: 'BARISTA', evidenceRequired: false, requiresP2Acceptance: false } },
    });
    expect(await screen.findByRole('button', { name: '保存模板草稿' })).toBeVisible();
    expect(screen.queryByRole('button', { name: '发布模板' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('模板代码')).toBeDisabled();
    expect(screen.getByLabelText('岗位代码')).toBeDisabled();
    expect(screen.getByLabelText('SOP 代码')).toBeDisabled();

    await user.clear(screen.getByLabelText('模板名称'));
    await user.type(screen.getByLabelText('模板名称'), '更新后的运营模板');
    await user.click(screen.getByRole('button', { name: '保存模板草稿' }));

    expect(api.saveStarterTemplate).toHaveBeenCalledWith('template-id', {
      template: {
        name: '更新后的运营模板',
        effectiveFrom: '2026-09-01',
        configuration: {
          roles: [{ code: 'BARISTA', name: '吧台制作' }],
          tasks: [{ code: 'OPENING-CHECK', name: '开档检查' }],
        },
        version: 1,
      },
      role: { id: 'role-id', name: '吧台制作', configuration: { required: true }, version: 1 },
      sopTask: {
        id: 'task-id',
        name: '开档检查',
        configuration: { roleCode: 'BARISTA', evidenceRequired: false, requiresP2Acceptance: false },
        version: 1,
      },
    });
    expect(api.publishTemplate).not.toHaveBeenCalled();
    const toast = await screen.findByRole('alert');
    expect(toast).toHaveTextContent('运营模板草稿已保存。');
    expect(toast.closest('.MuiSnackbar-root')).toBeInTheDocument();
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
        name: termId === 'term-2' ? '春季运营模板' : '秋季运营模板', status: 'DRAFT', effectiveFrom: '2026-09-01', effectiveUntil: null, configuration: {}, version: 1, updatedAt: '2026-08-21T00:00:00Z',
      }])),
    });

    renderTemplate(api);

    expect(await screen.findByDisplayValue('秋季运营模板')).toBeVisible();
    await user.click(screen.getByRole('combobox', { name: '实训周期' }));
    await user.click(screen.getByRole('option', { name: '2027 春季实训 · 2027-SPRING' }));

    expect(await screen.findByDisplayValue('春季运营模板')).toBeVisible();
  });
});
