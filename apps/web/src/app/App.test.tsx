import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type AuthApi } from '@/shared/api/authApi';
import { ApiError } from '@/shared/api/ApiError';
import { createSessionStore } from '@/shared/auth/sessionStore';

import { App } from './App';

describe('App', () => {
  it('renders the application bootstrap state', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    render(<App />);

    expect(screen.getByLabelText('正在初始化会话')).toBeInTheDocument();
  });

  it('shows the login page when the browser has no refresh cookie', async () => {
    const api: AuthApi = {
      login: vi.fn(),
      changePassword: vi.fn(),
      refresh: vi.fn().mockRejectedValue(new ApiError(401, { code: 'UNAUTHORIZED', message: 'Refresh cookie is missing.' })),
      logout: vi.fn(),
      me: vi.fn(),
    };

    render(<App api={api} store={createSessionStore()} />);

    expect(await screen.findByRole('heading', { name: '登录到饮品实训运营系统' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: '账号' })).toBeVisible();
    expect(screen.getByLabelText('密码')).toBeVisible();
  });

  it('shows a failed login in the global toast instead of expanding the form', async () => {
    const user = userEvent.setup();
    const api: AuthApi = {
      login: vi.fn().mockRejectedValue(new ApiError(401, { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials.' })),
      changePassword: vi.fn(),
      refresh: vi.fn().mockRejectedValue(new ApiError(401, { code: 'UNAUTHORIZED', message: 'Refresh cookie is missing.' })),
      logout: vi.fn(),
      me: vi.fn(),
    };

    render(<App api={api} store={createSessionStore()} />);

    await user.type(await screen.findByRole('textbox', { name: '账号' }), 'P1');
    await user.type(screen.getByLabelText('密码'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: '登录' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('账号或密码不正确，请重新输入。');
    expect(alert.closest('.MuiSnackbar-root')).toBeInTheDocument();
  });

  it('shows the required password change screen for a restricted first-login session', async () => {
    const api: AuthApi = {
      login: vi.fn(),
      changePassword: vi.fn(),
      refresh: vi.fn().mockResolvedValue({ accessToken: 'password-change-token', tokenType: 'password_change', expiresInSeconds: 600 }),
      logout: vi.fn(),
      me: vi.fn(),
    };

    render(<App api={api} store={createSessionStore()} />);

    expect(await screen.findByRole('heading', { name: '更新登录密码' })).toBeVisible();
    expect(screen.getByLabelText('新密码')).toBeVisible();
    expect(screen.getByLabelText('确认新密码')).toBeVisible();
  });

  it('exchanges the restricted token for a normal session after a valid password change', async () => {
    const user = userEvent.setup();
    const api: AuthApi = {
      login: vi.fn(),
      changePassword: vi.fn().mockResolvedValue({ accessToken: 'access-token', tokenType: 'access', expiresInSeconds: 900 }),
      refresh: vi.fn().mockResolvedValue({ accessToken: 'password-change-token', tokenType: 'password_change', expiresInSeconds: 600 }),
      logout: vi.fn(),
      me: vi.fn().mockResolvedValue({ id: 'account-id', loginId: 'ADMIN001', displayName: '系统管理员', roles: ['P1'] }),
    };

    render(<App api={api} store={createSessionStore()} />);

    await user.type(await screen.findByLabelText('新密码'), 'ChangedPassword-2026');
    await user.type(screen.getByLabelText('确认新密码'), 'ChangedPassword-2026');
    await user.click(screen.getByRole('button', { name: '更新密码并继续' }));

    expect(api.changePassword).toHaveBeenCalledWith({ newPassword: 'ChangedPassword-2026' });
    expect(await screen.findByText('运营治理')).toBeVisible();
    expect(screen.queryByText('系统管理员，欢迎回来')).not.toBeInTheDocument();
    expect(await screen.findByRole('list', { name: '启动配置流程' })).toBeVisible();
    expect(screen.getByLabelText('当前步骤配置')).toBeVisible();
    expect(screen.queryByRole('heading', { name: '启动清单' })).not.toBeInTheDocument();
    expect(screen.getByText('建立实训周期')).toBeVisible();
    expect(screen.getByText('配置运营模板')).toBeVisible();
    expect(screen.getByText('组织实训人员')).toBeVisible();
    expect(screen.queryByText('1. 初始化运行环境')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '治理配置即将开放' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '跳到主要内容' })).not.toBeInTheDocument();
    expect(screen.queryByText('BEVERAGE OPS')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '运营工作台' })).not.toBeInTheDocument();
    expect(screen.queryByText('你的工作身份')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '打开导航' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '通知' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: '通知' }));
    expect(await screen.findByText('系统管理员，欢迎回来')).toBeVisible();
  });

  afterEach(() => vi.unstubAllGlobals());
});
