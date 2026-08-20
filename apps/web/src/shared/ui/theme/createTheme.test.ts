import { describe, expect, it } from 'vitest';

import { createBeverageTheme } from './createTheme';

describe('createBeverageTheme', () => {
  it('uses the beverage brand primary and accessible focus styles', () => {
    const theme = createBeverageTheme();

    expect(theme.palette.primary.main).toBe('#176B5B');
    expect(theme.components?.MuiButton?.styleOverrides?.root).toBeDefined();
  });
});
