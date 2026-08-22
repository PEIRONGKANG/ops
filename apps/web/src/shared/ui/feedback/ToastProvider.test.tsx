import { Button } from '@mui/material';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './ToastProvider';

function ToastProbe({ onRetry }: { onRetry: () => void }) {
  const { showToast } = useToast();

  return (
    <>
      <Button onClick={() => showToast({ message: '已保存。', severity: 'success' })}>成功提示</Button>
      <Button onClick={() => showToast({ message: '正在同步。', severity: 'info' })}>信息提示</Button>
      <Button onClick={() => showToast({ action: { label: '重试', onClick: onRetry }, message: '无法同步启动状态。', severity: 'warning' })}>警告提示</Button>
      <Button onClick={() => showToast({ message: '发布失败。', severity: 'error' })}>错误提示</Button>
    </>
  );
}

describe('ToastProvider', () => {
  it.each([
    ['成功提示', '已保存。'],
    ['信息提示', '正在同步。'],
  ] as const)('announces %s without interrupting the user', async (trigger, message) => {
    const user = userEvent.setup();

    render(<ToastProvider><ToastProbe onRetry={vi.fn()} /></ToastProvider>);
    await user.click(screen.getByRole('button', { name: trigger }));

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(message);
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-atomic', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it.each([
    ['警告提示', '无法同步启动状态。'],
    ['错误提示', '发布失败。'],
  ] as const)('announces %s assertively', async (trigger, message) => {
    const user = userEvent.setup();

    render(<ToastProvider><ToastProbe onRetry={vi.fn()} /></ToastProvider>);
    await user.click(screen.getByRole('button', { name: trigger }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveAttribute('aria-atomic', 'true');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps messages queued and ignores clickaway dismissal', async () => {
    const user = userEvent.setup();

    render(<ToastProvider><ToastProbe onRetry={vi.fn()} /></ToastProvider>);
    await user.click(screen.getByRole('button', { name: '信息提示' }));
    await user.click(screen.getByRole('button', { name: '错误提示' }));

    expect(await screen.findByRole('status')).toHaveTextContent('正在同步。');
    fireEvent.mouseDown(document.body);
    fireEvent.mouseUp(document.body);
    fireEvent.click(document.body);
    expect(screen.getByRole('status')).toHaveTextContent('正在同步。');

    await user.click(screen.getByRole('button', { name: '关闭' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('发布失败。');
  });

  it('runs its optional action from the keyboard', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<ToastProvider><ToastProbe onRetry={onRetry} /></ToastProvider>);

    await user.click(screen.getByRole('button', { name: '警告提示' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('无法同步启动状态。');
    const retry = screen.getByRole('button', { name: '重试' });
    act(() => retry.focus());
    await user.keyboard('{Enter}');
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByText('无法同步启动状态。')).not.toBeInTheDocument();
  });
});
