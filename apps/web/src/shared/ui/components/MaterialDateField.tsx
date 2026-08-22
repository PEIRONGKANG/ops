import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { zhCN } from '@mui/x-date-pickers/locales';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import type { FocusEventHandler, Ref } from 'react';

import { visuallyHiddenFieldError } from '@/shared/ui/forms/fieldErrorAccessibility';

interface MaterialDateFieldProps {
  error?: boolean;
  helperText?: string;
  inputRef?: Ref<HTMLInputElement>;
  label: string;
  name?: string;
  onBlur?: FocusEventHandler<HTMLInputElement>;
  onChange: (value: string) => void;
  required?: boolean;
  value: string;
}

export function MaterialDateField({ error = false, helperText, inputRef, label, name, onBlur, onChange, required = false, value }: MaterialDateFieldProps) {
  const selectedDate = value ? dayjs(value, 'YYYY-MM-DD', true) : null;

  return (
    <LocalizationProvider adapterLocale="zh-cn" dateAdapter={AdapterDayjs} localeText={zhCN.components.MuiLocalizationProvider.defaultProps.localeText}>
      <DatePicker
        format="YYYY-MM-DD"
        inputRef={inputRef}
        label={label}
        name={name}
        onChange={(nextValue) => onChange(nextValue?.isValid() ? nextValue.format('YYYY-MM-DD') : '')}
        slotProps={{
          field: { onBlur },
          textField: {
            error,
            FormHelperTextProps: { sx: visuallyHiddenFieldError },
            fullWidth: true,
            helperText,
            required,
            variant: 'filled',
          },
        }}
        value={selectedDate?.isValid() ? selectedDate : null}
      />
    </LocalizationProvider>
  );
}
