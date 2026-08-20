import { AppThemeProvider } from '@/shared/ui/theme/AppThemeProvider';
import { AuthProvider } from '@/shared/auth/AuthProvider';

export function App() {
  return (
    <AppThemeProvider>
      <AuthProvider>
        <main aria-label="正在初始化会话" />
      </AuthProvider>
    </AppThemeProvider>
  );
}
