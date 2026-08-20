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
  return <Chip color={colourByTone[tone]} label={label} size="small" variant={tone === 'neutral' ? 'outlined' : 'filled'} />;
}
