import { Box, Stack, Typography } from '@mui/material';
import { type PropsWithChildren, type ReactNode, useId } from 'react';

export interface AuthScaffoldProps extends PropsWithChildren {
  description: ReactNode;
  title: string;
}

export function AuthScaffold({ children, description, title }: AuthScaffoldProps) {
  const titleId = useId();

  return (
    <Box
      display="grid"
      gridTemplateColumns={{ xs: 'minmax(0, 1fr)', md: 'minmax(320px, 0.8fr) minmax(0, 1.2fr)' }}
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
          display: { xs: 'none', md: 'flex' },
          minHeight: '100%',
          p: { md: 5, lg: 7 },
        }}
      >
        <Stack gap={2} maxWidth={480}>
          <Typography component="h2" variant="h1">
            饮品生产性实训运营系统
          </Typography>
          <Typography color="text.secondary" variant="h3">
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
