export const beverageTokens = {
  color: {
    primary: '#176B5B',
    primaryContainer: '#BCEEDB',
    secondary: '#4D635C',
    surface: '#FBFBF7',
    surfaceContainer: '#F3F5F0',
    surfaceContainerHigh: '#E9ECE7',
    onSurface: '#1A1C1A',
    outline: '#707A73',
    warning: '#9A5900',
    warningContainer: '#FFDCB3',
    danger: '#A63C3C',
    dangerContainer: '#FFDAD7',
    success: '#176B5B',
  },
  shape: {
    small: 12,
    medium: 16,
    large: 24,
    full: 999,
  },
  state: {
    hoverOpacity: 0.08,
    focusOpacity: 0.12,
    pressedOpacity: 0.12,
  },
  layout: {
    compact: 840,
    expanded: 1200,
    contentMax: 1200,
    topBarHeight: 64,
  },
  motion: {
    short: 160,
    medium: 200,
  },
} as const;
