import { Box, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import { type PropsWithChildren } from 'react';

export interface WorkspaceSectionProps extends PropsWithChildren {
  columns?: 1 | 2 | 3;
  description?: string;
  id: string;
  sx?: SxProps<Theme>;
  title: string;
}

function columnTemplate(columnCount: number) {
  return `repeat(${columnCount}, minmax(0, 1fr))`;
}

export function WorkspaceSection({ children, columns = 2, description, id, sx, title }: WorkspaceSectionProps) {
  const headingId = `${id}-title`;
  const customStyles = Array.isArray(sx) ? sx : sx ? [sx] : [];

  return (
    <Stack aria-labelledby={headingId} component="section" gap={2.5} id={id} sx={customStyles}>
      <Stack gap={0.5}>
        <Typography component="h2" id={headingId} variant="h3">
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
        gap={{ xs: 2, sm: 2.5 }}
        gridTemplateColumns={{
          xs: columnTemplate(1),
          sm: columnTemplate(Math.min(columns, 2)),
          lg: columnTemplate(columns),
        }}
      >
        {children}
      </Box>
    </Stack>
  );
}
