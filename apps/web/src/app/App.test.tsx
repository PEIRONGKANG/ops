import { render, screen } from '@testing-library/react';
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

  afterEach(() => vi.unstubAllGlobals());
});
