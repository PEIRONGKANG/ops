import { Box, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import { type PropsWithChildren } from 'react';

export interface WorkspaceSectionProps extends PropsWithChildren {
  columns?: 1 | 2;
  description?: string;
  id: string;
  sx?: SxProps<Theme>;
  title: string;
}

export interface WorkspaceSectionLayoutContract {
  readonly defaultColumns: Readonly<{ compact: 1; medium: 2 }>;
  readonly gridTemplateColumns: Readonly<{ xs: string; sm: string }>;
}

function columnTemplate(columnCount: number) {
  return `repeat(${columnCount}, minmax(0, 1fr))`;
}

export const workspaceSectionLayout = {
  defaultColumns: { compact: 1, medium: 2 },
  gridTemplateColumns: {
    xs: columnTemplate(1),
    sm: columnTemplate(2),
  },
} as const satisfies WorkspaceSectionLayoutContract;

export function WorkspaceSection({ children, columns = workspaceSectionLayout.defaultColumns.medium, description, id, sx, title }: WorkspaceSectionProps) {
  const headingId = `${id}-title`;
  const customStyles = Array.isArray(sx) ? sx : sx ? [sx] : [];
  const gridTemplateColumns = columns === 1
    ? { xs: workspaceSectionLayout.gridTemplateColumns.xs, sm: workspaceSectionLayout.gridTemplateColumns.xs }
    : workspaceSectionLayout.gridTemplateColumns;

  return (
    <Stack aria-labelledby={headingId} component="section" gap={{ xs: 1.5, sm: 2 }} id={id} sx={customStyles}>
      <Stack gap={0.25}>
        <Typography component="h2" fontWeight={750} id={headingId} variant="h3">
          {title}
        </Typography>
        {description ? (
          <Typography color="text.secondary" variant="body2">
            {description}
          </Typography>
        ) : null}
      </Stack>
      <Box
        display="grid"
        gap={{ xs: 1.5, sm: 2 }}
        gridTemplateColumns={gridTemplateColumns}
      >
        {children}
      </Box>
    </Stack>
  );
}
