import { createContext, type PropsWithChildren, useContext, useEffect, useMemo } from 'react';

import { createAuthApi, refreshSession, type AccountProfile, type AuthApi, type SessionResponse } from '@/shared/api/authApi';
import { ApiClient } from '@/shared/api/httpClient';

import { createSessionStore, type SessionStore, useSessionSnapshot } from './sessionStore';

interface AuthContextValue {
  status: ReturnType<typeof useSessionSnapshot>['status'];
  profile: AccountProfile | null;
  login(input: { loginId: string; password: string }): Promise<SessionResponse>;
  changePassword(input: { newPassword: string }): Promise<SessionResponse>;
  logout(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function createDefaultDependencies() {
  const store = createSessionStore();
  const client = new ApiClient({
    getAccessToken: () => store.getSnapshot().accessToken,
    refresh: async (): Promise<string | null> => {
      const session = await refreshSession();
      store.setAccessToken(session.accessToken, session.tokenType === 'password_change' ? 'password_change' : 'authenticated');
      return session.accessToken;
    },
    clearSession: store.clear,
  });
  return { store, api: createAuthApi(client) };
}

const defaultDependencies = createDefaultDependencies();

interface AuthProviderProps extends PropsWithChildren {
  api?: AuthApi;
  store?: SessionStore;
}

export function AuthProvider({ children, api = defaultDependencies.api, store = defaultDependencies.store }: AuthProviderProps) {
  const snapshot = useSessionSnapshot(store);

  useEffect(() => {
    let active = true;
    void api.refresh()
      .then(async (session) => {
        if (!active) return;
        store.setAccessToken(session.accessToken, session.tokenType === 'password_change' ? 'password_change' : 'authenticated');
        if (session.tokenType === 'access') store.setProfile(await api.me());
      })
      .catch(() => store.clear());
    return () => { active = false; };
  }, [api, store]);

  const value = useMemo<AuthContextValue>(() => ({
    status: snapshot.status,
    profile: snapshot.profile,
    login: async (input) => {
      const session = await api.login(input);
      store.setAccessToken(session.accessToken, session.tokenType === 'password_change' ? 'password_change' : 'authenticated');
      if (session.tokenType === 'access') store.setProfile(await api.me());
      return session;
    },
    changePassword: async (input) => {
      const session = await api.changePassword(input);
      store.setAccessToken(session.accessToken);
      store.setProfile(await api.me());
      return session;
    },
    logout: async () => {
      try { await api.logout(); } finally { store.clear(); }
    },
  }), [api, snapshot.profile, snapshot.status, store]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
