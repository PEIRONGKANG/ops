import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the application bootstrap state', () => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>(() => undefined)));
    render(<App />);

    expect(screen.getByLabelText('正在初始化会话')).toBeInTheDocument();
  });

  afterEach(() => vi.unstubAllGlobals());
});
