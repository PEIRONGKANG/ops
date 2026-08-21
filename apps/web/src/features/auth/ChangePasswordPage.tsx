import KeyRoundedIcon from '@mui/icons-material/KeyRounded';
import { Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';

import { ApiError } from '@/shared/api/ApiError';
import { useAuth } from '@/shared/auth/useAuth';
import { useToast } from '@/shared/ui/feedback/ToastProvider';

interface ChangePasswordValues {
  newPassword: string;
  confirmPassword: string;
}

export function ChangePasswordPage() {
  const { changePassword } = useAuth();
  const { showToast } = useToast();
  const { control, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<ChangePasswordValues>({
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const newPassword = watch('newPassword');

  const submit = handleSubmit(async ({ newPassword: password }) => {
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
  });

  return (
    <Box alignItems="center" display="flex" justifyContent="center" minHeight="100dvh" p={{ xs: 2, sm: 4 }}>
      <Paper component="section" elevation={0} sx={{ border: 1, borderColor: 'divider', maxWidth: 460, p: { xs: 3, sm: 5 }, width: '100%' }}>
        <Stack gap={3}>
          <Stack alignItems="flex-start" gap={1}>
            <Box alignItems="center" bgcolor="primaryContainer" borderRadius={3} color="primary.main" display="inline-flex" height={48} justifyContent="center" width={48}>
              <KeyRoundedIcon aria-hidden />
            </Box>
            <Typography color="primary" fontWeight={800} variant="overline">BEVERAGE OPS</Typography>
            <Typography component="h1" variant="h2">更新登录密码</Typography>
            <Typography color="text.secondary">这是你的初始密码。请设置一个仅你本人知晓的新密码后继续。</Typography>
          </Stack>
          <Box component="form" noValidate onSubmit={submit}>
            <Stack gap={2.5}>
              <Controller
                control={control}
                name="newPassword"
                rules={{
                  required: '请输入新密码。',
                  minLength: { value: 12, message: '密码至少需要 12 个字符。' },
                  maxLength: { value: 128, message: '密码不能超过 128 个字符。' },
                }}
                render={({ field }) => <TextField {...field} autoComplete="new-password" error={Boolean(errors.newPassword)} helperText={errors.newPassword?.message ?? '长度为 12–128 个字符，且不能与账号相同。'} label="新密码" type="password" />}
              />
              <Controller
                control={control}
                name="confirmPassword"
                rules={{
                  required: '请再次输入新密码。',
                  validate: (value) => value === newPassword || '两次输入的密码不一致。',
                }}
                render={({ field }) => <TextField {...field} autoComplete="new-password" error={Boolean(errors.confirmPassword)} helperText={errors.confirmPassword?.message} label="确认新密码" type="password" />}
              />
              <Button disabled={isSubmitting} size="large" type="submit" variant="contained">
                {isSubmitting ? '正在更新…' : '更新密码并继续'}
              </Button>
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}
