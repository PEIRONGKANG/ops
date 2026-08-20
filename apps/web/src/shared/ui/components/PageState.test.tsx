import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageState } from './PageState';

describe('PageState', () => {
  it('renders a retry action for recoverable errors', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<PageState kind="error" onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: '重试' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
