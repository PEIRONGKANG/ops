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
    const user = userEvent.setup();
    const api: AuthApi = {
      login: vi.fn(),
      changePassword: vi.fn(),
      refresh: vi.fn().mockRejectedValue(new ApiError(401, { code: 'UNAUTHORIZED', message: 'Refresh cookie is missing.' })),
      logout: vi.fn(),
      me: vi.fn(),
    };

    render(<App api={api} store={createSessionStore()} />);

    expect(await screen.findByRole('main', { name: '登录到饮品实训运营系统' })).toBeVisible();
    expect(screen.getByRole('region', { name: '系统简介' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: '登录到饮品实训运营系统' })).toBeVisible();
    expect(screen.getByRole('textbox', { name: '账号' })).toBeVisible();
    const password = screen.getByLabelText('密码');
    expect(password).toHaveAttribute('type', 'password');
    await user.type(password, 'TemporaryPassword-2026');
    await user.tab();
    expect(screen.getByRole('button', { name: '显示密码' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(password).toHaveAttribute('type', 'text');
    expect(password).toHaveValue('TemporaryPassword-2026');
    await user.keyboard(' ');
    expect(password).toHaveAttribute('type', 'password');
    expect(api.login).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '登录' })).toBeVisible();
    expect(screen.queryByText('BEVERAGE OPS')).not.toBeInTheDocument();
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

  it('summarizes empty login fields once and focuses the first invalid field', async () => {
    const user = userEvent.setup();
    const api: AuthApi = {
      login: vi.fn(),
      changePassword: vi.fn(),
      refresh: vi.fn().mockRejectedValue(new ApiError(401, { code: 'UNAUTHORIZED', message: 'Refresh cookie is missing.' })),
      logout: vi.fn(),
      me: vi.fn(),
    };

    render(<App api={api} store={createSessionStore()} />);

    await user.click(await screen.findByRole('button', { name: '登录' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('请完成 2 个必填项：账号、密码。');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    const loginId = screen.getByRole('textbox', { name: '账号' });
    expect(loginId).toHaveFocus();
    expect(loginId).toHaveAttribute('aria-invalid', 'true');
    const description = document.getElementById(loginId.getAttribute('aria-describedby') ?? '');
    expect(description).toHaveTextContent('请输入账号。');
    expect(description).toHaveStyle({ height: '1px', overflow: 'hidden', position: 'absolute', width: '1px' });
    const password = screen.getByLabelText('密码');
    const passwordDescription = document.getElementById(password.getAttribute('aria-describedby') ?? '');
    expect(passwordDescription).toHaveTextContent('请输入密码。');
    expect(passwordDescription).toHaveStyle({ height: '1px', overflow: 'hidden', position: 'absolute', width: '1px' });
    expect(api.login).not.toHaveBeenCalled();
  });

  it('shows the required password change screen for a restricted first-login session', async () => {
    const user = userEvent.setup();
    const api: AuthApi = {
      login: vi.fn(),
      changePassword: vi.fn(),
      refresh: vi.fn().mockResolvedValue({ accessToken: 'password-change-token', tokenType: 'password_change', expiresInSeconds: 600 }),
      logout: vi.fn(),
      me: vi.fn(),
    };

    render(<App api={api} store={createSessionStore()} />);

    expect(await screen.findByRole('main', { name: '更新登录密码' })).toBeVisible();
    expect(screen.getByRole('region', { name: '系统简介' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: '更新登录密码' })).toBeVisible();
    const newPassword = screen.getByLabelText('新密码');
    const confirmPassword = screen.getByLabelText('确认新密码');
    await user.type(newPassword, 'ChangedPassword-2026');
    await user.type(confirmPassword, 'ChangedPassword-2026');
    expect(newPassword).toHaveAttribute('type', 'password');
    expect(confirmPassword).toHaveAttribute('type', 'password');

    await user.click(screen.getByRole('button', { name: '显示新密码' }));
    expect(newPassword).toHaveAttribute('type', 'text');
    expect(confirmPassword).toHaveAttribute('type', 'password');
    expect(newPassword).toHaveValue('ChangedPassword-2026');

    await user.click(screen.getByRole('button', { name: '显示确认新密码' }));
    expect(newPassword).toHaveAttribute('type', 'text');
    expect(confirmPassword).toHaveAttribute('type', 'text');
    expect(confirmPassword).toHaveValue('ChangedPassword-2026');

    await user.click(screen.getByRole('button', { name: '隐藏新密码' }));
    expect(newPassword).toHaveAttribute('type', 'password');
    expect(confirmPassword).toHaveAttribute('type', 'text');
    expect(api.changePassword).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '更新密码并继续' })).toBeVisible();
    expect(screen.queryByText('BEVERAGE OPS')).not.toBeInTheDocument();
  });

  it('summarizes empty password-change fields and hides repeated field errors', async () => {
    const user = userEvent.setup();
    const api: AuthApi = {
      login: vi.fn(),
      changePassword: vi.fn(),
      refresh: vi.fn().mockResolvedValue({ accessToken: 'password-change-token', tokenType: 'password_change', expiresInSeconds: 600 }),
      logout: vi.fn(),
      me: vi.fn(),
    };

    render(<App api={api} store={createSessionStore()} />);

    expect(await screen.findByText('长度为 12–128 个字符，且不能与账号相同。')).toBeVisible();
    await user.click(screen.getByRole('button', { name: '更新密码并继续' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('请检查 2 个字段：新密码、确认新密码。');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    const newPassword = screen.getByLabelText('新密码');
    expect(newPassword).toHaveFocus();
    expect(newPassword).toHaveAttribute('aria-invalid', 'true');
    const description = document.getElementById(newPassword.getAttribute('aria-describedby') ?? '');
    expect(description).toHaveTextContent('请输入新密码。');
    expect(description).toHaveStyle({ height: '1px', overflow: 'hidden', position: 'absolute', width: '1px' });
    const confirmation = screen.getByLabelText('确认新密码');
    const confirmationDescription = document.getElementById(confirmation.getAttribute('aria-describedby') ?? '');
    expect(confirmationDescription).toHaveTextContent('请再次输入新密码。');
    expect(confirmationDescription).toHaveStyle({ height: '1px', overflow: 'hidden', position: 'absolute', width: '1px' });
    expect(api.changePassword).not.toHaveBeenCalled();
  });

  it('summarizes invalid password rules without calling completed fields required', async () => {
    const user = userEvent.setup();
    const api: AuthApi = {
      login: vi.fn(),
      changePassword: vi.fn(),
      refresh: vi.fn().mockResolvedValue({ accessToken: 'password-change-token', tokenType: 'password_change', expiresInSeconds: 600 }),
      logout: vi.fn(),
      me: vi.fn(),
    };

    render(<App api={api} store={createSessionStore()} />);

    await user.type(await screen.findByLabelText('新密码'), 'short');
    await user.type(screen.getByLabelText('确认新密码'), 'different');
    await user.click(screen.getByRole('button', { name: '更新密码并继续' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('请检查 2 个字段：新密码、确认新密码。');
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(screen.getByLabelText('新密码')).toHaveFocus();
    expect(api.changePassword).not.toHaveBeenCalled();
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
