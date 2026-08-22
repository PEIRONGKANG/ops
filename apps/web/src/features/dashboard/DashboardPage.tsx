import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { PeopleWorkspacePage } from '@/features/governance/PeopleWorkspacePage';
import { TemplateWorkspacePage } from '@/features/governance/TemplateWorkspacePage';
import { TermWorkspacePage } from '@/features/governance/TermWorkspacePage';
import type { GovernanceApi, Store, Term } from '@/features/governance/governanceApi';
import type { AccountProfile } from '@/shared/api/authApi';
import { AppShell } from '@/shared/ui/components/AppShell';
import { useToast } from '@/shared/ui/feedback/ToastProvider';

interface DashboardPageProps {
  api: GovernanceApi;
  profile: AccountProfile;
}

type SetupStatus = 'complete' | 'current' | 'blocked';

type SetupStep = {
  title: string;
};

interface StartupProgress {
  people: boolean;
  period: boolean;
  published: boolean;
  template: boolean;
}

const roleLabels: Record<AccountProfile['roles'][number], string> = {
  P1: '运营治理',
  P2: '现场负责人',
  P3: '岗位学员',
  T1: '带教教师',
  EXTERNAL_REVIEWER: '外部评审',
};

const setupSteps: SetupStep[] = [
  { title: '建立实训周期' },
  { title: '配置运营模板' },
  { title: '组织实训人员' },
];

export function DashboardPage({ api, profile }: DashboardPageProps) {
  const [progress, setProgress] = useState<StartupProgress>({ period: false, template: false, people: false, published: false });
  const [loading, setLoading] = useState(true);
  const [selectedStepIndex, setSelectedStepIndex] = useState<number | null>(null);
  const [publication, setPublication] = useState<{ term: Term; templateId: string; templateVersion: number } | null>(null);
  const { showToast } = useToast();
  const configurationRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [terms, stores] = await Promise.all([api.listTerms(), api.listStores()]);
      const term = preferredTerm(terms);
      const store = preferredStore(stores);
      const period = Boolean(term && store);
      if (!term || !store) {
        setProgress({ period, template: false, people: false, published: false });
        setPublication(null);
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
      setProgress({
        period: period && weeks.some((week) => week.weekNumber === 1),
        template: templateConfigured,
        people: memberships.some((membership) => membership.status === 'ACTIVE' && membership.teamId !== null && activeTeamIds.has(membership.teamId) && activeAccountIds.has(membership.accountId)),
        published,
      });
      setPublication(template ? { term, templateId: template.id, templateVersion: template.version } : null);
    } catch {
      showToast({ action: { label: '重试', onClick: () => { void load(); } }, message: '无法同步启动状态，请检查网络后重试。', severity: 'warning' });
    } finally {
      setLoading(false);
    }
  }, [api, showToast]);

  useEffect(() => { void load(); }, [load]);

  const statuses = useMemo<SetupStatus[]>(() => [
    progress.published || progress.period ? 'complete' : 'current',
    progress.published || progress.template ? 'complete' : progress.period ? 'current' : 'blocked',
    progress.published ? 'complete' : progress.template ? 'current' : 'blocked',
  ], [progress.period, progress.published, progress.template]);
  const currentStepIndex = statuses.findIndex((status) => status === 'current');
  const visibleStepIndex = currentStepIndex === -1 ? -1 : selectedStepIndex !== null && statuses[selectedStepIndex] !== 'blocked'
    ? selectedStepIndex
    : currentStepIndex;
  const current = currentState(progress, loading);
  const currentStep = currentStepIndex === -1 ? undefined : setupSteps[currentStepIndex];
  const notificationCount = statuses.filter((status) => status !== 'complete').length;

  useEffect(() => {
    if (!loading && currentStepIndex >= 0 && (selectedStepIndex === null || statuses[selectedStepIndex] === 'blocked')) {
      setSelectedStepIndex(currentStepIndex);
    }
  }, [currentStepIndex, loading, selectedStepIndex, statuses]);

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
      mainSx={{ alignItems: 'center', display: 'flex', justifyContent: 'center' }}
      notificationContent={
        <Stack gap={1.25}>
          <Typography color="primary" fontWeight={800} variant="overline">运营工作台</Typography>
          <Typography component="h2" variant="h3">{profile.displayName}，欢迎回来</Typography>
          <Typography color="text.secondary" variant="body2">{current.description}</Typography>
          {currentStep ? <Box pt={0.5}><Button onClick={focusCurrentConfiguration} variant="contained">{currentStep.title}</Button></Box> : <Typography color="success.main" fontWeight={700} variant="body2">启动清单已完成</Typography>}
        </Stack>
      }
      notificationCount={notificationCount}
    >
      <Box maxWidth={1120} width="100%">
        <Stack gap={{ xs: 2.5, md: 3 }}>
          <section aria-label="启动配置进度"><StartupProgressRail onSelect={setSelectedStepIndex} selectedIndex={visibleStepIndex} statuses={statuses} /></section>

          {loading ? <Typography color="text.secondary" variant="body2">正在同步服务器状态…</Typography> : null}

          <Box component="section" ref={configurationRef} aria-label="当前步骤配置" borderColor="divider" borderTop={1} pt={{ xs: 2.5, md: 3 }}>
            {visibleStepIndex !== -1 ? <StartupActionBar
              canPublish={visibleStepIndex === 2 && progress.people && Boolean(publication) && !progress.published}
              formId={visibleStepIndex === 0 ? 'startup-period-form' : visibleStepIndex === 1 ? 'startup-template-form' : undefined}
              mainLabel={visibleStepIndex === 0 ? (progress.period ? '保存修改' : '创建实训周期') : visibleStepIndex === 1 ? (progress.template ? '保存修改' : '保存模板草稿') : undefined}
              onBack={visibleStepIndex > 0 ? () => setSelectedStepIndex(visibleStepIndex - 1) : undefined}
              onPublish={() => { void publish(); }}
            /> : null}
            {visibleStepIndex === 0 ? <TermWorkspacePage api={api} embedded formId="startup-period-form" onInitialized={() => { setSelectedStepIndex(1); void load(); }} /> : null}
            {visibleStepIndex === 1 ? <TemplateWorkspacePage api={api} embedded formId="startup-template-form" onSaved={() => { setSelectedStepIndex(2); void load(); }} /> : null}
            {visibleStepIndex === 2 ? <PeopleWorkspacePage api={api} embedded onMembershipChanged={() => { void load(); }} /> : null}
            {currentStepIndex === -1 ? <StartupComplete /> : null}
          </Box>
        </Stack>
      </Box>
    </AppShell>
  );
}

