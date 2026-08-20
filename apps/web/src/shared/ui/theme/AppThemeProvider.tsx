import { CssBaseline, ThemeProvider } from '@mui/material';
import { type PropsWithChildren, useMemo } from 'react';

import { createBeverageTheme } from './createTheme';

export function AppThemeProvider({ children }: PropsWithChildren) {
  const theme = useMemo(() => createBeverageTheme(), []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
