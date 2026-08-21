import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { Alert, Box, Button, Chip, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';

import { PeopleWorkspacePage } from '@/features/governance/PeopleWorkspacePage';
import { TemplateWorkspacePage } from '@/features/governance/TemplateWorkspacePage';
import { TermWorkspacePage } from '@/features/governance/TermWorkspacePage';
import type { GovernanceApi, Store, Term } from '@/features/governance/governanceApi';
import type { AccountProfile } from '@/shared/api/authApi';
import { AppShell } from '@/shared/ui/components/AppShell';

interface DashboardPageProps {
  api: GovernanceApi;
  profile: AccountProfile;
}

type SetupStatus = 'complete' | 'current' | 'blocked';

type SetupStep = {
  description: string;
  title: string;
};

interface StartupProgress {
  people: boolean;
  period: boolean;
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
  { title: '建立实训周期', description: '录入学期、教学周和门店基础信息，确定本期运营范围。' },
  { title: '配置运营模板', description: '基于周期定义可发布的岗位与首项 SOP。' },
  { title: '组织实训人员', description: '建立团队，并将已启用账号加入当前实训周期。' },
];

export function DashboardPage({ api, profile }: DashboardPageProps) {
  const [progress, setProgress] = useState<StartupProgress>({ period: false, template: false, people: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const configurationRef = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [terms, stores] = await Promise.all([api.listTerms(), api.listStores()]);
      const term = preferredTerm(terms);
      const store = preferredStore(stores);
      const period = Boolean(term && store);
      if (!term || !store) {
        setProgress({ period, template: false, people: false });
        return;
      }

      const [templates, teams, memberships, accounts] = await Promise.all([
        api.listTemplateVersions({ termId: term.id, storeId: store.id }),
        api.listTeams(term.id),
        api.listMemberships(term.id),
        api.listAccounts('ACTIVE'),
      ]);
      const activeTeamIds = new Set(teams.filter((team) => team.status === 'ACTIVE').map((team) => team.id));
      const activeAccountIds = new Set(accounts.map((account) => account.id));
      setProgress({
        period,
        template: templates.some((template) => template.status === 'PUBLISHED'),
        people: memberships.some((membership) => membership.status === 'ACTIVE' && membership.teamId !== null && activeTeamIds.has(membership.teamId) && activeAccountIds.has(membership.accountId)),
      });
    } catch {
      setLoadError('无法同步启动状态，请检查网络后重试。');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { void load(); }, [load]);

  const statuses: SetupStatus[] = [
    progress.period ? 'complete' : 'current',
    progress.template ? 'complete' : progress.period ? 'current' : 'blocked',
    progress.people ? 'complete' : progress.template ? 'current' : 'blocked',
  ];
  const currentStepIndex = statuses.findIndex((status) => status === 'current');
  const current = currentState(progress, loading);
  const currentStep = currentStepIndex === -1 ? undefined : setupSteps[currentStepIndex];
  const notificationCount = statuses.filter((status) => status !== 'complete').length;

  const focusCurrentConfiguration = () => {
    configurationRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  };

  return (
    <AppShell
      headerContent={profile.roles.map((role) => <Chip color="primary" key={role} label={roleLabels[role]} size="small" variant="outlined" />)}
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
      <Box maxWidth={1120}>
        <Stack gap={{ xs: 4, md: 5 }}>
          <section aria-labelledby="setup-checklist-title">
            <Stack gap={0.75} mb={3}>
              <Typography component="h1" id="setup-checklist-title" variant="h3">启动清单</Typography>
              <Typography color="text.secondary">按顺序完成三项配置，即可开始安排并运行实训班次。</Typography>
            </Stack>
            <StartupProgressRail statuses={statuses} />
          </section>

          {loading ? <Typography color="text.secondary" variant="body2">正在同步服务器状态…</Typography> : null}
          {loadError ? <Alert action={<Button color="inherit" onClick={() => { void load(); }} size="small">重试</Button>} severity="warning">{loadError}</Alert> : null}

          <Box component="section" ref={configurationRef} aria-label="当前配置" borderColor="divider" borderTop={1} pt={{ xs: 3, md: 4 }}>
            <Typography color="primary" fontWeight={800} variant="overline">当前配置</Typography>
            <Box mt={2.5}>
              {currentStepIndex === 0 ? <TermWorkspacePage api={api} embedded onInitialized={() => { void load(); }} /> : null}
              {currentStepIndex === 1 ? <TemplateWorkspacePage api={api} embedded onPublished={() => { void load(); }} /> : null}
              {currentStepIndex === 2 ? <PeopleWorkspacePage api={api} embedded onMembershipChanged={() => { void load(); }} /> : null}
              {currentStepIndex === -1 ? <StartupComplete /> : null}
            </Box>
          </Box>
        </Stack>
      </Box>
    </AppShell>
  );
}

function StartupProgressRail({ statuses }: { statuses: SetupStatus[] }) {
  return (
    <Box aria-label="启动配置流程" component="ol" display="grid" gap={{ xs: 1, sm: 2 }} gridTemplateColumns="repeat(3, minmax(0, 1fr))" m={0} p={0} sx={{ listStyle: 'none' }}>
      {setupSteps.map((step, index) => <StartupProgressItem index={index} key={step.title} status={statuses[index]} step={step} />)}
    </Box>
  );
}

function StartupProgressItem({ index, status, step }: { index: number; status: SetupStatus; step: SetupStep }) {
  const complete = status === 'complete';
  const current = status === 'current';
  const color = complete ? 'success.main' : current ? 'primary.main' : 'divider';
  const textColor = complete || current ? 'text.primary' : 'text.secondary';
  const stateLabel = complete ? '已完成' : current ? '当前步骤' : '等待上一步';

  return (
    <Box aria-current={current ? 'step' : undefined} component="li" minWidth={0} position="relative" pt={0.5} sx={{ '&:not(:last-of-type)::after': { backgroundColor: color, content: '""', height: 2, left: 'calc(50% + 24px)', position: 'absolute', right: 'calc(-50% + 24px)', top: 16 } }}>
      <Stack gap={1.25} position="relative" zIndex={1}>
        <Box alignItems="center" bgcolor="background.default" display="flex" height={32} width="fit-content">
          <Box alignItems="center" border={2} borderColor={color} borderRadius="50%" color={complete || current ? color : 'text.secondary'} display="flex" fontWeight={800} height={32} justifyContent="center" width={32}>
            {complete ? <CheckRoundedIcon fontSize="small" /> : index + 1}
          </Box>
        </Box>
        <Stack gap={0.5}>
          <Typography color={textColor} fontWeight={current ? 800 : 700} variant="subtitle1">{step.title}</Typography>
          <Typography color="text.secondary" variant="body2">{step.description}</Typography>
          <Typography color={complete ? 'success.main' : current ? 'primary.main' : 'text.secondary'} fontWeight={700} variant="caption">{stateLabel}</Typography>
        </Stack>
      </Stack>
    </Box>
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
  if (!progress.people) return { description: '运营模板已发布。接下来建立团队并加入本期成员。' };
  return { description: '基础治理配置已就绪，可继续进入日常门店运营与课程工作。' };
}
