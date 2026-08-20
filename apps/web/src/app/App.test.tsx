import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('renders the application bootstrap state', () => {
    render(<App />);

    expect(screen.getByLabelText('正在初始化会话')).toBeInTheDocument();
  });
});
