import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import { AppBar, Box, IconButton, Stack, Toolbar, Typography } from '@mui/material';
import { type PropsWithChildren, type ReactNode } from 'react';

interface AppShellProps extends PropsWithChildren {
  navigation?: ReactNode;
  title?: string;
}

export function AppShell({ children, navigation, title = '饮品实训运营系统' }: AppShellProps) {
  return (
    <Box minHeight="100dvh">
      <a className="skip-link" href="#main-content">跳到主要内容</a>
      <AppBar color="inherit" elevation={0} position="sticky" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
        <Toolbar sx={{ gap: 1 }}>
          <IconButton aria-label="打开导航" edge="start"><MenuRoundedIcon /></IconButton>
          <Stack flex={1} minWidth={0}>
            <Typography color="primary" fontWeight={800} variant="overline">BEVERAGE OPS</Typography>
            <Typography noWrap variant="subtitle1">{title}</Typography>
          </Stack>
          <IconButton aria-label="通知"><NotificationsNoneRoundedIcon /></IconButton>
        </Toolbar>
      </AppBar>
      <Box display="grid" gridTemplateColumns={{ md: navigation ? '240px minmax(0, 1fr)' : '1fr' }}>
        {navigation ? <Box component="nav" sx={{ borderRight: { md: 1 }, borderColor: 'divider', display: { xs: 'none', md: 'block' }, p: 2 }}>{navigation}</Box> : null}
        <Box component="main" id="main-content" minWidth={0} p={{ xs: 2, sm: 3, md: 4 }}>{children}</Box>
      </Box>
    </Box>
  );
}
