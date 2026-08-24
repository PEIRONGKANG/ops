import { Paper, Stack, Typography } from '@mui/material';
import { type PropsWithChildren, type ReactNode, useId } from 'react';

export interface SupportingActionPaneProps extends PropsWithChildren {
  action?: ReactNode;
  title: string;
}

export interface SupportingActionPaneLayoutContract {
  readonly backgroundColor: string;
  readonly gridColumn: Readonly<{ xs: '1 / -1'; lg: 'auto' }>;
  readonly justifySelf: Readonly<{ xs: 'stretch'; lg: 'end' }>;
  readonly width: Readonly<{ xs: '100%'; lg: 292 }>;
}

export const supportingActionPaneLayout = {
  backgroundColor: 'var(--beverage-surface-container)',
  gridColumn: { xs: '1 / -1', lg: 'auto' },
  justifySelf: { xs: 'stretch', lg: 'end' },
  width: { xs: '100%', lg: 292 },
} as const satisfies SupportingActionPaneLayoutContract;

export function SupportingActionPane({ action, children, title }: SupportingActionPaneProps) {
  const titleId = useId();

  return (
    <Paper
      aria-labelledby={titleId}
      component="aside"
      elevation={0}
      sx={{
        alignSelf: 'start',
        bgcolor: supportingActionPaneLayout.backgroundColor,
        border: 1,
        borderColor: 'divider',
        gridColumn: supportingActionPaneLayout.gridColumn,
        justifySelf: supportingActionPaneLayout.justifySelf,
        p: { xs: 2.5, sm: 3 },
        position: { xs: 'static', lg: 'sticky' },
        top: { lg: 'calc(var(--beverage-top-bar-height) + 24px)' },
        width: supportingActionPaneLayout.width,
      }}
    >
      <Stack gap={2.25}>
        <Typography component="h2" fontWeight={750} id={titleId} variant="h3">
          {title}
        </Typography>
        <Stack gap={1.5}>{children}</Stack>
        {action ? <Stack alignItems="flex-start" pt={0.25}>{action}</Stack> : null}
      </Stack>
    </Paper>
  );
}
