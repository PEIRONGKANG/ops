import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { type AuthApi } from '@/shared/api/authApi';

import { AuthProvider } from './AuthProvider';
import { createSessionStore } from './sessionStore';
import { useAuth } from './useAuth';

function Probe() {
  const auth = useAuth();
  return <output>{auth.status === 'authenticated' ? auth.profile?.displayName : auth.status}</output>;
}

describe('AuthProvider', () => {
  it('restores a cookie-backed session before exposing a server-authoritative profile', async () => {
    const api: AuthApi = {
      login: async () => ({ accessToken: 'access-token', tokenType: 'access', expiresInSeconds: 900 }),
      changePassword: async () => ({ accessToken: 'access-token', tokenType: 'access', expiresInSeconds: 900 }),
      refresh: async () => ({ accessToken: 'access-token', tokenType: 'access', expiresInSeconds: 900 }),
      logout: async () => undefined,
      me: async () => ({ id: 'account-id', loginId: 'P3', displayName: '林同学', roles: ['P3'] }),
    };

    render(<AuthProvider api={api} store={createSessionStore()}><Probe /></AuthProvider>);

    expect(await screen.findByText('林同学')).toBeVisible();
  });
});
