import { Button } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './ToastProvider';

function ToastProbe({ onRetry }: { onRetry: () => void }) {
  const { showToast } = useToast();

  return <Button onClick={() => showToast({ action: { label: '重试', onClick: onRetry }, message: '无法同步启动状态。', severity: 'warning' })}>触发提示</Button>;
}

describe('ToastProvider', () => {
  it('shows a unified status toast and runs its optional action', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<ToastProvider><ToastProbe onRetry={onRetry} /></ToastProvider>);

    await user.click(screen.getByRole('button', { name: '触发提示' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('无法同步启动状态。');
    await user.click(screen.getByRole('button', { name: '重试' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
