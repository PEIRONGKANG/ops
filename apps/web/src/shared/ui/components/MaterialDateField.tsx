import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { zhCN } from '@mui/x-date-pickers/locales';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';

interface MaterialDateFieldProps {
  error?: boolean;
  helperText?: string;
  label: string;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}

export function MaterialDateField({ error = false, helperText, label, onChange, required = false, value }: MaterialDateFieldProps) {
  const selectedDate = value ? dayjs(value, 'YYYY-MM-DD', true) : null;

  return (
    <LocalizationProvider adapterLocale="zh-cn" dateAdapter={AdapterDayjs} localeText={zhCN.components.MuiLocalizationProvider.defaultProps.localeText}>
      <DatePicker
        format="YYYY-MM-DD"
        label={label}
        onChange={(nextValue) => onChange(nextValue?.isValid() ? nextValue.format('YYYY-MM-DD') : '')}
        slotProps={{ textField: { error, fullWidth: true, helperText, required } }}
        value={selectedDate?.isValid() ? selectedDate : null}
      />
    </LocalizationProvider>
  );
}
