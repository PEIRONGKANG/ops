import { Box, Stack, Typography } from '@mui/material';
import { type PropsWithChildren, type ReactNode, useId } from 'react';

export interface AuthScaffoldProps extends PropsWithChildren {
  description: ReactNode;
  title: string;
}

export interface AuthScaffoldLayoutContract {
  readonly gridTemplateColumns: Readonly<{ xs: string; lg: string }>;
  readonly introductionDisplay: Readonly<{ xs: 'none'; lg: 'flex' }>;
}

export const authScaffoldLayout = {
  gridTemplateColumns: {
    xs: 'minmax(0, 1fr)',
    lg: 'minmax(0, 5fr) minmax(0, 4fr)',
  },
  introductionDisplay: { xs: 'none', lg: 'flex' },
} as const satisfies AuthScaffoldLayoutContract;

export function AuthScaffold({ children, description, title }: AuthScaffoldProps) {
  const titleId = useId();

  return (
    <Box
      display="grid"
      gridTemplateColumns={authScaffoldLayout.gridTemplateColumns}
      marginInline="auto"
      minHeight="100dvh"
      width="100%"
    >
      <Box
        aria-label="系统简介"
        component="section"
        sx={{
          alignItems: 'flex-end',
          bgcolor: 'var(--beverage-primary-container)',
          display: authScaffoldLayout.introductionDisplay,
          minHeight: '100%',
          p: { md: 5, lg: 7 },
        }}
      >
        <Stack gap={2} maxWidth={480}>
          <Typography component="p" variant="h1">
            饮品生产性实训运营系统
          </Typography>
          <Typography color="text.secondary" component="p" variant="h3">
            将岗位执行、带教反馈与学习成果连接在同一条实训链路中。
          </Typography>
        </Stack>
      </Box>

      <Box
        aria-labelledby={titleId}
        component="main"
        sx={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'center',
          minWidth: 0,
          p: { xs: 3, sm: 5, lg: 8 },
        }}
      >
        <Stack gap={4} maxWidth={480} width="100%">
          <Stack gap={1}>
            <Typography component="h1" id={titleId} variant="h1">
              {title}
            </Typography>
            <Typography color="text.secondary" variant="body1">
              {description}
            </Typography>
          </Stack>
          {children}
        </Stack>
      </Box>
    </Box>
  );
}
