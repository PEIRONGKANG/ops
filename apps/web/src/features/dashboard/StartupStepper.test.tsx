import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StartupStepper, type StartupStep } from './StartupStepper';

const steps: StartupStep[] = [
  { title: '建立实训周期', status: 'complete' },
  { title: '配置运营模板', status: 'current' },
  { title: '组织实训人员', status: 'blocked' },
];

describe('StartupStepper', () => {
  it('exposes the current step, completed state and blocked explanation', () => {
    render(<StartupStepper onSelect={vi.fn()} selected={1} steps={steps} />);

    const list = screen.getByRole('list', { name: '启动配置流程' });
    expect(within(list).getByText('配置运营模板').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(within(list).getByLabelText('建立实训周期，已完成')).toBeVisible();
    expect(within(list).getByRole('button', { name: '组织实训人员' })).toBeDisabled();
    expect(within(list).getByText('等待上一步')).toBeVisible();
    expect(within(list).queryByText('当前步骤')).not.toBeInTheDocument();
  });

  it('allows completed steps to be selected while blocked steps stay unavailable', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<StartupStepper onSelect={onSelect} selected={1} steps={steps} />);

    await user.click(screen.getByRole('button', { name: '建立实训周期' }));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(screen.getByRole('button', { name: '组织实训人员' })).toBeDisabled();
  });
});
