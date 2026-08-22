import { createTheme } from '@mui/material/styles';

import { beverageTokens } from './tokens';

const primaryFocusRing = '0 0 0 3px color-mix(in srgb, var(--mui-palette-primary-main) var(--beverage-state-focus), transparent)';
const primaryHoverLayer = 'color-mix(in srgb, var(--mui-palette-primary-main) var(--beverage-state-hover), transparent)';
const primaryPressedLayer = 'color-mix(in srgb, var(--mui-palette-primary-main) var(--beverage-state-pressed), transparent)';

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
            '--beverage-state-hover': `${beverageTokens.state.hoverOpacity * 100}%`,
            '--beverage-state-focus': `${beverageTokens.state.focusOpacity * 100}%`,
            '--beverage-state-pressed': `${beverageTokens.state.pressedOpacity * 100}%`,
            '--beverage-layout-compact': `${beverageTokens.layout.compact}px`,
            '--beverage-layout-expanded': `${beverageTokens.layout.expanded}px`,
            '--beverage-layout-content-max': `${beverageTokens.layout.contentMax}px`,
            '--beverage-top-bar-height': `${beverageTokens.layout.topBarHeight}px`,
            '--beverage-shape-small': `${beverageTokens.shape.small}px`,
            '--beverage-shape-medium': `${beverageTokens.shape.medium}px`,
            '--beverage-shape-large': `${beverageTokens.shape.large}px`,
            '--beverage-shape-full': `${beverageTokens.shape.full}px`,
          },
          '*, *::before, *::after': { boxSizing: 'border-box' },
          'html': { scrollBehavior: 'smooth' },
          body: {
            backgroundColor: beverageTokens.color.surface,
            color: beverageTokens.color.onSurface,
            margin: 0,
            minWidth: 320,
            WebkitFontSmoothing: 'antialiased',
          },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': { scrollBehavior: 'auto !important', transitionDuration: '0.01ms !important', animationDuration: '0.01ms !important' },
          },
        },
      },
      MuiFilledInput: {
        defaultProps: { disableUnderline: true },
        styleOverrides: {
          root: {
            backgroundColor: 'var(--beverage-surface-container-high)',
            border: '1px solid transparent',
            borderRadius: beverageTokens.shape.small,
            minHeight: 56,
            overflow: 'hidden',
            transition: 'background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease',
            '&:hover': {
              backgroundColor: 'color-mix(in srgb, var(--mui-palette-text-primary) var(--beverage-state-hover), var(--beverage-surface-container-high))',
            },
            '&.Mui-focused': {
              backgroundColor: 'var(--beverage-surface-container-high)',
              borderColor: 'var(--mui-palette-primary-main)',
              boxShadow: primaryFocusRing,
            },
            '&.Mui-error': { borderColor: 'var(--mui-palette-error-main)' },
            '&.Mui-disabled': { backgroundColor: 'var(--beverage-surface-container)', opacity: 0.64 },
          },
          input: { paddingInline: 16 },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: 'var(--mui-palette-text-secondary)',
            fontWeight: 500,
            '&.Mui-focused': { color: 'var(--mui-palette-primary-main)' },
            '&.Mui-error': { color: 'var(--mui-palette-error-main)' },
          },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: {
            fontSize: '0.75rem',
            lineHeight: 1.4,
            marginInline: 12,
            marginTop: 6,
          },
        },
      },
      MuiFormControl: { defaultProps: { variant: 'filled' } },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: {
            borderRadius: beverageTokens.shape.full,
            minHeight: 40,
            paddingInline: 24,
            transition: 'background-color 160ms ease, box-shadow 160ms ease, color 160ms ease',
            '&:active': { backgroundImage: `linear-gradient(${primaryPressedLayer}, ${primaryPressedLayer})` },
            '&:focus-visible': { boxShadow: primaryFocusRing, outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: 2 },
          },
          contained: {
            boxShadow: 'none',
            '&:hover': { boxShadow: 'none' },
          },
          outlined: {
            borderColor: 'var(--mui-palette-divider)',
            '&:hover': { backgroundColor: primaryHoverLayer, borderColor: 'var(--mui-palette-primary-main)' },
          },
          text: {
            '&:hover': { backgroundColor: primaryHoverLayer },
          },
        },
      },
      MuiPaper: { styleOverrides: { rounded: { borderRadius: beverageTokens.shape.large } } },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: beverageTokens.shape.full,
            minHeight: 40,
            minWidth: 40,
            transition: 'background-color 160ms ease, box-shadow 160ms ease',
            '&:active': { backgroundColor: primaryPressedLayer },
            '&:hover': { backgroundColor: primaryHoverLayer },
            '&:focus-visible': { boxShadow: primaryFocusRing, outline: '2px solid var(--mui-palette-primary-main)', outlineOffset: 2 },
          },
        },
      },
      MuiTooltip: {
        defaultProps: { arrow: true, enterDelay: 500 },
        styleOverrides: {
          tooltip: {
            backgroundColor: 'var(--mui-palette-text-primary)',
            borderRadius: beverageTokens.shape.small,
            color: 'var(--mui-palette-background-paper)',
            fontSize: '0.75rem',
            padding: '8px 12px',
          },
          arrow: { color: 'var(--mui-palette-text-primary)' },
        },
      },
      MuiPopover: {
        styleOverrides: {
          paper: {
            border: '1px solid var(--mui-palette-divider)',
            borderRadius: beverageTokens.shape.large,
            boxShadow: '0 8px 28px color-mix(in srgb, var(--mui-palette-text-primary) 14%, transparent)',
          },
        },
      },
      MuiSnackbar: {
        defaultProps: { anchorOrigin: { horizontal: 'center', vertical: 'bottom' } },
        styleOverrides: {
          root: {
            maxWidth: 560,
            width: 'calc(100% - 32px)',
            '& .MuiAlert-root': {
              borderRadius: beverageTokens.shape.medium,
              minHeight: 52,
              width: '100%',
            },
          },
        },
      },
      MuiChip: {
        defaultProps: { size: 'medium' },
        styleOverrides: {
          root: { borderRadius: beverageTokens.shape.full, fontWeight: 600, height: 32 },
          outlined: { borderColor: 'var(--mui-palette-divider)' },
        },
      },
      MuiSelect: {
        defaultProps: { variant: 'filled' },
        styleOverrides: {
          select: { alignItems: 'center', display: 'flex', minHeight: 24 },
          icon: { color: 'var(--mui-palette-text-secondary)', right: 12 },
        },
      },
      MuiTextField: { defaultProps: { fullWidth: true, variant: 'filled' } },
    },
  });
}
