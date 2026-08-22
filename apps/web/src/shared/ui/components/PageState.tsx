import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SignalWifiOffRoundedIcon from '@mui/icons-material/SignalWifiOffRounded';
import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useId } from 'react';

type PageStateKind = 'loading' | 'empty' | 'error' | 'forbidden' | 'offline';

interface PageStateProps {
  kind: PageStateKind;
  title?: string;
  description?: string;
  onRetry?: () => void;
}

const defaultContent: Record<PageStateKind, { title: string; description: string }> = {
  loading: { title: '正在加载', description: '请稍候，我们正在准备最新信息。' },
  empty: { title: '暂时没有内容', description: '新的内容出现后会显示在这里。' },
  error: { title: '暂时无法加载', description: '请检查网络后重试，或稍后再试。' },
  forbidden: { title: '没有访问权限', description: '你的当前角色没有查看此内容的权限。' },
  offline: { title: '当前处于离线状态', description: '恢复网络后可重新加载最新数据。' },
};

const livePoliteness: Record<PageStateKind, 'assertive' | 'polite'> = {
  empty: 'polite',
  error: 'assertive',
  forbidden: 'polite',
  loading: 'polite',
  offline: 'assertive',
};

function StateIcon({ kind }: Pick<PageStateProps, 'kind'>) {
  if (kind === 'loading') return <CircularProgress size={30} />;
  if (kind === 'empty') return <Inventory2OutlinedIcon fontSize="large" />;
  if (kind === 'forbidden') return <LockOutlinedIcon aria-hidden fontSize="large" />;
  if (kind === 'offline') return <SignalWifiOffRoundedIcon aria-hidden fontSize="large" />;
  if (kind === 'error') return <ErrorOutlineRoundedIcon aria-hidden fontSize="large" />;
  return null;
}

export function PageState({ kind, title, description, onRetry }: PageStateProps) {
  const content = defaultContent[kind];
  const canRetry = (kind === 'error' || kind === 'offline') && onRetry;
  const titleId = useId();

  return (
    <Stack
      alignItems="center"
      aria-atomic="true"
      aria-labelledby={titleId}
      aria-live={livePoliteness[kind]}
      component="section"
      gap={1.5}
      justifyContent="center"
      minHeight={240}
      px={3}
      textAlign="center"
    >
      <Box
        alignItems="center"
        aria-hidden="true"
        bgcolor="var(--beverage-surface-container-high)"
        borderRadius="var(--beverage-shape-full)"
        color={kind === 'error' || kind === 'offline' ? 'error.main' : 'primary.main'}
        data-testid="page-state-icon"
        display="flex"
        height={64}
        justifyContent="center"
        width={64}
      >
        <StateIcon kind={kind} />
      </Box>
      <Typography component="h2" id={titleId} variant="h3">{title ?? content.title}</Typography>
      <Typography color="text.secondary" maxWidth={420}>{description ?? content.description}</Typography>
      {canRetry ? <Button onClick={onRetry} variant="contained">重试</Button> : null}
    </Stack>
  );
}
