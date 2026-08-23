import AddTaskRoundedIcon from '@mui/icons-material/AddTaskRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import ReportProblemRoundedIcon from '@mui/icons-material/ReportProblemRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import UndoRoundedIcon from '@mui/icons-material/UndoRounded';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel, IconButton, Radio, RadioGroup, Stack, TextField, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import type { AccountProfile } from '@/shared/api/authApi';
import { AppShell } from '@/shared/ui/components/AppShell';
import { PageScaffold } from '@/shared/ui/components/PageScaffold';
import { PageState } from '@/shared/ui/components/PageState';
import { StatusChip, type StatusTone } from '@/shared/ui/components/StatusChip';
import { useToast } from '@/shared/ui/feedback/ToastProvider';

import type { Assignment, Handover, Incident, Milestone, OperatingSummary, OperationsApi, OperationsToday, PersonalDashboard, PersonalShift, Shift, ShiftStatus, ShiftSummary, TaskCompletion } from './operationsApi';

interface OperationsWorkspacePageProps {
  api: OperationsApi;
  profile: AccountProfile;
}

interface ShiftDetails {
  shift: Shift | PersonalShift;
  assignments: Assignment[];
  tasks: TaskCompletion[];
  milestones: Milestone[];
  incidents: Incident[];
  handovers: Handover[];
  summaries: OperatingSummary[];
}

interface ActionDialog {
  kind: 'task-return' | 'milestone-return' | 'evidence' | 'incident' | 'handover' | 'summary';
  id?: string;
  version?: number;
}

const statusLabels: Record<string, string> = {
  DRAFT: '草稿', SCHEDULED: '已排班', IN_PROGRESS: '进行中', KEY_APPROVAL_PENDING: '待关键签核', CLOSED: '已关闭', CANCELLED: '已取消', REOPENED: '已重新开放',
  PENDING: '待处理', SUBMITTED: '待审核', RETURNED: '已退回', ACCEPTED: '已通过', WITHDRAWN: '已撤回', APPROVED: '已批准',
  OPEN: '待处置', ACKNOWLEDGED: '已知悉', ASSIGNED: '已指派', VERIFICATION_PENDING: '待验证', VERIFIED: '已验证', WAIVED: '已豁免',
  DRAFT_HANDOVER: '交接草稿', SUBMITTED_HANDOVER: '待接收', ACCEPTED_HANDOVER: '已接收', APPROVED_HANDOVER: '已确认', RETURNED_HANDOVER: '需补充',
};

const roleLabels: Record<string, string> = { P2: '现场负责人', P3: '岗位学员' };

