import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { AccountProfile } from '@/shared/api/authApi';
import { ToastProvider } from '@/shared/ui/feedback/ToastProvider';

import { OperationsWorkspacePage } from './OperationsWorkspacePage';
import type { OperationsApi } from './operationsApi';

function setup(role: 'P2' | 'P3', overrides: Partial<OperationsApi> = {}) {
  const shift = { id: 'shift-1', operatingDayId: 'day-1', termId: 'term-1', storeId: 'store-1', operatingDate: '2026-08-23', code: 'MORNING', name: '早班', startsAt: '2026-08-23T08:00:00Z', endsAt: '2026-08-23T12:00:00Z', status: 'IN_PROGRESS' as const, cancellationReason: null, version: 1, updatedAt: '2026-08-23T08:00:00Z' };
  const api: OperationsApi = {
    getPersonalDashboard: vi.fn().mockResolvedValue({ assignedShifts: [{ shiftId: 'shift-1', operatingDayId: 'day-1', operatingDate: '2026-08-23', code: 'MORNING', name: '早班', roleCode: 'BARISTA', status: 'IN_PROGRESS', shiftVersion: 1 }], unreadNotificationCount: 1 }),
    getToday: vi.fn().mockResolvedValue({ draftShifts: [], pendingApprovalShifts: [{ id: 'shift-1', operatingDayId: 'day-1', operatingDate: '2026-08-23', code: 'MORNING', name: '早班', status: 'KEY_APPROVAL_PENDING', version: 1, storeId: 'store-1' }], blockingIncidentShifts: [], pendingHandoverShifts: [], operatingDate: '2026-08-23' }),
    getPersonalShift: vi.fn().mockResolvedValue({ ...shift, roleCode: 'BARISTA', assignmentStatus: 'ACTIVE' }),
    getShift: vi.fn().mockResolvedValue(shift),
    listAssignments: vi.fn().mockResolvedValue([{ id: 'assignment-1', shiftId: 'shift-1', accountId: 'account-1', roleCode: 'BARISTA', status: 'ACTIVE', version: 1, updatedAt: shift.updatedAt }]),
    listTasks: vi.fn().mockResolvedValue([{ id: 'task-1', shiftId: 'shift-1', assignmentId: 'assignment-1', code: 'OPEN', name: '开店检查', roleCode: 'BARISTA', evidenceRequired: false, p2AcceptanceRequired: true, status: role === 'P2' ? 'SUBMITTED' : 'PENDING', version: 1, updatedAt: shift.updatedAt }]),
    listMilestones: vi.fn().mockResolvedValue([]),
    listIncidents: vi.fn().mockResolvedValue([]),
    listHandovers: vi.fn().mockResolvedValue([]),
    listOperatingSummaries: vi.fn().mockResolvedValue([]),
    submitTask: vi.fn().mockResolvedValue({}),
    returnTask: vi.fn().mockResolvedValue({}),
    acceptTask: vi.fn().mockResolvedValue({}),
    withdrawTask: vi.fn().mockResolvedValue({}),
    submitMilestone: vi.fn().mockResolvedValue({}),
    approveMilestone: vi.fn().mockResolvedValue({}),
    returnMilestone: vi.fn().mockResolvedValue({}),
    createEvidence: vi.fn().mockResolvedValue({ id: 'evidence-1' }),
    uploadEvidenceFile: vi.fn().mockResolvedValue({}),
    createIncident: vi.fn().mockResolvedValue({}),
    acknowledgeIncident: vi.fn().mockResolvedValue({}),
    assignIncident: vi.fn().mockResolvedValue({}),
    submitIncidentVerification: vi.fn().mockResolvedValue({}),
    closeIncident: vi.fn().mockResolvedValue({}),
    waiveBlockingIncident: vi.fn().mockResolvedValue({}),
    createHandover: vi.fn().mockResolvedValue({}),
    submitHandover: vi.fn().mockResolvedValue({}),
    acceptHandover: vi.fn().mockResolvedValue({}),
    returnHandover: vi.fn().mockResolvedValue({}),
    approveHandover: vi.fn().mockResolvedValue({}),
    createOperatingSummary: vi.fn().mockResolvedValue({}),
    confirmOperatingSummary: vi.fn().mockResolvedValue({}),
    scheduleShift: vi.fn().mockResolvedValue(shift),
    startShift: vi.fn().mockResolvedValue(shift),
    requestCloseShift: vi.fn().mockResolvedValue(shift),
    closeShift: vi.fn().mockResolvedValue(shift),
    ...overrides,
  };
  const profile: AccountProfile = { id: 'account-1', loginId: role, displayName: role === 'P2' ? '现场负责人' : '岗位学员', roles: [role] };
  render(<ToastProvider><OperationsWorkspacePage api={api} profile={profile} /></ToastProvider>);
  return { api };
}

describe('OperationsWorkspacePage', () => {
  it('gives P3 a task-first view and submits an assigned task', async () => {
    const user = userEvent.setup();
    const { api } = setup('P3');

    expect(await screen.findByRole('heading', { name: '我的当班' })).toBeVisible();
    expect(await screen.findByText('开店检查')).toBeVisible();
    expect(screen.getByRole('region', { name: '岗位任务' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '提交任务' }));

    await waitFor(() => expect(api.submitTask).toHaveBeenCalledWith('task-1', 1));
    expect(screen.queryByRole('button', { name: '通过' })).not.toBeInTheDocument();
    expect(screen.getByText('任务已提交，等待现场负责人确认。')).toBeVisible();
  });

  it('gives P2 actionable queues and exposes acceptance controls for submitted tasks', async () => {
    const user = userEvent.setup();
    const { api } = setup('P2');

    expect(await screen.findByRole('heading', { name: '现场运行' })).toBeVisible();
    expect(await screen.findByText('开店检查')).toBeVisible();
    expect(screen.getByRole('region', { name: '待关键签核' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '通过' }));

    await waitFor(() => expect(api.acceptTask).toHaveBeenCalledWith('task-1', 1));
    expect(screen.queryByRole('button', { name: '提交任务' })).not.toBeInTheDocument();
  });

  it('requires evidence text before a P3 evidence-required task can be submitted', async () => {
    const user = userEvent.setup();
    const { api } = setup('P3', { listTasks: vi.fn().mockResolvedValue([{ id: 'task-1', shiftId: 'shift-1', assignmentId: 'assignment-1', code: 'CLOSE', name: '闭店记录', roleCode: 'BARISTA', evidenceRequired: true, p2AcceptanceRequired: false, status: 'PENDING', version: 3, updatedAt: '2026-08-23T08:00:00Z' }]) });

    await screen.findByRole('heading', { name: '我的当班' });
    await screen.findByText('闭店记录');
    await user.click(screen.getByRole('button', { name: '提交任务' }));
    expect(screen.getByRole('dialog', { name: '提交任务证据' })).toBeVisible();
    expect(screen.getByRole('button', { name: '确认' })).toBeDisabled();
    await user.type(screen.getByLabelText('证据说明'), '闭店检查已完成');
    await user.click(screen.getByRole('button', { name: '确认' }));

    await waitFor(() => {
      expect(api.createEvidence).toHaveBeenCalledWith(expect.objectContaining({ taskCompletionId: 'task-1', kind: 'TEXT', textContent: '闭店检查已完成' }));
      expect(api.submitTask).toHaveBeenCalledWith('task-1', 3);
    });
  });
});
