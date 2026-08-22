import { Paper, Stack, Typography } from '@mui/material';
import { type PropsWithChildren, type ReactNode, useId } from 'react';

export interface SupportingActionPaneProps extends PropsWithChildren {
  action?: ReactNode;
  title: string;
}

export const supportingActionPaneLayout = {
  backgroundColor: 'var(--beverage-surface-container)',
  gridColumn: { xs: '1 / -1', lg: 'auto' },
  justifySelf: { xs: 'stretch', lg: 'end' },
  width: { xs: '100%', lg: 320 },
} as const;

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
        gridColumn: supportingActionPaneLayout.gridColumn,
        justifySelf: supportingActionPaneLayout.justifySelf,
        p: { xs: 2.5, sm: 3 },
        position: { xs: 'static', lg: 'sticky' },
        top: { lg: 'calc(var(--beverage-top-bar-height) + 24px)' },
        width: supportingActionPaneLayout.width,
      }}
    >
      <Stack gap={2.5}>
        <Typography component="h2" id={titleId} variant="h3">
          {title}
        </Typography>
        <Stack gap={1.5}>{children}</Stack>
        {action ? <Stack alignItems="flex-start">{action}</Stack> : null}
      </Stack>
    </Paper>
  );
}
