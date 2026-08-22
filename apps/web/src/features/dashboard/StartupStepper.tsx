import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import { Box, Button, Typography } from '@mui/material';
import { useId } from 'react';

import { visuallyHidden } from '@/shared/ui/forms/fieldErrorAccessibility';

export type StartupStepStatus = 'complete' | 'current' | 'blocked';

export interface StartupStep {
  title: string;
  status: StartupStepStatus;
}

export type StartupSteps = readonly [StartupStep, StartupStep, StartupStep];
export type StartupStepStatuses = readonly [StartupStepStatus, StartupStepStatus, StartupStepStatus];

export interface StartupStepperProps {
  onSelect: (index: number) => void;
  selected: number;
  steps: StartupSteps;
}

export function StartupStepper({ onSelect, selected, steps }: StartupStepperProps) {
  const instanceId = useId();
  const completedSteps = Math.min(steps.length - 1, steps.filter((step) => step.status === 'complete').length);
  const progress = steps.length > 1 ? completedSteps / (steps.length - 1) * 100 : 0;

  return (
    <Box
      bgcolor="var(--beverage-surface-container)"
      borderRadius="var(--beverage-shape-large)"
      p={{ xs: 1, sm: 1.5 }}
    >
      <Box
        aria-label="启动配置流程"
        component="ol"
        display="grid"
        gap={{ xs: 0.5, sm: 1 }}
        gridTemplateColumns={`repeat(${steps.length}, minmax(0, 1fr))`}
        m={0}
        p={0}
        position="relative"
        sx={{
          listStyle: 'none',
          '&::after': {
            bgcolor: 'primary.main',
            content: '""',
            height: 2,
            left: '16.667%',
            position: 'absolute',
            top: 26,
            transition: 'width 180ms ease',
            width: `calc(66.666% * ${progress / 100})`,
          },
          '&::before': {
            bgcolor: 'divider',
            content: '""',
            height: 2,
            left: '16.667%',
            position: 'absolute',
            right: '16.667%',
            top: 26,
          },
        }}
      >
        {steps.map((step, index) => {
          const complete = step.status === 'complete';
          const current = step.status === 'current';
          const blocked = step.status === 'blocked';
          const selectedStep = selected === index;
          const statusId = `${instanceId}-startup-step-${index}-status`;
          const statusText = complete ? '已完成' : current ? '待配置' : '等待上一步';
          return (
            <Box
              aria-current={selectedStep ? 'step' : undefined}
              component="li"
              display="flex"
              flexDirection="column"
              key={step.title}
              minWidth={0}
              sx={{ alignItems: 'center' }}
            >
              <Button
                aria-describedby={statusId}
                aria-label={step.title}
                aria-pressed={selectedStep}
                disabled={blocked}
                onClick={() => onSelect(index)}
                sx={{
                  alignItems: 'center',
                  bgcolor: selectedStep ? 'var(--beverage-primary-container)' : 'transparent',
                  borderRadius: 'var(--beverage-shape-medium)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0.75,
                  justifyContent: 'center',
                  minHeight: 0,
                  minWidth: 0,
                  p: { xs: 0.75, sm: 1 },
                  '&.Mui-disabled': { color: 'text.secondary' },
                  '&:hover': { bgcolor: selectedStep ? 'var(--beverage-primary-container)' : 'var(--beverage-surface-container-high)' },
                }}
                variant="text"
              >
                <Box
                  alignItems="center"
                  bgcolor={complete || current ? 'primary.main' : 'background.paper'}
                  border={complete || current ? 0 : 2}
                  borderColor="divider"
                  borderRadius="50%"
                  color={complete || current ? 'primary.contrastText' : 'text.secondary'}
                  display="flex"
                  fontWeight={800}
                  height={32}
                  justifyContent="center"
                  width={32}
                >
                  {complete ? <Box aria-label={`${step.title}，已完成`} component="span" display="flex" role="img"><CheckRoundedIcon aria-hidden fontSize="small" /></Box> : index + 1}
                </Box>
                <Typography color={blocked ? 'text.secondary' : 'text.primary'} fontWeight={selectedStep ? 800 : 700} noWrap sx={{ fontSize: { xs: '0.75rem', sm: '0.875rem' }, lineHeight: 1.35 }} variant="subtitle1">
                  {step.title}
                </Typography>
              </Button>
              <Typography
                color="text.secondary"
                fontWeight={700}
                id={statusId}
                mt={blocked ? 0.5 : undefined}
                sx={blocked ? undefined : visuallyHidden}
                variant="caption"
              >
                {statusText}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
