import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { Chip } from '@mui/material';

export type StatusTone = 'neutral' | 'success' | 'warning' | 'danger';

interface StatusChipProps {
  label: string;
  tone?: StatusTone;
}

const colourByTone: Record<StatusTone, 'default' | 'success' | 'warning' | 'error'> = {
  neutral: 'default',
  success: 'success',
  warning: 'warning',
  danger: 'error',
};

export function StatusChip({ label, tone = 'neutral' }: StatusChipProps) {
  const icon = {
    danger: <ErrorOutlineRoundedIcon aria-hidden="true" />,
    neutral: undefined,
    success: <CheckCircleRoundedIcon aria-hidden="true" />,
    warning: <WarningAmberRoundedIcon aria-hidden="true" />,
  }[tone];

  return <Chip color={colourByTone[tone]} icon={icon} label={label} size="small" variant={tone === 'neutral' ? 'outlined' : 'filled'} />;
}
