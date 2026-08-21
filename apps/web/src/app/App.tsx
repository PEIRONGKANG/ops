import { useMemo } from 'react';

import { AppThemeProvider } from '@/shared/ui/theme/AppThemeProvider';
import { AuthProvider, type AuthProviderProps, useAuthenticatedApiClient } from '@/shared/auth/AuthProvider';
import { useAuth } from '@/shared/auth/useAuth';
import { ChangePasswordPage } from '@/features/auth/ChangePasswordPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { createGovernanceApi } from '@/features/governance/governanceApi';

function AppContent() {
  const { profile, status } = useAuth();
  const client = useAuthenticatedApiClient();
  const governanceApi = useMemo(() => createGovernanceApi(client), [client]);

  if (status === 'booting') return <main aria-label="正在初始化会话" />;
  if (status === 'guest') return <LoginPage />;
  if (status === 'password_change') return <ChangePasswordPage />;
  if (!profile) return <main aria-label="正在加载工作台" />;
  return <DashboardPage api={governanceApi} profile={profile} />;
}

export function App({ api, store }: Pick<AuthProviderProps, 'api' | 'store'> = {}) {
  return (
    <AppThemeProvider>
      <AuthProvider api={api} store={store}>
        <AppContent />
      </AuthProvider>
    </AppThemeProvider>
  );
}
