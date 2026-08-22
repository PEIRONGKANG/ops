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

    expect(theme.components?.MuiButton?.styleOverrides?.root).toBeDefined();
    expect(JSON.stringify(theme.components?.MuiButton?.styleOverrides?.root)).not.toContain('#0B5FFF');
  });

  it('exposes the semantic state, layout, and shape scales', () => {
    expect(beverageTokens.state).toEqual({ hoverOpacity: 0.08, focusOpacity: 0.12, pressedOpacity: 0.12 });
    expect(beverageTokens.layout).toEqual({ compact: 840, expanded: 1200, contentMax: 1200, topBarHeight: 64 });
    expect(beverageTokens.shape).toEqual({ small: 12, medium: 16, large: 24, full: 999 });
  });
});
