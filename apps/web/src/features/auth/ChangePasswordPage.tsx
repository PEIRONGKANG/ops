import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import { Box, Button, Stack, Typography } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';

import { ApiError } from '@/shared/api/ApiError';
import { useAuth } from '@/shared/auth/useAuth';
import { AuthScaffold } from '@/shared/ui/components/AuthScaffold';
import { PasswordField } from '@/shared/ui/components/PasswordField';
import { useToast } from '@/shared/ui/feedback/ToastProvider';
import { visuallyHiddenFieldError } from '@/shared/ui/forms/fieldErrorAccessibility';
import { type FormErrorField, useFormErrorToast } from '@/shared/ui/forms/useFormErrorToast';

interface ChangePasswordValues {
  newPassword: string;
  confirmPassword: string;
}

const requiredFields = [
  { label: '新密码', name: 'newPassword' },
  { label: '确认新密码', name: 'confirmPassword' },
] as const satisfies readonly FormErrorField<ChangePasswordValues>[];

const newPasswordInputId = 'new-password';
const newPasswordRulesId = 'new-password-rules';
const newPasswordRules = '长度为 12–128 个字符，且不能与账号相同。';

export function ChangePasswordPage() {
  const { changePassword } = useAuth();
  const { showToast } = useToast();
  const { control, handleSubmit, watch, formState: { errors, isSubmitting }, setFocus } = useForm<ChangePasswordValues>({
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const handleInvalid = useFormErrorToast({ fields: requiredFields, setFocus, summary: 'invalid' });
  const newPassword = watch('newPassword');

  const submit = async ({ newPassword: password }: ChangePasswordValues) => {
    try {
      await changePassword({ newPassword: password });
    } catch (error) {
      showToast({
        message: error instanceof ApiError && error.status === 400
          ? error.message
          : '暂时无法更新密码，请稍后重试。',
        severity: 'error',
      });
    }
  };

  return (
    <AuthScaffold
      description="这是你的初始密码。请设置一个仅你本人知晓的新密码后继续。"
      title="更新登录密码"
    >
      <Stack gap={3} maxWidth={440} width="100%">
        <Stack alignItems="center" direction="row" gap={1.5}>
          <Box
            alignItems="center"
            bgcolor="var(--beverage-primary-container)"
            borderRadius="50%"
            color="primary.main"
            display="inline-flex"
            flex="0 0 auto"
            height={40}
            justifyContent="center"
            width={40}
          >
            <KeyRoundedIcon aria-hidden fontSize="small" />
          </Box>
          <Typography color="text.secondary" variant="body2">
            首次登录安全设置
          </Typography>
        </Stack>
        <Box component="form" noValidate onSubmit={handleSubmit(submit, handleInvalid)}>
          <Stack gap={2.5}>
            <Controller
              control={control}
              name="newPassword"
              rules={{
                required: '请输入新密码。',
                minLength: { value: 12, message: '密码至少需要 12 个字符。' },
                maxLength: { value: 128, message: '密码不能超过 128 个字符。' },
              }}
              render={({ field }) => (
                <Stack gap={0.75}>
                  <PasswordField
                    {...field}
                    ariaDescribedBy={`${newPasswordRulesId}${errors.newPassword ? ` ${newPasswordInputId}-helper-text` : ''}`}
                    autoComplete="new-password"
                    error={Boolean(errors.newPassword)}
                    helperText={errors.newPassword?.message}
                    helperTextSx={errors.newPassword ? visuallyHiddenFieldError : undefined}
                    id={newPasswordInputId}
                    label="新密码"
                  />
                  <Typography color="text.secondary" id={newPasswordRulesId} mx={1.5} variant="caption">
                    {newPasswordRules}
                  </Typography>
                </Stack>
              )}
            />
            <Controller
              control={control}
              name="confirmPassword"
              rules={{
                required: '请再次输入新密码。',
                validate: (value) => value === newPassword || '两次输入的密码不一致。',
              }}
              render={({ field }) => <PasswordField {...field} autoComplete="new-password" error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword?.message} helperTextSx={errors.confirmPassword ? visuallyHiddenFieldError : undefined} label="确认新密码" />}
            />
            <Button disabled={isSubmitting} size="large" type="submit" variant="contained">
              {isSubmitting ? '正在更新…' : '更新密码并继续'}
            </Button>
          </Stack>
        </Box>
      </Stack>
    </AuthScaffold>
  );
}
