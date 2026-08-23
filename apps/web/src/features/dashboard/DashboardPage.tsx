import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { Box, Button, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { PeopleWorkspacePage } from '@/features/governance/PeopleWorkspacePage';
import { TemplateWorkspacePage } from '@/features/governance/TemplateWorkspacePage';
import { TermWorkspacePage } from '@/features/governance/TermWorkspacePage';
import type { AccountSummary, GovernanceApi, Store, TeachingWeek, Team, TemplateVersion, Term } from '@/features/governance/governanceApi';
import type { AccountProfile } from '@/shared/api/authApi';
import { AppShell } from '@/shared/ui/components/AppShell';
import { PageScaffold } from '@/shared/ui/components/PageScaffold';
import { PageState } from '@/shared/ui/components/PageState';
import { SupportingActionPane } from '@/shared/ui/components/SupportingActionPane';
import { useToast } from '@/shared/ui/feedback/ToastProvider';

import { StartupStepper, type StartupSteps, type StartupStepStatuses } from './StartupStepper';

interface DashboardPageProps {
  api: GovernanceApi;
  profile: AccountProfile;
}

interface StartupProgress {
  people: boolean;
  period: boolean;
  published: boolean;
  template: boolean;
}

interface StartupSnapshot {
  term: Term | null;
  store: Store | null;
  firstTeachingWeek: TeachingWeek | null;
  template: TemplateVersion | null;
  teams: Team[];
  activeAccounts: AccountSummary[];
}

const roleLabels: Record<AccountProfile['roles'][number], string> = {
  P1: '运营治理',
  P2: '现场负责人',
  P3: '岗位学员',
  T1: '带教教师',
  EXTERNAL_REVIEWER: '外部评审',
};

const workspaceTitles = ['实训周期', '运营模板', '实训人员'];

export function DashboardPage({ api, profile }: DashboardPageProps) {
  const [progress, setProgress] = useState<StartupProgress>({ period: false, template: false, people: false, published: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [publication, setPublication] = useState<{ term: Term; templateId: string; templateVersion: number } | null>(null);
  const [snapshot, setSnapshot] = useState<StartupSnapshot>({ term: null, store: null, firstTeachingWeek: null, template: null, teams: [], activeAccounts: [] });
  const { showToast } = useToast();
  const configurationRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [terms, stores] = await Promise.all([api.listTerms(), api.listStores()]);
      const term = preferredTerm(terms);
      const store = preferredStore(stores);
      const period = Boolean(term && store);
      if (!term || !store) {
        setProgress({ period, template: false, people: false, published: false });
        setPublication(null);
        setSnapshot({ term: null, store: null, firstTeachingWeek: null, template: null, teams: [], activeAccounts: [] });
        return;
      }

      const [weeks, templates, teams, memberships, accounts] = await Promise.all([
        api.listTeachingWeeks(term.id),
        api.listTemplateVersions({ termId: term.id, storeId: store.id }),
        api.listTeams(term.id),
        api.listMemberships(term.id),
        api.listAccounts('ACTIVE'),
      ]);
      const activeTeamIds = new Set(teams.filter((team) => team.status === 'ACTIVE').map((team) => team.id));
      const activeAccountIds = new Set(accounts.map((account) => account.id));
      const template = templates.find((item) => item.status === 'DRAFT') ?? templates.find((item) => item.status === 'PUBLISHED');
      const templateConfigured = Boolean(template);
      const published = term.status === 'PUBLISHED' && template?.status === 'PUBLISHED';
      const firstTeachingWeek = weeks.find((week) => week.weekNumber === 1) ?? null;
      setSnapshot({ term, store, firstTeachingWeek, template: template ?? null, teams, activeAccounts: accounts });
      setProgress({
        period: period && weeks.some((week) => week.weekNumber === 1),
        template: templateConfigured,
        people: memberships.some((membership) => membership.status === 'ACTIVE' && membership.teamId !== null && activeTeamIds.has(membership.teamId) && activeAccountIds.has(membership.accountId)),
        published,
      });
      setPublication(template ? { term, templateId: template.id, templateVersion: template.version } : null);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const statuses = useMemo<StartupStepStatuses>(() => [
    progress.published || progress.period ? 'complete' : 'current',
    progress.published || progress.template ? 'complete' : progress.period ? 'current' : 'blocked',
    progress.published ? 'complete' : progress.template ? 'current' : 'blocked',
  ], [progress.period, progress.published, progress.template]);
  const currentStepIndex = statuses.findIndex((status) => status === 'current');
  const visibleStepIndex = selectedStepIndex !== null && statuses[selectedStepIndex] !== 'blocked'
    ? selectedStepIndex
    : currentStepIndex;
  const current = loadError
    ? { description: '暂时无法确认周期、模板与人员配置。请在工作台中重试。' }
    : currentState(progress, loading);
  const steps = useMemo<StartupSteps>(() => [
    { status: statuses[0], title: '建立实训周期' },
    { status: statuses[1], title: '配置运营模板' },
    { status: statuses[2], title: '组织实训人员' },
  ], [statuses]);
  const currentStep = currentStepIndex === -1 ? undefined : steps[currentStepIndex];
  const notificationCount = statuses.filter((status) => status !== 'complete').length;
  const configurationAvailable = !loading && !loadError;
  const showInitialPeriodForward = configurationAvailable && visibleStepIndex === 0 && !progress.period;

  useEffect(() => {
    if (configurationAvailable && currentStepIndex >= 0 && (selectedStepIndex === null || statuses[selectedStepIndex] === 'blocked')) {
      setSelectedStepIndex(currentStepIndex);
    }
  }, [configurationAvailable, currentStepIndex, selectedStepIndex, statuses]);

  const focusCurrentConfiguration = () => {
    setSelectedStepIndex(currentStepIndex);
    configurationRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  const publish = async () => {
    if (!publication) return;
    try {
      await api.publishStartupConfiguration(publication.term.id, {
        templateVersionId: publication.templateId,
        termVersion: publication.term.version,
        templateVersion: publication.templateVersion,
      });
      showToast({ message: '实训配置已发布，周期与运营模板现已生效。', severity: 'success' });
      await load();
    } catch {
      showToast({ action: { label: '重新加载', onClick: () => { void load(); } }, message: '发布未完成，请重新加载后确认配置状态。', severity: 'error' });
    }
  };

  return (
    <AppShell
      headerContent={profile.roles.map((role) => <Chip color="primary" key={role} label={roleLabels[role]} size="small" variant="outlined" />)}
      notificationContent={
        <Stack gap={1.25}>
          <Typography color="primary" fontWeight={800} variant="overline">运营工作台</Typography>
          <Typography component="h2" variant="h3">{profile.displayName}，欢迎回来</Typography>
          <Typography color="text.secondary" variant="body2">{current.description}</Typography>
          {configurationAvailable && currentStep ? <Box pt={0.5}><Button onClick={focusCurrentConfiguration} variant="contained">{currentStep.title}</Button></Box> : null}
          {configurationAvailable && !currentStep ? <Typography color="success.main" fontWeight={700} variant="body2">启动清单已完成</Typography> : null}
        </Stack>
      }
      notificationCount={notificationCount}
    >
      <PageScaffold
        actions={configurationAvailable && visibleStepIndex > 0 ? <Button onClick={() => setSelectedStepIndex(visibleStepIndex - 1)} size="small" variant="text">返回上一步</Button> : undefined}
        title={!configurationAvailable || visibleStepIndex === -1 ? '实训配置' : workspaceTitles[visibleStepIndex]}
      >
        {loading ? <PageState description="正在读取当前周期、模板和人员组织情况。" kind="loading" title="正在同步启动状态" /> : null}
        {loadError ? <PageState description="无法确认周期、模板与人员配置，请检查网络后重试。" kind="error" onRetry={() => { void load(); }} title="无法同步启动状态" /> : null}
        {configurationAvailable ? (
          <Stack gap={{ xs: 2.5, md: 3 }}>
            <StartupStepper onSelect={setSelectedStepIndex} selected={visibleStepIndex} steps={steps} />

            <Box component="section" ref={configurationRef} aria-label="当前步骤配置">
              {visibleStepIndex !== -1 ? (
                <Box display="grid" gap={{ xs: 3, lg: 4 }} gridTemplateColumns={{ xs: '1fr', lg: 'minmax(0, 2fr) minmax(240px, 1fr)' }}>
                  <Box minWidth={0}>
                    {visibleStepIndex === 0 ? <TermWorkspacePage api={api} embedded formId="startup-period-form" onInitialized={() => { setSelectedStepIndex(1); void load(); }} /> : null}
                    {visibleStepIndex === 1 ? <TemplateWorkspacePage api={api} embedded formId="startup-template-form" onSaved={() => { setSelectedStepIndex(2); void load(); }} /> : null}
                    {visibleStepIndex === 2 ? <PeopleWorkspacePage api={api} embedded onMembershipChanged={() => { void load(); }} /> : null}
                  </Box>
                  <StartupActionPane
                    canPublish={visibleStepIndex === 2 && progress.people && Boolean(publication) && !progress.published}
                    formId={visibleStepIndex === 0 ? 'startup-period-form' : visibleStepIndex === 1 ? 'startup-template-form' : undefined}
                    initialPeriod={showInitialPeriodForward}
                    mainLabel={visibleStepIndex === 0 ? '保存修改' : visibleStepIndex === 1 ? (progress.template ? '保存修改' : '保存模板草稿') : undefined}
                    onPublish={() => { void publish(); }}
                    stepIndex={visibleStepIndex}
                  />
                </Box>
              ) : null}
              {visibleStepIndex === -1 ? <StartupComplete onContinue={() => showToast({ message: '实训配置已完成，当前信息已保存为只读摘要。', severity: 'success' })} onEdit={() => setSelectedStepIndex(0)} snapshot={snapshot} /> : null}
            </Box>
          </Stack>
        ) : null}
      </PageScaffold>
    </AppShell>
  );
}

function StartupForwardAction({ formId }: { formId: string }) {
  return (
    <Box display="flex" justifyContent="center" width="100%">
      <Tooltip placement="left" title="创建实训周期">
        <IconButton
          aria-label="创建实训周期"
          data-testid="startup-period-forward"
          form={formId}
          sx={{
            backgroundColor: 'var(--beverage-primary-container)',
            color: 'primary.main',
            height: 56,
            opacity: 0.72,
            transition: 'opacity 180ms ease, transform 180ms ease',
            width: 56,
            '&:hover': { backgroundColor: 'var(--beverage-primary-container)', opacity: 1, transform: 'translateX(3px)' },
          }}
          type="submit"
        >
          <ArrowForwardRoundedIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function StartupActionPane({ canPublish, formId, initialPeriod, mainLabel, onPublish, stepIndex }: {
  canPublish: boolean;
  formId?: string;
  initialPeriod: boolean;
  mainLabel?: string;
  onPublish: () => void;
  stepIndex: number;
}) {
  const titles = ['完成实训周期', '保存运营模板', '发布实训配置'];
  const descriptions = [
    initialPeriod ? '确认周期、门店与首周信息。创建后将进入运营模板配置。' : '保存本步骤的修改后，可以继续返回其他草稿步骤。',
    '保存运营模板草稿后，将进入实训人员组织。发布前仍可返回修改。',
    '确认团队与成员已就绪，然后一次发布周期和运营模板。',
  ];
  const action = initialPeriod && formId
    ? <StartupForwardAction formId={formId} />
    : mainLabel && formId
      ? <Button form={formId} type="submit" variant="contained">{mainLabel}</Button>
      : canPublish
        ? <Button onClick={onPublish} variant="contained">发布实训配置</Button>
        : undefined;

  return (
    <SupportingActionPane action={action} title={titles[stepIndex]}>
      <Typography color="text.secondary" variant="body2">{descriptions[stepIndex]}</Typography>
    </SupportingActionPane>
  );
}

function StartupComplete({ onContinue, onEdit, snapshot }: {
  onContinue: () => void;
  onEdit: () => void;
  snapshot: StartupSnapshot;
}) {
  const { term, store, firstTeachingWeek, template, teams, activeAccounts } = snapshot;
  const activeTeams = teams.filter((team) => team.status === 'ACTIVE');
  const activeMembers = activeAccounts.filter((account) => account.status === 'ACTIVE');

  return (
    <Box
      bgcolor="background.paper"
      border={1}
      borderColor="divider"
      borderRadius="var(--beverage-shape-large)"
      overflow="hidden"
    >
      <Box
        display="grid"
        gridTemplateColumns={{ xs: '1fr', lg: 'minmax(0, 1fr) 320px' }}
        minWidth={0}
      >
        <Box minWidth={0} p={{ xs: 2.5, sm: 4, lg: 5 }}>
          <Stack gap={1} mb={{ xs: 3, sm: 4 }}>
            <Typography color="primary" fontWeight={800} variant="overline">实训周期</Typography>
            <Typography component="h2" variant="h2">实训信息</Typography>
            <Typography color="text.secondary" maxWidth={680} variant="body1">
              基础配置已经发布。以下信息将作为本期饮品生产性实训的统一运营上下文。
            </Typography>
          </Stack>

          <Stack divider={<Box borderTop={1} borderColor="divider" />}>
            <StartupInfoGroup title="周期与门店">
              <StartupInfoRow label="周期名称" value={term?.name ?? '未设置'} />
              <StartupInfoRow label="周期代码" value={term?.code ?? '未设置'} />
              <StartupInfoRow label="周期时间" value={formatDateRange(term?.startDate, term?.endDate)} />
              <StartupInfoRow label="运营门店" value={store?.name ?? '未设置'} detail={store?.code} />
            </StartupInfoGroup>
            <StartupInfoGroup title="教学安排">
              <StartupInfoRow label="首个教学周" value={firstTeachingWeek?.name ?? '未设置'} detail={formatDateRange(firstTeachingWeek?.startDate, firstTeachingWeek?.endDate)} />
              <StartupInfoRow label="教学阶段" value={firstTeachingWeek?.phaseCode ?? '未设置'} />
            </StartupInfoGroup>
            <StartupInfoGroup title="运营模板与团队">
              <StartupInfoRow label="运营模板" value={template?.name ?? '未设置'} detail={template ? `${template.templateCode} · v${template.version}` : undefined} />
              <StartupInfoRow label="团队" value={`${activeTeams.length} 个活动团队`} detail={activeTeams.map((team) => team.name).join('、') || '尚未建立团队'} />
              <StartupInfoRow label="成员" value={`${activeMembers.length} 人`} detail="已激活账号" />
            </StartupInfoGroup>
          </Stack>
        </Box>

        <Box
          bgcolor="var(--beverage-surface-container)"
          borderColor="divider"
          borderLeft={{ lg: 1 }}
          borderTop={{ xs: 1, lg: 0 }}
          p={{ xs: 2.5, sm: 4 }}
        >
          <Stack gap={2.5}>
            <Typography color="text.secondary" fontWeight={700} variant="subtitle2">Summary</Typography>
            <Typography component="h3" variant="h3">已发布实训</Typography>
            <Stack divider={<Box borderTop={1} borderColor="divider" />}>
              <StartupSummaryRow label="状态"><Chip color="success" label="已发布" size="small" /></StartupSummaryRow>
              <StartupSummaryRow label="周期" value={term?.code ?? '—'} />
              <StartupSummaryRow label="门店" value={store?.name ?? '—'} />
              <StartupSummaryRow label="首周" value={firstTeachingWeek?.name ?? '—'} />
              <StartupSummaryRow label="成员" value={`${activeMembers.length} 人`} />
            </Stack>
            <Typography color="text.secondary" variant="body2">
              可返回任一步骤查看配置；已发布内容将以当前周期信息为准。
            </Typography>
          </Stack>
        </Box>
      </Box>

      <Stack
        alignItems={{ xs: 'stretch', sm: 'center' }}
        borderTop={1}
        borderColor="divider"
        direction={{ xs: 'column-reverse', sm: 'row' }}
        gap={1.5}
        justifyContent="space-between"
        p={{ xs: 2, sm: 2.5 }}
      >
        <Button color="primary" onClick={onEdit} startIcon={<ArrowBackRoundedIcon />} variant="text">
          返回编辑
        </Button>
        <Button endIcon={<ArrowForwardRoundedIcon />} onClick={onContinue} variant="contained">
          继续
        </Button>
      </Stack>
    </Box>
  );
}

function StartupInfoGroup({ children, title }: { children: ReactNode; title: string }) {
  return (
    <Box py={{ xs: 2.5, sm: 3 }}>
      <Typography component="h3" mb={1.5} variant="h3">{title}</Typography>
      <Stack gap={1.25}>{children}</Stack>
    </Box>
  );
}

function StartupInfoRow({ detail, label, value }: { detail?: string; label: string; value: string }) {
  return (
    <Box alignItems={{ xs: 'flex-start', sm: 'center' }} display="flex" gap={2} justifyContent="space-between">
      <Typography color="text.secondary" variant="body2">{label}</Typography>
      <Stack alignItems="flex-end" gap={0.25} minWidth={0} textAlign="right">
        <Typography fontWeight={700} variant="body1">{value}</Typography>
        {detail ? <Typography color="text.secondary" noWrap maxWidth="100%" variant="caption">{detail}</Typography> : null}
      </Stack>
    </Box>
  );
}

function StartupSummaryRow({ children, label, value }: { children?: ReactNode; label: string; value?: string }) {
  return (
    <Box alignItems="center" display="flex" gap={1.5} justifyContent="space-between" py={1.5}>
      <Typography color="text.secondary" variant="body2">{label}</Typography>
      {children ?? <Typography fontWeight={700} textAlign="right" variant="body2">{value ?? '—'}</Typography>}
    </Box>
  );
}

function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate || !endDate) return '未设置';
  return `${startDate} — ${endDate}`;
}

function preferredTerm(terms: Term[]): Term | undefined {
  return terms.find((term) => term.status === 'DRAFT' || term.status === 'PUBLISHED') ?? terms[0];
}

function preferredStore(stores: Store[]): Store | undefined {
  return stores.find((store) => store.status === 'ACTIVE') ?? stores[0];
}

function currentState(progress: StartupProgress, loading: boolean): { description: string } {
  if (loading) return { description: '正在读取当前周期、模板和人员组织情况。' };
  if (!progress.period) return { description: '当前尚未建立实训周期。完成基础配置后，这里将呈现班次、待办与教学进度。' };
  if (!progress.template) return { description: '实训周期已建立。发布模板后即可明确岗位与日常 SOP。' };
  if (!progress.people) return { description: '运营模板草稿已保存。接下来建立团队并加入本期成员。' };
  if (!progress.published) return { description: '人员组织已就绪。请在最后一步确认并发布实训配置。' };
  return { description: '基础治理配置已就绪，可继续进入日常门店运营与课程工作。' };
}
