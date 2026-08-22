import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, type FieldErrors } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

function Harness({ errors, repeat = false }: { errors: FieldErrors<Values>; repeat?: boolean }) {
  const { register, setFocus } = useForm<Values>();
  const handleInvalid = useFormErrorToast({ fields, setFocus });

  return (
    <>
      <input aria-label="第一项" {...register('first')} />
      <input aria-label="第二项" {...register('second')} />
      <input aria-label="第三项" {...register('third')} />
      <button onClick={() => { handleInvalid(errors); if (repeat) handleInvalid(errors); }} type="button">提交</button>
    </>
  );
}

describe('useFormErrorToast', () => {
  beforeEach(() => showToast.mockClear());

  it('counts ordered invalid fields and focuses the first one in form order', async () => {
    const user = userEvent.setup();
    render(<Harness errors={{ second: { type: 'required' }, third: { type: 'required' } }} />);

    await user.click(screen.getByRole('button', { name: '提交' }));

    expect(showToast).toHaveBeenCalledWith({ message: '请完成 2 个必填项。', severity: 'error' });
    expect(screen.getByLabelText('第二项')).toHaveFocus();
  });

  it('does not enqueue the same invalid submission more than once', async () => {
    const user = userEvent.setup();
    const errors: FieldErrors<Values> = { first: { type: 'required' } };
    render(<Harness errors={errors} repeat />);

    await user.click(screen.getByRole('button', { name: '提交' }));

    expect(showToast).toHaveBeenCalledTimes(1);
  });
});
