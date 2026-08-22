import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, type FieldErrors } from 'react-hook-form';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFormErrorToast } from './useFormErrorToast';

const showToast = vi.fn();

vi.mock('@/shared/ui/feedback/ToastProvider', () => ({
  useToast: () => ({ showToast }),
}));

interface Values {
  first: string;
  second: string;
  third: string;
}

const fields = [
  { label: '第一项', name: 'first' },
  { label: '第二项', name: 'second' },
  { label: '第三项', name: 'third' },
] as const;

function Harness({ errors }: { errors: FieldErrors<Values> }) {
  const { register, setFocus } = useForm<Values>();
  const handleInvalid = useFormErrorToast({ fields, setFocus });

  return (
    <>
      <input aria-label="第一项" {...register('first')} />
      <input aria-label="第二项" {...register('second')} />
      <input aria-label="第三项" {...register('third')} />
      <button onClick={() => handleInvalid(errors)} type="button">提交</button>
    </>
  );
}

describe('useFormErrorToast', () => {
  beforeEach(() => showToast.mockClear());

  it('counts ordered invalid fields and focuses the first one in form order', async () => {
    const user = userEvent.setup();
    render(<Harness errors={{ second: { type: 'required' }, third: { type: 'required' } }} />);

    await user.click(screen.getByRole('button', { name: '提交' }));

    expect(showToast).toHaveBeenCalledWith({ message: '请完成 2 个必填项：第二项、第三项。', severity: 'error' });
    expect(screen.getByLabelText('第二项')).toHaveFocus();
  });

  it('deduplicates matching invalid submissions during a short cooldown and allows a later retry', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-23T00:00:00Z'));
    const errors: FieldErrors<Values> = { first: { type: 'required' } };
    render(<Harness errors={errors} />);

    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    await act(async () => { await Promise.resolve(); });
    vi.advanceTimersByTime(500);
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(showToast).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(501);
    fireEvent.click(screen.getByRole('button', { name: '提交' }));
    expect(showToast).toHaveBeenCalledTimes(2);
  });

  afterEach(() => vi.useRealTimers());
});

interface NestedValues {
  items: Array<{ name: string }>;
  profile: { displayName: string };
}

function NestedHarness({ errors }: { errors: FieldErrors<NestedValues> }) {
  const { register, setFocus } = useForm<NestedValues>();
  const handleInvalid = useFormErrorToast({
    fields: [
      { label: '首项名称', name: 'items.0.name' },
      { label: '显示名称', name: 'profile.displayName' },
    ],
    setFocus,
  });

  return (
    <>
      <input aria-label="首项名称" {...register('items.0.name')} />
      <input aria-label="显示名称" {...register('profile.displayName')} />
      <button onClick={() => handleInvalid(errors)} type="button">提交嵌套表单</button>
    </>
  );
}

describe('useFormErrorToast nested paths', () => {
  beforeEach(() => showToast.mockClear());

  it('resolves dotted and array field paths from nested form errors', async () => {
    const user = userEvent.setup();
    render(<NestedHarness errors={{ items: [{ name: { type: 'required' } }] }} />);

    await user.click(screen.getByRole('button', { name: '提交嵌套表单' }));

    expect(showToast).toHaveBeenCalledWith({ message: '请完成 1 个必填项：首项名称。', severity: 'error' });
    expect(screen.getByLabelText('首项名称')).toHaveFocus();
  });
});
