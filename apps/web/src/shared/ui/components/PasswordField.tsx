import VisibilityOffOutlinedIcon from '@mui/icons-material/VisibilityOffOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { IconButton, InputAdornment, TextField, type SxProps, type Theme } from '@mui/material';
import { forwardRef, type ComponentProps, useState } from 'react';

type PasswordFieldProps = Omit<ComponentProps<typeof TextField>, 'label' | 'slotProps' | 'type'> & {
  helperTextSx?: SxProps<Theme>;
  label: string;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { helperTextSx, label, ...props },
  ref,
) {
  const [isVisible, setIsVisible] = useState(false);
  const actionLabel = `${isVisible ? '隐藏' : '显示'}${label}`;

  return (
    <TextField
      {...props}
      inputRef={ref}
      label={label}
      slotProps={{
        formHelperText: helperTextSx ? { sx: helperTextSx } : undefined,
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={actionLabel}
                aria-pressed={isVisible}
                edge="end"
                onClick={() => setIsVisible((visible) => !visible)}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                {isVisible ? <VisibilityOffOutlinedIcon aria-hidden /> : <VisibilityOutlinedIcon aria-hidden />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
      type={isVisible ? 'text' : 'password'}
    />
  );
});
