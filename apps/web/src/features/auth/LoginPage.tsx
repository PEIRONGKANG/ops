import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { Controller, useForm } from 'react-hook-form';

import { ApiError } from '@/shared/api/ApiError';
import { useAuth } from '@/shared/auth/useAuth';
import { AuthScaffold } from '@/shared/ui/components/AuthScaffold';
import { PasswordField } from '@/shared/ui/components/PasswordField';
import { useToast } from '@/shared/ui/feedback/ToastProvider';

interface LoginValues {
  loginId: string;
  password: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const { showToast } = useToast();
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    defaultValues: { loginId: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    try {
      await login(values);
    } catch (error) {
      showToast({
        message: error instanceof ApiError && error.code === 'LOGIN_THROTTLED'
          ? '尝试次数过多，请稍后再试。'
          : '账号或密码不正确，请重新输入。',
        severity: 'error',
      });
    }
  });

  return (
    <AuthScaffold
      description="使用学院分配的账号，继续你的当班、带教或治理工作。"
      title="登录到饮品实训运营系统"
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
            <LockOutlinedIcon aria-hidden fontSize="small" />
          </Box>
          <Typography color="text.secondary" variant="body2">
            安全登录
          </Typography>
        </Stack>
        <Box component="form" noValidate onSubmit={submit}>
          <Stack gap={2.5}>
            <Controller
              control={control}
              name="loginId"
              rules={{ required: '请输入账号。' }}
              render={({ field }) => <TextField {...field} autoComplete="username" error={Boolean(errors.loginId)} helperText={errors.loginId?.message} label="账号" />}
            />
            <Controller
              control={control}
              name="password"
              rules={{ required: '请输入密码。' }}
              render={({ field }) => <PasswordField {...field} autoComplete="current-password" error={Boolean(errors.password)} helperText={errors.password?.message} label="密码" />}
            />
            <Button disabled={isSubmitting} size="large" type="submit" variant="contained">
              {isSubmitting ? '正在登录…' : '登录'}
            </Button>
          </Stack>
        </Box>
        <Typography color="text.secondary" variant="body2">
          首次使用临时密码登录后，系统将要求你更新密码。
        </Typography>
      </Stack>
    </AuthScaffold>
  );
}
