import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import { Box, Chip, Divider, List, ListItem, Stack, Typography } from '@mui/material';

import type { AccountProfile } from '@/shared/api/authApi';
import { AppShell } from '@/shared/ui/components/AppShell';

interface DashboardPageProps {
  profile: AccountProfile;
}

type SetupStep = {
  description: string;
  title: string;
};

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

export function DashboardPage({ profile }: DashboardPageProps) {
  return (
    <AppShell headerContent={profile.roles.map((role) => <Chip color="primary" key={role} label={roleLabels[role]} size="small" variant="outlined" />)}>
      <Box maxWidth={1120}>
        <Box borderBottom={1} borderColor="divider" pb={{ xs: 3, md: 4 }}>
          <Stack alignItems={{ md: 'flex-end' }} direction={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between">
            <Stack gap={0.75}>
              <Typography color="primary" fontWeight={800} variant="overline">运营工作台</Typography>
              <Typography component="h1" variant="h2">{profile.displayName}，欢迎回来</Typography>
              <Typography color="text.secondary">当前尚未建立实训周期。完成基础配置后，这里将呈现班次、待办与教学进度。</Typography>
            </Stack>
          </Stack>
        </Box>

        <Box display="grid" gap={{ xs: 4, lg: 8 }} gridTemplateColumns={{ xs: '1fr', lg: 'minmax(0, 1fr) 280px' }} pt={{ xs: 4, md: 5 }}>
          <section aria-labelledby="setup-checklist-title">
            <Stack gap={0.75} mb={2.5}>
              <Typography component="h2" id="setup-checklist-title" variant="h3">启动清单</Typography>
              <Typography color="text.secondary">按顺序完成以下配置，即可开始安排并运行实训班次。</Typography>
            </Stack>

            <List disablePadding aria-label="实训基地启动清单">
              {setupSteps.map((step, index) => (
                <SetupChecklistItem index={index} key={step.title} step={step} />
              ))}
            </List>
          </section>

          <aside aria-labelledby="current-state-title">
            <Box borderLeft={{ lg: 1 }} borderColor="divider" pl={{ lg: 4 }}>
              <Stack gap={2}>
                <Typography color="text.secondary" component="h2" id="current-state-title" variant="overline">当前状态</Typography>
                <Stack gap={0.75}>
                  <Typography variant="h3">正在准备首次运营</Typography>
                  <Typography color="text.secondary" variant="body2">系统将在创建第一个实训周期后，生成对应的运营上下文和治理入口。</Typography>
                </Stack>
                <Divider />
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

interface SetupChecklistItemProps {
  index: number;
  step: SetupStep;
}

function SetupChecklistItem({ index, step }: SetupChecklistItemProps) {
  const isNext = index === 0;

  return (
    <ListItem alignItems="flex-start" disableGutters divider={index < setupSteps.length - 1} sx={{ gap: { xs: 1.5, sm: 2 }, py: 2.5 }}>
      <Box alignItems="center" border={1} borderColor={isNext ? 'primary.main' : 'divider'} borderRadius="50%" color={isNext ? 'primary.main' : 'text.secondary'} display="flex" flexShrink={0} fontWeight={800} height={32} justifyContent="center" mt={0.25} width={32}>
        {index + 1}
      </Box>
      <Stack flex={1} gap={0.5} minWidth={0}>
        <Typography component="h3" variant="subtitle1">{step.title}</Typography>
        <Typography color="text.secondary" variant="body2">{step.description}</Typography>
      </Stack>
      {isNext ? (
        <Chip color="primary" label="当前步骤" size="small" sx={{ flexShrink: 0, mt: 0.5 }} variant="outlined" />
      ) : (
        <Typography color="text.secondary" flexShrink={0} mt={0.5} variant="body2">完成上一步后可用</Typography>
      )}
    </ListItem>
  );
}
