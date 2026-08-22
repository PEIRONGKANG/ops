import { Box, Stack, Typography } from '@mui/material';
import { type PropsWithChildren, type ReactNode } from 'react';

export interface PageScaffoldProps extends PropsWithChildren {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: string;
}

export interface PageScaffoldLayoutContract {
  readonly headerAlignment: Readonly<{ xs: 'stretch'; sm: 'flex-end' }>;
  readonly headerDirection: Readonly<{ xs: 'column'; sm: 'row' }>;
  readonly maxWidth: string;
}

export const pageScaffoldLayout = {
  headerAlignment: { xs: 'stretch', sm: 'flex-end' },
  headerDirection: { xs: 'column', sm: 'row' },
  maxWidth: 'var(--beverage-layout-content-max)',
} as const satisfies PageScaffoldLayoutContract;

export function PageScaffold({ actions, children, description, eyebrow, title }: PageScaffoldProps) {
  return (
    <Box marginInline="auto" maxWidth={pageScaffoldLayout.maxWidth} width="100%">
      <Stack
        alignItems={pageScaffoldLayout.headerAlignment}
        component="header"
        direction={pageScaffoldLayout.headerDirection}
        gap={{ xs: 2, sm: 3 }}
        justifyContent="space-between"
      >
        <Stack gap={0.75} minWidth={0}>
          {eyebrow ? (
            <Typography color="primary" fontWeight={700} variant="overline">
              {eyebrow}
            </Typography>
          ) : null}
          <Typography component="h1" variant="h1">
            {title}
          </Typography>
          {description ? (
            <Typography color="text.secondary" maxWidth={720} variant="body1">
              {description}
            </Typography>
          ) : null}
        </Stack>
        {actions ? (
          <Stack alignItems="center" direction="row" flexShrink={0} gap={1}>
            {actions}
          </Stack>
        ) : null}
      </Stack>

      <Box aria-label={`${title}内容`} component="section" sx={{ mt: { xs: 3, md: 4 } }}>
        {children}
      </Box>
    </Box>
  );
}
