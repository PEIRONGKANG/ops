import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';

import { ApiError } from '@/shared/api/ApiError';
import { useAuth } from '@/shared/auth/useAuth';

interface LoginValues {
  loginId: string;
  password: string;
}

export function LoginPage() {
  const { login } = useAuth();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginValues>({
    defaultValues: { loginId: '', password: '' },
  });

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      await login(values);
    } catch (error) {
      setSubmitError(error instanceof ApiError && error.code === 'LOGIN_THROTTLED'
        ? '尝试次数过多，请稍后再试。'
        : '账号或密码不正确，请重新输入。');
    }
  });

  return (
    <Box alignItems="center" display="flex" justifyContent="center" minHeight="100dvh" p={{ xs: 2, sm: 4 }}>
      <Paper component="section" elevation={0} sx={{ border: 1, borderColor: 'divider', maxWidth: 460, p: { xs: 3, sm: 5 }, width: '100%' }}>
        <Stack gap={3}>
          <Stack alignItems="flex-start" gap={1}>
            <Box alignItems="center" bgcolor="primaryContainer" borderRadius={3} color="primary.main" display="inline-flex" height={48} justifyContent="center" width={48}>
              <LockOutlinedIcon aria-hidden />
            </Box>
            <Typography color="primary" fontWeight={800} variant="overline">BEVERAGE OPS</Typography>
            <Typography component="h1" variant="h2">登录到饮品实训运营系统</Typography>
            <Typography color="text.secondary">使用学院分配的账号登录，继续你的当班、带教或治理工作。</Typography>
          </Stack>

          {submitError ? <Alert severity="error">{submitError}</Alert> : null}

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
                render={({ field }) => <TextField {...field} autoComplete="current-password" error={Boolean(errors.password)} helperText={errors.password?.message} label="密码" type="password" />}
              />
              <Button disabled={isSubmitting} size="large" type="submit" variant="contained">{isSubmitting ? '正在登录…' : '登录'}</Button>
            </Stack>
          </Box>
          <Typography color="text.secondary" variant="body2">首次使用临时密码登录后，系统将要求你更新密码。</Typography>
        </Stack>
      </Paper>
    </Box>
  );
}
