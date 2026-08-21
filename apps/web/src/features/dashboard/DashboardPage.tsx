import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { Alert, Box, Button, Chip, Divider, List, ListItem, Stack, Typography } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';

import type { GovernanceApi, Store, Term } from '@/features/governance/governanceApi';
import type { AccountProfile } from '@/shared/api/authApi';
import { AppShell } from '@/shared/ui/components/AppShell';

interface DashboardPageProps {
  api: GovernanceApi;
  onOpenPeopleWorkspace: () => void;
  onOpenTemplateWorkspace: () => void;
  onOpenTermWorkspace: () => void;
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
  { title: '配置运营模板', description: '基于周期设置班次、岗位、SOP、评分与认证规则。' },
  { title: '组织实训人员', description: '审批账号申请，为教师、负责人和学员分配角色。' },
];

export function DashboardPage({ api, onOpenPeopleWorkspace, onOpenTemplateWorkspace, onOpenTermWorkspace, profile }: DashboardPageProps) {
  const [progress, setProgress] = useState<StartupProgress>({ period: false, template: false, people: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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

      const [templates, teams, memberships] = await Promise.all([
        api.listTemplateVersions({ termId: term.id, storeId: store.id }),
        api.listTeams(term.id),
        api.listMemberships(term.id),
      ]);
      setProgress({
        period,
        template: templates.some((template) => template.status === 'PUBLISHED'),
        people: teams.some((team) => team.status === 'ACTIVE') && memberships.some((membership) => membership.status === 'ACTIVE' && membership.teamId !== null),
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
  const actions = [onOpenTermWorkspace, onOpenTemplateWorkspace, onOpenPeopleWorkspace];
  const current = currentState(progress, loading);
  const currentStepIndex = statuses.findIndex((status) => status === 'current');
  const notificationCount = statuses.filter((status) => status !== 'complete').length;
  const currentStep = currentStepIndex === -1 ? undefined : setupSteps[currentStepIndex];

  return (
    <AppShell headerContent={profile.roles.map((role) => <Chip color="primary" key={role} label={roleLabels[role]} size="small" variant="outlined" />)} notificationContent={
      <Stack gap={1.25}>
        <Typography color="primary" fontWeight={800} variant="overline">运营工作台</Typography>
        <Typography component="h2" variant="h3">{profile.displayName}，欢迎回来</Typography>
        <Typography color="text.secondary" variant="body2">{current.description}</Typography>
        {currentStep ? <Box pt={0.5}><Button onClick={actions[currentStepIndex]} variant="contained">{currentStep.title}</Button></Box> : <Typography color="success.main" fontWeight={700} variant="body2">启动清单已完成</Typography>}
      </Stack>
    } notificationCount={notificationCount}>
      <Box maxWidth={1120}>
        <Box display="grid" gap={{ xs: 4, lg: 8 }} gridTemplateColumns={{ xs: '1fr', lg: 'minmax(0, 1fr) 280px' }}>
          <section aria-labelledby="setup-checklist-title">
            <Stack gap={0.75} mb={2.5}>
              <Typography component="h2" id="setup-checklist-title" variant="h3">启动清单</Typography>
              <Typography color="text.secondary">按顺序完成以下配置，即可开始安排并运行实训班次。</Typography>
            </Stack>

            <List aria-label="实训基地启动清单" disablePadding>
              {setupSteps.map((step, index) => <SetupChecklistItem action={actions[index]} index={index} key={step.title} status={statuses[index]} step={step} />)}
            </List>
          </section>

          <aside aria-labelledby="current-state-title">
            <Box borderColor="divider" borderLeft={{ lg: 1 }} pl={{ lg: 4 }}>
              <Stack gap={2}>
                <Typography color="text.secondary" component="h2" id="current-state-title" variant="overline">当前状态</Typography>
                <Stack gap={0.75}>
                  <Typography variant="h3">{current.title}</Typography>
                  <Typography color="text.secondary" variant="body2">{current.detail}</Typography>
                </Stack>
                <Divider />
                {loading ? <Typography color="text.secondary" variant="body2">正在同步服务器状态…</Typography> : null}
                {loadError ? <Alert action={<Button color="inherit" onClick={() => { void load(); }} size="small">重试</Button>} severity="warning">{loadError}</Alert> : null}
                <Stack direction="row" gap={1.25}>
                  <CheckCircleOutlineRoundedIcon aria-hidden color="primary" />
                  <Typography color="text.secondary" variant="body2">你已完成账号激活，可以开始配置。</Typography>
                </Stack>
              </Stack>
            </Box>
          </aside>
        </Box>
      </Box>
    </AppShell>
  );
}

function SetupChecklistItem({ action, index, status, step }: { action: () => void; index: number; status: SetupStatus; step: SetupStep }) {
  const complete = status === 'complete';
  const available = status !== 'blocked';
  const stateLabel = complete ? '已完成' : status === 'current' ? '当前步骤' : '完成上一步后可用';

  return (
    <ListItem alignItems="flex-start" disableGutters divider={index < setupSteps.length - 1} sx={{ gap: { xs: 1.5, sm: 2 }, py: 2.5 }}>
      <Box alignItems="center" border={1} borderColor={complete || status === 'current' ? 'primary.main' : 'divider'} borderRadius="50%" color={complete || status === 'current' ? 'primary.main' : 'text.secondary'} display="flex" flexShrink={0} fontWeight={800} height={32} justifyContent="center" mt={0.25} width={32}>{complete ? <CheckCircleOutlineRoundedIcon fontSize="small" /> : index + 1}</Box>
      <Stack flex={1} gap={0.5} minWidth={0}>
        {available ? <Button aria-label={step.title} onClick={action} sx={{ alignSelf: 'flex-start', justifyContent: 'flex-start', minHeight: 0, p: 0, textAlign: 'left' }} variant="text"><Typography component="h3" variant="subtitle1">{step.title}</Typography></Button> : <Typography component="h3" variant="subtitle1">{step.title}</Typography>}
        <Typography color="text.secondary" variant="body2">{step.description}</Typography>
      </Stack>
      {complete || status === 'current' ? <Chip color={complete ? 'success' : 'primary'} label={stateLabel} size="small" sx={{ flexShrink: 0, mt: 0.5 }} variant="outlined" /> : <Typography color="text.secondary" flexShrink={0} mt={0.5} variant="body2">{stateLabel}</Typography>}
    </ListItem>
  );
}

function preferredTerm(terms: Term[]): Term | undefined {
  return terms.find((term) => term.status === 'DRAFT' || term.status === 'PUBLISHED') ?? terms[0];
}

function preferredStore(stores: Store[]): Store | undefined {
  return stores.find((store) => store.status === 'ACTIVE') ?? stores[0];
}

function currentState(progress: StartupProgress, loading: boolean): { description: string; detail: string; title: string } {
  if (loading) return { title: '正在同步启动状态', description: '正在读取当前周期、模板和人员组织情况。', detail: '状态来自治理服务，读取完成后会自动更新。' };
  if (!progress.period) return { title: '正在准备首次运营', description: '当前尚未建立实训周期。完成基础配置后，这里将呈现班次、待办与教学进度。', detail: '先建立周期、门店与第一个教学周，形成本期运营范围。' };
  if (!progress.template) return { title: '等待运营模板发布', description: '实训周期已建立。发布模板后即可明确岗位与日常 SOP。', detail: '当前可配置并发布第一版运营模板。' };
  if (!progress.people) return { title: '等待组织实训人员', description: '运营模板已发布。接下来审批账号、建立团队并加入本期成员。', detail: '至少建立一个团队，并为本期加入一名成员。' };
  return { title: '启动清单已完成', description: '基础治理配置已就绪，可继续进入日常门店运营与课程工作。', detail: '周期、模板和人员组织均已由服务端确认。' };
}