export function OperationsWorkspacePage({ api, profile }: OperationsWorkspacePageProps) {
  const isP2 = profile.roles.includes('P2');
  const { showToast } = useToast();
  const [dashboard, setDashboard] = useState<PersonalDashboard | OperationsToday | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [details, setDetails] = useState<ShiftDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(false);
  const [actionDialog, setActionDialog] = useState<ActionDialog | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadDashboard = useCallback(async (preferredShiftId?: string | null) => {
    setLoading(true);
    setError(false);
    try {
      const value = isP2 ? await api.getToday() : await api.getPersonalDashboard();
      setDashboard(value);
      const availableIds = shiftSummaries(value).map((shift) => shift.id);
      const nextId = preferredShiftId && availableIds.includes(preferredShiftId) ? preferredShiftId : availableIds[0] ?? null;
      setSelectedShiftId(nextId);
      if (!nextId) setDetails(null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [api, isP2]);

  const loadDetails = useCallback(async (shiftId: string) => {
    setDetailsLoading(true);
    setDetailsError(false);
    try {
      const [shift, assignments, tasks, milestones, incidents, handovers, summaries] = await Promise.all([
        isP2 ? api.getShift(shiftId) : api.getPersonalShift(shiftId),
        api.listAssignments(shiftId),
        api.listTasks(shiftId),
        api.listMilestones(shiftId),
        api.listIncidents(shiftId),
        api.listHandovers(shiftId),
        api.listOperatingSummaries(shiftId),
      ]);
      setDetails({ shift, assignments, tasks, milestones, incidents, handovers, summaries });
    } catch {
      setDetailsError(true);
    } finally {
      setDetailsLoading(false);
    }
  }, [api, isP2]);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);
  useEffect(() => { if (selectedShiftId) void loadDetails(selectedShiftId); }, [loadDetails, selectedShiftId]);

  const refresh = async () => {
    await loadDashboard(selectedShiftId);
    if (selectedShiftId) await loadDetails(selectedShiftId);
  };

  const runAction = async (action: () => Promise<unknown>, successMessage: string) => {
    setSubmitting(true);
    try {
      await action();
      showToast({ message: successMessage, severity: 'success' });
      setActionDialog(null);
      await refresh();
    } catch {
      showToast({ action: { label: '重新加载', onClick: () => { void refresh(); } }, message: '操作未完成，请检查当前状态后重试。', severity: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const submitTask = async (task: TaskCompletion) => {
    if (task.evidenceRequired) {
      setActionDialog({ kind: 'evidence', id: task.id, version: task.version });
      return;
    }
    await runAction(() => api.submitTask(task.id, task.version), '任务已提交，等待现场负责人确认。');
  };

  const currentRole = isP2 ? 'P2' : 'P3';
  const pageDescription = isP2 ? '查看授权门店今天的班次、风险和待签核事项。' : '完成你的当班任务，留下可追溯的过程证据。';
  const notificationCount = isP2 ? p2QueueCount(dashboard as OperationsToday | null) : (dashboard as PersonalDashboard | null)?.unreadNotificationCount ?? 0;

  return (
    <AppShell
      headerContent={<StatusChip label={roleLabels[currentRole]} tone="success" />}
      notificationContent={<NotificationSummary count={notificationCount} role={currentRole} />}
      notificationCount={notificationCount}
    >
      <PageScaffold description={pageDescription} eyebrow="今日运营" title={isP2 ? '现场运行' : '我的当班'}>
        {loading ? <PageState description="正在读取今天的班次和待办事项。" kind="loading" title="正在同步运营状态" /> : null}
        {error ? <PageState description="无法读取当前角色的运营范围，请检查网络后重试。" kind="error" onRetry={() => { void loadDashboard(selectedShiftId); }} title="无法同步今日运营" /> : null}
        {!loading && !error ? (
          <Stack gap={{ xs: 3, md: 4 }}>
            <OperationsOverview dashboard={dashboard} isP2={isP2} onSelect={setSelectedShiftId} selectedShiftId={selectedShiftId} />
            <Divider />
            {selectedShiftId && detailsLoading ? <PageState description="正在读取班次任务、关键节点和风险。" kind="loading" title="正在打开班次" /> : null}
            {selectedShiftId && detailsError ? <PageState description="班次详情暂时不可用，请重新加载。" kind="error" onRetry={() => { void loadDetails(selectedShiftId); }} title="无法打开班次" /> : null}
            {details ? <ShiftWorkspace api={api} details={details} isP2={isP2} onActionDialog={setActionDialog} onRefresh={refresh} onRunAction={runAction} onSubmitTask={submitTask} /> : <EmptyOperations isP2={isP2} />}
          </Stack>
        ) : null}
      </PageScaffold>
      <OperationsDialog
        api={api}
        dialog={actionDialog}
        details={details}
        onClose={() => { if (!submitting) setActionDialog(null); }}
        onRun={runAction}
        submitting={submitting}
      />
    </AppShell>
  );
}

function OperationsOverview({ dashboard, isP2, onSelect, selectedShiftId }: { dashboard: PersonalDashboard | OperationsToday | null; isP2: boolean; onSelect: (id: string) => void; selectedShiftId: string | null }) {
  const groups = isP2 ? p2Groups(dashboard as OperationsToday | null) : [{ title: '我的班次', description: '选择一个班次开始工作。', items: ((dashboard as PersonalDashboard | null)?.assignedShifts ?? []).map((shift) => ({ id: shift.shiftId, title: shift.name, detail: `${shift.operatingDate} · ${shift.code} · ${roleLabels[shift.roleCode] ?? shift.roleCode}`, status: shift.status, version: shift.shiftVersion })) }];
  return (
    <Stack component="section" aria-label="今日运营待办" gap={2.5}>
      <Stack alignItems={{ xs: 'stretch', sm: 'center' }} direction={{ xs: 'column', sm: 'row' }} gap={1} justifyContent="space-between">
        <Stack gap={0.5}><Typography component="h2" variant="h2">今天</Typography><Typography color="text.secondary" variant="body2">所有状态均来自服务端，选择班次查看下一步操作。</Typography></Stack>
        <StatusChip label={isP2 ? `${p2QueueCount(dashboard as OperationsToday | null)} 项待处理` : `${((dashboard as PersonalDashboard | null)?.assignedShifts ?? []).length} 个班次`} tone={isP2 ? (p2QueueCount(dashboard as OperationsToday | null) ? 'warning' : 'success') : 'neutral'} />
      </Stack>
      <Stack gap={3}>
        {groups.map((group) => <QueueSection group={group} key={group.title} onSelect={onSelect} selectedShiftId={selectedShiftId} />)}
      </Stack>
    </Stack>
  );
}

function QueueSection({ group, onSelect, selectedShiftId }: { group: QueueGroup; onSelect: (id: string) => void; selectedShiftId: string | null }) {
  return (
    <Box component="section" aria-label={group.title}>
      <Stack gap={0.5} mb={1.5}><Typography component="h3" variant="h3">{group.title}</Typography><Typography color="text.secondary" variant="body2">{group.description}</Typography></Stack>
      {group.items.length ? <Stack divider={<Divider flexItem />}>
        {group.items.map((item) => <Box key={item.id} sx={{ backgroundColor: selectedShiftId === item.id ? 'var(--beverage-primary-container)' : 'transparent', borderRadius: 'var(--beverage-shape-medium)', transition: 'background-color 160ms ease' }}>
          <Button aria-pressed={selectedShiftId === item.id} fullWidth onClick={() => onSelect(item.id)} sx={{ justifyContent: 'space-between', minHeight: 72, px: { xs: 1.5, sm: 2 }, textAlign: 'left' }}>
            <Stack alignItems="flex-start" gap={0.35} minWidth={0}><Typography fontWeight={700} noWrap>{item.title}</Typography><Typography color="text.secondary" noWrap variant="body2">{item.detail}</Typography></Stack>
            <Stack alignItems="center" direction="row" gap={1} pl={1}><StatusChip label={statusLabel(item.status)} tone={statusTone(item.status)} /><ArrowForwardRoundedIcon fontSize="small" /></Stack>
          </Button>
        </Box>)}
      </Stack> : <Typography color="text.secondary" sx={{ py: 1 }} variant="body2">暂无事项</Typography>}
    </Box>
  );
}

function ShiftWorkspace({ api, details, isP2, onActionDialog, onRefresh, onRunAction, onSubmitTask }: { api: OperationsApi; details: ShiftDetails; isP2: boolean; onActionDialog: (dialog: ActionDialog) => void; onRefresh: () => Promise<void>; onRunAction: (action: () => Promise<unknown>, message: string) => Promise<void>; onSubmitTask: (task: TaskCompletion) => Promise<void> }) {
  const { shift, assignments, tasks, milestones, incidents, handovers } = details;
  return (
    <Stack component="section" aria-label="班次工作区" gap={{ xs: 3, md: 4 }}>
      <Stack alignItems={{ xs: 'flex-start', sm: 'center' }} direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between">
        <Stack gap={0.5}><Typography component="h2" variant="h2">{shift.name}</Typography><Typography color="text.secondary" variant="body2">{formatDateTime(shift.startsAt)} – {formatDateTime(shift.endsAt)} · {shift.code}</Typography></Stack>
        <ShiftLifecycle api={api} isP2={isP2} onRefresh={onRefresh} shift={shift} />
      </Stack>
      <Box display="grid" gap={{ xs: 3, lg: 4 }} gridTemplateColumns={{ xs: '1fr', lg: 'minmax(0, 1.6fr) minmax(280px, 0.8fr)' }}>
        <Stack gap={3} minWidth={0}>
          <TaskSection api={api} isP2={isP2} onActionDialog={onActionDialog} onRunAction={onRunAction} onSubmitTask={onSubmitTask} tasks={tasks} />
          <MilestoneSection api={api} isP2={isP2} onActionDialog={onActionDialog} onRunAction={onRunAction} milestones={milestones} />
          <SummarySection api={api} isP2={isP2} onActionDialog={onActionDialog} onRunAction={onRunAction} summaries={details.summaries} />
        </Stack>
        <Stack gap={3} minWidth={0}>
          <AssignmentSection assignments={assignments} />
          <IncidentSection api={api} incidents={incidents} isP2={isP2} onActionDialog={onActionDialog} onRunAction={onRunAction} />
          <HandoverSection api={api} handovers={handovers} isP2={isP2} onActionDialog={onActionDialog} onRunAction={onRunAction} />
        </Stack>
      </Box>
    </Stack>
  );
}

function TaskSection({ api, isP2, onActionDialog, onRunAction, onSubmitTask, tasks }: { api: OperationsApi; isP2: boolean; onActionDialog: (dialog: ActionDialog) => void; onRunAction: (action: () => Promise<unknown>, message: string) => Promise<void>; onSubmitTask: (task: TaskCompletion) => Promise<void>; tasks: TaskCompletion[] }) {
  return <FlatSection icon={<AddTaskRoundedIcon />} title="岗位任务" description={isP2 ? '查看执行进度，接受或退回需要补充的任务。' : '完成分配给你的 SOP 任务，并提交过程证据。'}>
    {tasks.length ? <Stack divider={<Divider flexItem />}>
      {tasks.map((task) => <TaskRow api={api} isP2={isP2} key={task.id} onActionDialog={onActionDialog} onRunAction={onRunAction} onSubmitTask={onSubmitTask} task={task} />)}
    </Stack> : <Typography color="text.secondary" variant="body2">这个班次还没有展开岗位任务。</Typography>}
  </FlatSection>;
}

function TaskRow({ api, isP2, onActionDialog, onRunAction, onSubmitTask, task }: { api: OperationsApi; isP2: boolean; onActionDialog: (dialog: ActionDialog) => void; onRunAction: (action: () => Promise<unknown>, message: string) => Promise<void>; onSubmitTask: (task: TaskCompletion) => Promise<void>; task: TaskCompletion }) {
  const canSubmit = !isP2 && (task.status === 'PENDING' || task.status === 'RETURNED');
  const canAccept = isP2 && task.status === 'SUBMITTED';
  return <Stack alignItems={{ xs: 'stretch', sm: 'center' }} direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between" py={2}>
    <Stack gap={0.45} minWidth={0}><Stack alignItems="center" direction="row" flexWrap="wrap" gap={1}><Typography fontWeight={700}>{task.name}</Typography><StatusChip label={statusLabel(task.status)} tone={statusTone(task.status)} /></Stack><Typography color="text.secondary" variant="body2">{task.code} · {task.roleCode}{task.evidenceRequired ? ' · 需要证据' : ''}{task.p2AcceptanceRequired ? ' · 需要 P2 确认' : ''}</Typography></Stack>
    <Stack direction="row" flexShrink={0} gap={1}>{canSubmit ? <Button onClick={() => { void onSubmitTask(task); }} startIcon={<SendRoundedIcon />} variant="contained">提交任务</Button> : null}{canAccept ? <Button onClick={() => { void onRunAction(() => api.acceptTask(task.id, task.version), '任务已通过。'); }} startIcon={<CheckRoundedIcon />} variant="contained">通过</Button> : null}{canAccept ? <Tooltip title="退回任务"><IconButton aria-label={`退回${task.name}`} onClick={() => onActionDialog({ kind: 'task-return', id: task.id, version: task.version })}><UndoRoundedIcon /></IconButton></Tooltip> : null}</Stack>
  </Stack>;
}

function MilestoneSection({ api, isP2, onActionDialog, onRunAction, milestones }: { api: OperationsApi; isP2: boolean; onActionDialog: (dialog: ActionDialog) => void; onRunAction: (action: () => Promise<unknown>, message: string) => Promise<void>; milestones: Milestone[] }) {
  return <FlatSection icon={<FactCheckRoundedIcon />} title="关键节点" description={isP2 ? '在开店、关键风险和闭店节点完成必要确认。' : '提交关键节点记录，等待现场负责人确认。'}>
    {milestones.length ? <Stack divider={<Divider flexItem />}>
      {milestones.map((milestone) => <Stack alignItems={{ xs: 'stretch', sm: 'center' }} direction={{ xs: 'column', sm: 'row' }} gap={1.5} justifyContent="space-between" key={milestone.id} py={2}><Stack gap={0.45}><Stack alignItems="center" direction="row" flexWrap="wrap" gap={1}><Typography fontWeight={700}>{milestone.name}</Typography><StatusChip label={statusLabel(milestone.status)} tone={statusTone(milestone.status)} /></Stack><Typography color="text.secondary" variant="body2">{milestone.code}{milestone.required ? ' · 必需节点' : ''}{milestone.evidenceRequired ? ' · 需要证据' : ''}</Typography></Stack><Stack direction="row" gap={1}>{!isP2 && (milestone.status === 'PENDING' || milestone.status === 'RETURNED') ? <Button onClick={() => { void onRunAction(() => api.submitMilestone(milestone.id, milestone.version), '关键节点已提交。'); }} startIcon={<SendRoundedIcon />} variant="outlined">提交</Button> : null}{isP2 && milestone.status === 'SUBMITTED' ? <Button onClick={() => { void onRunAction(() => api.approveMilestone(milestone.id, milestone.version), '关键节点已批准。'); }} startIcon={<CheckRoundedIcon />} variant="contained">批准</Button> : null}{isP2 && milestone.status === 'SUBMITTED' ? <Tooltip title="退回节点"><IconButton aria-label={`退回${milestone.name}`} onClick={() => onActionDialog({ kind: 'milestone-return', id: milestone.id, version: milestone.version })}><UndoRoundedIcon /></IconButton></Tooltip> : null}</Stack></Stack>)}
    </Stack> : <Typography color="text.secondary" variant="body2">当前班次没有关键节点。</Typography>}
  </FlatSection>;
}

function AssignmentSection({ assignments }: { assignments: Assignment[] }) {
  return <FlatSection icon={<AssignmentTurnedInRoundedIcon />} title="岗位安排" description="当前班次的人员与岗位关系。"><Stack divider={<Divider flexItem />}>{assignments.length ? assignments.map((assignment) => <Stack direction="row" justifyContent="space-between" key={assignment.id} py={1.5}><Typography variant="body2">{assignment.roleCode}</Typography><StatusChip label={statusLabel(assignment.status)} tone={assignment.status === 'ACTIVE' ? 'success' : 'neutral'} /></Stack>) : <Typography color="text.secondary" py={1} variant="body2">暂无岗位安排。</Typography>}</Stack></FlatSection>;
}

function IncidentSection({ api, incidents, isP2, onActionDialog, onRunAction }: { api: OperationsApi; incidents: Incident[]; isP2: boolean; onActionDialog: (dialog: ActionDialog) => void; onRunAction: (action: () => Promise<unknown>, message: string) => Promise<void> }) {
  return <FlatSection icon={<ReportProblemRoundedIcon />} title="异常处置" description={isP2 ? '确认、指派和验证异常，阻塞项未关闭前不能结束班次。' : '发现偏离标准的情况，立即上报并留下描述。'}>
    <Stack gap={1.5}>{incidents.length ? incidents.map((incident) => <Stack borderBottom={1} borderColor="divider" gap={0.75} key={incident.id} pb={1.5}><Stack alignItems="center" direction="row" gap={1} justifyContent="space-between"><Typography fontWeight={700}>{incident.categoryCode}</Typography><StatusChip label={statusLabels[incident.status] ?? incident.status} tone={incident.blocking ? 'danger' : statusTone(incident.status)} /></Stack><Typography color="text.secondary" variant="body2">{incident.description}</Typography>{isP2 && incident.status === 'OPEN' ? <Button onClick={() => { void onRunAction(() => api.acknowledgeIncident(incident.id, incident.version), '异常已确认知悉。'); }} size="small" startIcon={<CheckRoundedIcon />} variant="outlined">确认知悉</Button> : null}</Stack>) : <Typography color="text.secondary" variant="body2">暂无异常记录。</Typography>}{!isP2 ? <Button onClick={() => onActionDialog({ kind: 'incident' })} startIcon={<ReportProblemRoundedIcon />} variant="outlined">上报异常</Button> : null}{isP2 ? <Button onClick={() => onActionDialog({ kind: 'incident' })} startIcon={<ReportProblemRoundedIcon />} variant="outlined">登记异常</Button> : null}</Stack>
  </FlatSection>;
}

function HandoverSection({ api, handovers, isP2, onActionDialog, onRunAction }: { api: OperationsApi; handovers: Handover[]; isP2: boolean; onActionDialog: (dialog: ActionDialog) => void; onRunAction: (action: () => Promise<unknown>, message: string) => Promise<void> }) {
  return <FlatSection icon={<HandshakeRoundedIcon />} title="交接" description={isP2 ? '接受必要交接，确认后才能关闭班次。' : '记录需要交给下一班次的事项。'}><Stack gap={1.5}>{handovers.length ? handovers.map((handover) => <Stack borderBottom={1} borderColor="divider" gap={0.75} key={handover.id} pb={1.5}><Stack alignItems="center" direction="row" gap={1} justifyContent="space-between"><Typography fontWeight={700}>交接记录</Typography><StatusChip label={statusLabels[handover.status] ?? handover.status} tone={statusTone(handover.status)} /></Stack><Typography color="text.secondary" variant="body2">{handover.requiredForClose ? '关闭班次前必须完成' : '普通交接'}</Typography>{isP2 && handover.status.includes('SUBMITTED') ? <Button onClick={() => { void onRunAction(() => api.acceptHandover(handover.id, handover.version), '交接已接受。'); }} size="small" startIcon={<CheckRoundedIcon />} variant="outlined">接受交接</Button> : null}</Stack>) : <Typography color="text.secondary" variant="body2">暂无交接记录。</Typography>}{!isP2 ? <Button onClick={() => onActionDialog({ kind: 'handover' })} startIcon={<HandshakeRoundedIcon />} variant="outlined">创建交接</Button> : null}</Stack></FlatSection>;
}

function SummarySection({ api, isP2, onActionDialog, onRunAction, summaries }: { api: OperationsApi; isP2: boolean; onActionDialog: (dialog: ActionDialog) => void; onRunAction: (action: () => Promise<unknown>, message: string) => Promise<void>; summaries: OperatingSummary[] }) {
  return <FlatSection icon={<FactCheckRoundedIcon />} title="经营摘要" description="引用外部 POS、库存或财务系统的摘要，不替代外部系统事实。"><Stack gap={1.5}>{summaries.length ? summaries.map((summary) => <Stack borderBottom={1} borderColor="divider" gap={0.75} key={summary.id} pb={1.5}><Stack alignItems="center" direction="row" gap={1} justifyContent="space-between"><Typography fontWeight={700}>{summary.sourceSystem}</Typography><StatusChip label={summary.pendingSupplement ? '待补充' : statusLabel(summary.status)} tone={summary.pendingSupplement ? 'warning' : statusTone(summary.status)} /></Stack><Typography color="text.secondary" variant="body2">{summary.collectionMethod}{summary.note ? ` · ${summary.note}` : ''}</Typography>{isP2 && summary.status === 'PENDING' ? <Button onClick={() => { void onRunAction(() => api.confirmOperatingSummary(summary.id, summary.version), '经营摘要已确认。'); }} size="small" startIcon={<CheckRoundedIcon />} variant="outlined">确认摘要</Button> : null}</Stack>) : <Typography color="text.secondary" variant="body2">暂无外部经营摘要。</Typography>}<Button onClick={() => onActionDialog({ kind: 'summary' })} startIcon={<FactCheckRoundedIcon />} variant="outlined">登记摘要</Button></Stack></FlatSection>;
}

function ShiftLifecycle({ api, isP2, onRefresh, shift }: { api: OperationsApi; isP2: boolean; onRefresh: () => Promise<void>; shift: Shift | PersonalShift }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(false);
  const actions: Partial<Record<ShiftStatus, readonly [string, (shiftId: string, version: number) => Promise<Shift>]>> = {
    DRAFT: ['排班', api.scheduleShift],
    SCHEDULED: ['开始班次', api.startShift],
    IN_PROGRESS: ['请求关闭', api.requestCloseShift],
    KEY_APPROVAL_PENDING: ['关闭班次', api.closeShift],
  };
  const action = isP2 ? actions[shift.status] : undefined;
  if (!action) return <StatusChip label={statusLabel(shift.status)} tone={statusTone(shift.status)} />;
  return <Stack alignItems="center" direction="row" gap={1}><StatusChip label={statusLabel(shift.status)} tone={statusTone(shift.status)} /><Button disabled={busy} onClick={async () => { setBusy(true); try { await action[1](shift.id, shift.version); showToast({ message: `${action[0]}成功。`, severity: 'success' }); await onRefresh(); } catch { showToast({ message: '班次状态未更新，请刷新后重试。', severity: 'error' }); } finally { setBusy(false); } }} startIcon={shift.status === 'SCHEDULED' ? <PlayArrowRoundedIcon /> : <EventAvailableRoundedIcon />} variant="contained">{action[0]}</Button></Stack>;
}

function OperationsDialog({ api, dialog, details, onClose, onRun, submitting }: { api: OperationsApi; dialog: ActionDialog | null; details: ShiftDetails | null; onClose: () => void; onRun: (action: () => Promise<unknown>, message: string) => Promise<void>; submitting: boolean }) {
  const [reason, setReason] = useState('');
  const [text, setText] = useState('');
  const [category, setCategory] = useState('SERVICE');
  const [severity, setSeverity] = useState('MEDIUM');
  const [blocking, setBlocking] = useState('false');
  const [file, setFile] = useState<File | undefined>();
  useEffect(() => { if (dialog) { setReason(''); setText(''); setCategory('SERVICE'); setSeverity('MEDIUM'); setBlocking('false'); setFile(undefined); } }, [dialog]);
  if (!dialog) return null;
  const title = { 'task-return': '退回任务', 'milestone-return': '退回关键节点', evidence: '提交任务证据', incident: '登记运营异常', handover: '创建交接', summary: '登记经营摘要' }[dialog.kind];
  const submit = async () => {
    if (!details?.shift || submitting) return;
    if (dialog.kind === 'task-return' && dialog.id && dialog.version) return onRun(() => api.returnTask(dialog.id!, dialog.version!, reason), '任务已退回。');
    if (dialog.kind === 'milestone-return' && dialog.id && dialog.version) return onRun(() => api.returnMilestone(dialog.id!, dialog.version!, reason), '关键节点已退回。');
    if (dialog.kind === 'evidence' && dialog.id && dialog.version) return onRun(async () => { const evidence = await api.createEvidence({ taskCompletionId: dialog.id, kind: 'TEXT', textContent: text, occurredAt: new Date().toISOString() }); if (file) await api.uploadEvidenceFile(evidence.id, file); return api.submitTask(dialog.id!, dialog.version!); }, '证据已提交，任务已进入审核。');
    if (dialog.kind === 'incident') return onRun(() => api.createIncident({ shiftId: details.shift.id, categoryCode: category, severity, blocking: blocking === 'true', description: text }), '异常已登记。');
    if (dialog.kind === 'handover') return onRun(() => api.createHandover({ shiftId: details.shift.id, requiredForClose: true, content: { note: text } }), '交接草稿已创建。');
    if (dialog.kind === 'summary') return onRun(() => api.createOperatingSummary({ shiftId: details.shift.id, sourceSystem: category, collectionMethod: 'MANUAL_ENTRY', collectedAt: new Date().toISOString(), summaryData: {}, pendingSupplement: blocking === 'true', note: text }), '经营摘要已登记。');
  };
  const requiresReason = dialog.kind === 'task-return' || dialog.kind === 'milestone-return';
  return <Dialog fullWidth maxWidth="sm" onClose={onClose} open><DialogTitle>{title}</DialogTitle><DialogContent dividers><Stack gap={2} pt={0.5}>{requiresReason ? <TextField autoFocus label="退回原因" multiline minRows={3} onChange={(event) => setReason(event.target.value)} value={reason} /> : null}{dialog.kind === 'evidence' ? <><TextField autoFocus label="证据说明" multiline minRows={3} onChange={(event) => setText(event.target.value)} value={text} /><Button component="label" variant="outlined">添加文件<input hidden onChange={(event) => setFile(event.target.files?.[0])} type="file" /></Button>{file ? <Typography color="text.secondary" variant="body2">已选择：{file.name}</Typography> : null}</> : null}{dialog.kind === 'incident' ? <><TextField label="异常描述" multiline minRows={3} onChange={(event) => setText(event.target.value)} value={text} /><TextField label="异常类别" onChange={(event) => setCategory(event.target.value)} value={category} /><TextField label="严重程度" onChange={(event) => setSeverity(event.target.value)} value={severity} /><RadioGroup onChange={(event) => setBlocking(event.target.value)} row value={blocking}><FormControlLabel control={<Radio />} label="一般" value="false" /><FormControlLabel control={<Radio />} label="阻塞班次" value="true" /></RadioGroup></> : null}{dialog.kind === 'handover' ? <TextField autoFocus label="交接内容" multiline minRows={4} onChange={(event) => setText(event.target.value)} value={text} /> : null}{dialog.kind === 'summary' ? <><TextField autoFocus label="来源系统" onChange={(event) => setCategory(event.target.value)} value={category} /><TextField label="摘要说明" multiline minRows={3} onChange={(event) => setText(event.target.value)} value={text} /><RadioGroup onChange={(event) => setBlocking(event.target.value)} row value={blocking}><FormControlLabel control={<Radio />} label="已完整采集" value="false" /><FormControlLabel control={<Radio />} label="待后续补充" value="true" /></RadioGroup></> : null}</Stack></DialogContent><DialogActions><Button disabled={submitting} onClick={onClose}>取消</Button><Button disabled={submitting || (requiresReason && !reason.trim()) || ((dialog.kind === 'evidence' || dialog.kind === 'incident' || dialog.kind === 'handover' || dialog.kind === 'summary') && !text.trim())} onClick={() => { void submit(); }} variant="contained">确认</Button></DialogActions></Dialog>;
}

function FlatSection({ children, description, icon, title }: { children: ReactNode; description: string; icon: ReactNode; title: string }) {
  return <Stack aria-label={title} borderTop={1} borderColor="divider" component="section" gap={1.5} pt={2.5}><Stack alignItems="center" direction="row" gap={1}><Box color="primary.main" display="flex">{icon}</Box><Typography component="h3" variant="h3">{title}</Typography></Stack><Typography color="text.secondary" variant="body2">{description}</Typography>{children}</Stack>;
}

function EmptyOperations({ isP2 }: { isP2: boolean }) { return <PageState description={isP2 ? '授权门店今天还没有需要处理的班次。' : '你目前没有被分配到今天的班次。'} kind="empty" title={isP2 ? '今天没有待办班次' : '今天没有当班安排'} />; }

function NotificationSummary({ count, role }: { count: number; role: string }) { return <Stack gap={1}><Typography color="primary" fontWeight={800} variant="overline">{role === 'P2' ? '现场管理' : '当班提醒'}</Typography><Typography component="h2" variant="h3">{count ? `有 ${count} 项事项需要关注` : '当前没有未读事项'}</Typography><Typography color="text.secondary" variant="body2">班次状态、任务提交和异常变化会在这里提醒你。</Typography></Stack>; }

function shiftSummaries(value: PersonalDashboard | OperationsToday): { id: string }[] {
  if ('assignedShifts' in value) return value.assignedShifts.map((shift) => ({ id: shift.shiftId }));
  return [...value.draftShifts, ...value.pendingApprovalShifts, ...value.blockingIncidentShifts, ...value.pendingHandoverShifts].map((shift) => ({ id: shift.id }));
}

interface QueueItem { id: string; title: string; detail: string; status: string; version: number }
interface QueueGroup { title: string; description: string; items: QueueItem[] }

function p2Groups(value: OperationsToday | null): QueueGroup[] {
  if (!value) return [];
  return [
    { title: '待排班', description: '确认人员与岗位后开始班次。', items: value.draftShifts.map(queueItem) },
    { title: '待关键签核', description: '班次存在需要现场负责人确认的节点。', items: value.pendingApprovalShifts.map(queueItem) },
    { title: '阻塞异常', description: '异常验证完成前，班次不能关闭。', items: value.blockingIncidentShifts.map(queueItem) },
    { title: '待接受交接', description: '接受必要交接后才能完成班次收尾。', items: value.pendingHandoverShifts.map(queueItem) },
  ];
}

function queueItem(shift: ShiftSummary): QueueItem { return { id: shift.id, title: shift.name, detail: `${shift.operatingDate} · ${shift.code}`, status: shift.status, version: shift.version }; }
function p2QueueCount(value: OperationsToday | null) { return value ? value.draftShifts.length + value.pendingApprovalShifts.length + value.blockingIncidentShifts.length + value.pendingHandoverShifts.length : 0; }
function statusLabel(value: string) { return statusLabels[value] ?? value; }
function statusTone(value: string): StatusTone { if (['ACCEPTED', 'APPROVED', 'CLOSED', 'VERIFIED', 'ACTIVE'].includes(value)) return 'success'; if (['RETURNED', 'OPEN', 'BLOCKING', 'KEY_APPROVAL_PENDING', 'SUBMITTED', 'ASSIGNED'].includes(value)) return 'warning'; if (['CANCELLED', 'WITHDRAWN'].includes(value)) return 'danger'; return 'neutral'; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
