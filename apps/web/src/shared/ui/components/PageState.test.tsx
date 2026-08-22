import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageState } from './PageState';

describe('PageState', () => {
  it.each([
    ['loading', '正在加载'],
    ['empty', '暂时没有内容'],
    ['error', '暂时无法加载'],
    ['forbidden', '没有访问权限'],
    ['offline', '当前处于离线状态'],
  ] as const)('renders %s as a consistently named region', (kind, title) => {
    render(<PageState kind={kind} />);

    const region = screen.getByRole('region', { name: title });
    expect(region).toContainElement(screen.getByRole('heading', { name: title }));
    expect(region).not.toHaveAttribute('aria-live');
  });

  it.each(['loading', 'empty', 'error', 'forbidden', 'offline'] as const)('uses a decorative tonal icon container for %s', (kind) => {
    render(<PageState kind={kind} />);

    const iconContainer = screen.getByTestId('page-state-icon');
    expect(iconContainer).toHaveAttribute('aria-hidden', 'true');
    expect(iconContainer).toHaveStyle({ backgroundColor: 'var(--beverage-surface-container-high)' });
    expect(iconContainer.querySelector('svg, [role="progressbar"]')).toBeInTheDocument();
  });

  it('renders a retry action for recoverable errors', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<PageState kind="error" onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: '重试' }));

    expect(onRetry).toHaveBeenCalledOnce();
  });
});
