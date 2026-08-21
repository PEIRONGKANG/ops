import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import { AppBar, Badge, Box, IconButton, Popover, Stack, Toolbar } from '@mui/material';
import { type MouseEvent, type PropsWithChildren, type ReactNode, useState } from 'react';

interface AppShellProps extends PropsWithChildren {
  headerContent?: ReactNode;
  navigation?: ReactNode;
  notificationContent?: ReactNode;
  notificationCount?: number;
}

export function AppShell({ children, headerContent, navigation, notificationContent, notificationCount = 0 }: AppShellProps) {
  const [notificationAnchor, setNotificationAnchor] = useState<HTMLElement | null>(null);
  const notificationOpen = Boolean(notificationAnchor);

  const openNotifications = (event: MouseEvent<HTMLElement>) => setNotificationAnchor(event.currentTarget);
  const closeNotifications = () => setNotificationAnchor(null);

  return (
    <Box minHeight="100dvh">
      <AppBar color="inherit" elevation={0} position="sticky" sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.default' }}>
        <Toolbar sx={{ gap: 1 }}>
          <Stack alignItems="center" direction="row" flex={1} flexWrap="wrap" gap={0.75} minWidth={0}>{headerContent}</Stack>
          {notificationContent ? <IconButton aria-controls={notificationOpen ? 'workspace-notifications' : undefined} aria-expanded={notificationOpen} aria-haspopup="dialog" aria-label="通知" color="primary" onClick={openNotifications}>
            <Badge badgeContent={notificationCount} color="primary" invisible={notificationCount === 0} max={9}><NotificationsNoneRoundedIcon /></Badge>
          </IconButton> : null}
        </Toolbar>
      </AppBar>
      {notificationContent ? <Popover anchorEl={notificationAnchor} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }} id="workspace-notifications" onClose={closeNotifications} open={notificationOpen} slotProps={{ paper: { 'aria-label': '系统通知', role: 'dialog', sx: { maxWidth: 'min(400px, calc(100vw - 32px))', mt: 1, p: 2.5, width: 360 } } }} transformOrigin={{ horizontal: 'right', vertical: 'top' }}>
        {notificationContent}
      </Popover> : null}
      <Box display="grid" gridTemplateColumns={{ md: navigation ? '240px minmax(0, 1fr)' : '1fr' }}>
        {navigation ? <Box component="nav" sx={{ borderRight: { md: 1 }, borderColor: 'divider', display: { xs: 'none', md: 'block' }, p: 2 }}>{navigation}</Box> : null}
        <Box component="main" minWidth={0} p={{ xs: 2, sm: 3, md: 4 }}>{children}</Box>
      </Box>
    </Box>
  );
}
