import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { StartupStepper, type StartupStep, type StartupSteps } from './StartupStepper';

const steps: StartupSteps = [
  { title: '建立实训周期', status: 'complete' },
  { title: '配置运营模板', status: 'current' },
  { title: '组织实训人员', status: 'blocked' },
];

describe('StartupStepper', () => {
  it('exposes the current step and keeps blocked explanations available to assistive technology without adding visual noise', () => {
    render(<StartupStepper onSelect={vi.fn()} selected={1} steps={steps} />);

    const list = screen.getByRole('list', { name: '启动配置流程' });
    expect(within(list).getByText('配置运营模板').closest('li')).toHaveAttribute('aria-current', 'step');
    expect(within(list).getByLabelText('建立实训周期，已完成')).toBeVisible();
    expect(within(list).getByRole('button', { name: '组织实训人员' })).toBeDisabled();
    const blockedDescription = within(list).getByText('等待上一步');
    expect(blockedDescription).toHaveStyle({
      borderWidth: '0px',
      height: '1px',
      margin: '-1px',
      overflow: 'hidden',
      padding: '0px',
      position: 'absolute',
      width: '1px',
    });
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

  it('marks the viewed completed step as selected and announces every business state from its button', () => {
    render(<StartupStepper onSelect={vi.fn()} selected={0} steps={steps} />);

    const list = screen.getByRole('list', { name: '启动配置流程' });
    const viewed = within(list).getByRole('button', { name: '建立实训周期' });
    expect(viewed).toHaveAttribute('aria-pressed', 'true');
    expect(viewed.closest('li')).toHaveAttribute('aria-current', 'step');
    expect(viewed).toHaveAccessibleDescription('已完成');
    const currentButton = within(list).getByRole('button', { name: '配置运营模板' });
    expect(currentButton).toHaveAccessibleDescription('待配置');
    const currentStatus = document.getElementById(currentButton.getAttribute('aria-describedby') ?? '');
    expect(currentStatus).toHaveStyle({
      borderWidth: '0px',
      height: '1px',
      margin: '-1px',
      overflow: 'hidden',
      padding: '0px',
      position: 'absolute',
      width: '1px',
    });
    expect(within(list).getByRole('button', { name: '配置运营模板' })).toHaveAttribute('aria-pressed', 'false');
    expect(within(list).getByRole('button', { name: '组织实训人员' })).toHaveAccessibleDescription('等待上一步');
    expect(within(list).queryByText('当前步骤')).not.toBeInTheDocument();
  });

  it('defines the startup workflow as exactly three steps', () => {
    const contract: readonly [StartupStep, StartupStep, StartupStep] = steps;
    expect(contract).toHaveLength(3);
  });
});