function StartupProgressRail({ onSelect, selectedIndex, statuses }: { onSelect: (index: number) => void; selectedIndex: number; statuses: SetupStatus[] }) {
  return (
    <Box aria-label="启动配置流程" component="ol" display="grid" gap={{ xs: 1, sm: 2 }} gridTemplateColumns="repeat(3, minmax(0, 1fr))" m={0} p={0} sx={{ listStyle: 'none' }}>
      {setupSteps.map((step, index) => <StartupProgressItem index={index} key={step.title} onSelect={() => onSelect(index)} selected={selectedIndex === index} status={statuses[index]} step={step} />)}
    </Box>
  );
}

function StartupProgressItem({ index, onSelect, selected, status, step }: { index: number; onSelect: () => void; selected: boolean; status: SetupStatus; step: SetupStep }) {
  const complete = status === 'complete';
  const current = status === 'current';
  const selectable = status !== 'blocked';
  const color = complete ? 'success.main' : current ? 'primary.main' : 'divider';
  const textColor = complete || current ? 'text.primary' : 'text.secondary';
  const stateLabel = complete ? '已完成' : current ? '当前步骤' : '等待上一步';

  return (
    <Box aria-current={selected ? 'step' : undefined} component="li" minWidth={0} position="relative" pt={0.5} sx={{ '&:not(:last-of-type)::after': { backgroundColor: color, content: '""', height: 2, left: 'calc(50% + 24px)', position: 'absolute', right: 'calc(-50% + 24px)', top: 16 } }}>
      <Stack gap={0.75} position="relative" zIndex={1}>
        <Box alignItems="center" bgcolor="background.default" display="flex" height={32} width="fit-content">
          <Box alignItems="center" border={2} borderColor={color} borderRadius="50%" color={complete || current ? color : 'text.secondary'} display="flex" fontWeight={800} height={32} justifyContent="center" width={32}>
            {complete ? <CheckRoundedIcon fontSize="small" /> : index + 1}
          </Box>
        </Box>
        <Stack gap={0.25}>
          <Button disabled={!selectable} onClick={onSelect} sx={{ alignSelf: 'flex-start', justifyContent: 'flex-start', minWidth: 0, p: 0, textAlign: 'left' }} variant="text">
            <Typography color={textColor} fontWeight={selected ? 800 : 700} variant="subtitle1">{step.title}</Typography>
          </Button>
          <Typography color={complete ? 'success.main' : current ? 'primary.main' : 'text.secondary'} fontWeight={700} variant="caption">{stateLabel}</Typography>
        </Stack>
      </Stack>
    </Box>
  );
}

function StartupActionBar({ canPublish, formId, mainLabel, onBack, onPublish }: {
  canPublish: boolean;
  formId?: string;
  mainLabel?: string;
  onBack?: () => void;
  onPublish: () => void;
}) {
  return (
    <Stack alignItems="center" direction="row" justifyContent="space-between" mb={{ xs: 2, md: 2.5 }} minHeight={40}>
      {onBack ? <Button onClick={onBack} variant="text">返回上一步</Button> : <Box />}
      {mainLabel && formId ? <Button form={formId} type="submit" variant="contained">{mainLabel}</Button> : null}
      {canPublish ? <Button onClick={onPublish} variant="contained">发布实训配置</Button> : null}
    </Stack>
  );
}

function StartupComplete() {
  return (
    <Stack gap={1.25} maxWidth={680}>
      <Typography component="h2" variant="h2">启动清单已完成</Typography>
      <Typography color="text.secondary">周期、模板和人员组织已经由服务端确认。现在可以进入日常门店运营与课程工作。</Typography>
    </Stack>
  );
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
