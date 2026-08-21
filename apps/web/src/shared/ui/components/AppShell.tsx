import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import { AppBar, Box, IconButton, Stack, Toolbar } from '@mui/material';
import { type PropsWithChildren, type ReactNode } from 'react';

interface AppShellProps extends PropsWithChildren {
  headerContent?: ReactNode;
  navigation?: ReactNode;
}

export function AppShell({ children, headerContent, navigation }: AppShellProps) {
  return (
    <Box minHeight="100dvh">
      <AppBar color="inherit" elevation={0} position="sticky" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton aria-label="打开导航" edge="start"><MenuRoundedIcon /></IconButton>
          <Stack alignItems="center" direction="row" flex={1} flexWrap="wrap" gap={0.75} minWidth={0}>{headerContent}</Stack>
          <IconButton aria-label="通知"><NotificationsNoneRoundedIcon /></IconButton>
        </Toolbar>
      </AppBar>
      <Box display="grid" gridTemplateColumns={{ md: navigation ? '240px minmax(0, 1fr)' : '1fr' }}>
        {navigation ? <Box component="nav" sx={{ borderRight: { md: 1 }, borderColor: 'divider', display: { xs: 'none', md: 'block' }, p: 2 }}>{navigation}</Box> : null}
        <Box component="main" minWidth={0} p={{ xs: 2, sm: 3, md: 4 }}>{children}</Box>
      </Box>
    </Box>
  );
}
