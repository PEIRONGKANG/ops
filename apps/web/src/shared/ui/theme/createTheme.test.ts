import { describe, expect, it } from 'vitest';

import { createBeverageTheme } from './createTheme';
import { beverageTokens } from './tokens';

describe('createBeverageTheme', () => {
  it('uses the beverage brand primary and expressive display hierarchy', () => {
    const theme = createBeverageTheme();

    expect(theme.palette.primary.main).toBe('#176B5B');
    expect(theme.typography.h1.fontWeight).toBe(700);
  });

  it('provides filled fields and discoverable tooltip affordances', () => {
    const theme = createBeverageTheme();

    expect(theme.components?.MuiFilledInput?.styleOverrides?.root).toBeDefined();
    expect(theme.components?.MuiTooltip?.defaultProps).toMatchObject({ arrow: true });
  });

  it('uses the primary theme color for accessible focus styles', () => {
    const theme = createBeverageTheme();
    const buttonRoot = theme.components?.MuiButton?.styleOverrides?.root as Record<string, unknown>;
    const focusVisible = buttonRoot['&:focus-visible'];

    expect(focusVisible).toMatchObject({
      outline: expect.stringContaining('var(--mui-palette-primary-main)'),
      outlineOffset: 2,
    });
    expect(JSON.stringify(focusVisible)).not.toContain('#0B5FFF');
  });

  it('preserves palette colors for semantic filled chips', () => {
    const theme = createBeverageTheme();

    expect(theme.components?.MuiChip?.styleOverrides).not.toHaveProperty('filled.backgroundColor');
  });

  it('keeps select controls and their form-control context on the filled variant', () => {
    const theme = createBeverageTheme();

    expect(theme.components?.MuiFormControl?.defaultProps?.variant).toBe('filled');
    expect(theme.components?.MuiSelect?.defaultProps?.variant).toBe('filled');
  });

  it('styles the alert rendered inside the snackbar root', () => {
    const theme = createBeverageTheme();
    const snackbarRoot = JSON.stringify(theme.components?.MuiSnackbar?.styleOverrides?.root);

    expect(snackbarRoot).toContain('.MuiAlert-root');
    expect(snackbarRoot).not.toContain('.MuiSnackbarContent-root');
  });

  it('exposes the semantic state, layout, and shape scales', () => {
    expect(beverageTokens.state).toEqual({ hoverOpacity: 0.08, focusOpacity: 0.12, pressedOpacity: 0.12 });
    expect(beverageTokens.layout).toEqual({ compact: 840, expanded: 1200, contentMax: 1200, topBarHeight: 64 });
    expect(beverageTokens.shape).toEqual({ small: 12, medium: 16, large: 24, full: 999 });
  });

  it('keeps every viewport below 840px on the compact single-column breakpoint', () => {
    const theme = createBeverageTheme();

    expect(theme.breakpoints.values).toEqual({ xs: 0, sm: 840, md: 1024, lg: 1200, xl: 1536 });
    expect(theme.breakpoints.up('sm')).toBe('@media (min-width:840px)');
    expect(theme.breakpoints.up('lg')).toBe('@media (min-width:1200px)');
  });
});
