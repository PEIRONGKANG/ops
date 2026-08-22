import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { AppShell } from './AppShell';

describe('AppShell', () => {
  it('renders a named single-line application bar with the role and notification trigger', async () => {
    const user = userEvent.setup();

    render(
      <AppShell headerContent={<span>运营治理</span>} notificationContent={<p>请完成启动配置</p>} notificationCount={2}>
        <p>工作内容</p>
      </AppShell>,
    );

    const banner = screen.getByRole('banner', { name: '应用栏' });
    expect(within(banner).getByText('运营治理')).toBeVisible();
    expect(within(banner).getByRole('button', { name: '通知' })).toBeVisible();

    await user.click(within(banner).getByRole('button', { name: '通知' }));

    expect(await screen.findByRole('dialog', { name: '系统通知' })).toHaveTextContent('请完成启动配置');
  });

  it('does not invent navigation when none is supplied', () => {
    render(<AppShell><p>工作内容</p></AppShell>);

    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('工作内容');
  });
});
