import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PageState } from './PageState';

describe('PageState', () => {
  it.each([
    ['loading', '正在加载', 'polite'],
    ['empty', '暂时没有内容', 'polite'],
    ['error', '暂时无法加载', 'assertive'],
    ['forbidden', '没有访问权限', 'polite'],
    ['offline', '当前处于离线状态', 'assertive'],
  ] as const)('renders %s as one named live region', (kind, title, politeness) => {
    render(<PageState kind={kind} />);

    const region = screen.getByRole('region', { name: title });
    expect(region).toContainElement(screen.getByRole('heading', { name: title }));
    expect(region).toHaveAttribute('aria-live', politeness);
    expect(region).toHaveAttribute('aria-atomic', 'true');
    expect(region.querySelectorAll('[aria-live], [role="alert"], [role="status"]')).toHaveLength(0);
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
