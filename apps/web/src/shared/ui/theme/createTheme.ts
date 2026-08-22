import { createTheme } from '@mui/material/styles';

import { beverageTokens } from './tokens';

export function createBeverageTheme() {
  return createTheme({
    cssVariables: true,
    palette: {
      mode: 'light',
      primary: { main: beverageTokens.color.primary, contrastText: '#FFFFFF' },
      secondary: { main: beverageTokens.color.secondary },
      success: { main: beverageTokens.color.success },
      warning: { main: beverageTokens.color.warning, contrastText: '#FFFFFF' },
      error: { main: beverageTokens.color.danger, contrastText: '#FFFFFF' },
      background: { default: beverageTokens.color.surface, paper: '#FFFFFF' },
      text: { primary: beverageTokens.color.onSurface, secondary: '#4B514D' },
      divider: '#C1C9C2',
    },
    shape: { borderRadius: beverageTokens.shape.medium },
    typography: {
      fontFamily: '"PingFang SC", "Microsoft YaHei", Inter, system-ui, sans-serif',
      h1: { fontSize: '2rem', fontWeight: 700, lineHeight: 1.2 },
      h2: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3 },
      h3: { fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.35 },
      button: { fontWeight: 700, textTransform: 'none' },
    },
    transitions: {
      duration: { shortest: beverageTokens.motion.short, short: beverageTokens.motion.short, standard: beverageTokens.motion.medium },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          ':root': {
            colorScheme: 'light',
            '--beverage-primary-container': beverageTokens.color.primaryContainer,
            '--beverage-surface-container': beverageTokens.color.surfaceContainer,
            '--beverage-surface-container-high': beverageTokens.color.surfaceContainerHigh,
          },
          '*, *::before, *::after': { boxSizing: 'border-box' },
          'html': { scrollBehavior: 'smooth' },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': { scrollBehavior: 'auto !important', transitionDuration: '0.01ms !important', animationDuration: '0.01ms !important' },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: beverageTokens.shape.large,
            minHeight: 44,
            paddingInline: 20,
            ':focus-visible': { outline: '3px solid #0B5FFF', outlineOffset: 2 },
          },
        },
      },
      MuiPaper: { styleOverrides: { rounded: { borderRadius: beverageTokens.shape.large } } },
      MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44 } } },
      MuiTextField: { defaultProps: { fullWidth: true, variant: 'outlined' } },
    },
  });
}
