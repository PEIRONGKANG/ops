import { fireEvent, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { MaterialDateField } from './MaterialDateField';

describe('MaterialDateField', () => {
  it('renders a Material calendar entry point while preserving a labelled date field', () => {
    render(<MaterialDateField label="开始日期" onChange={vi.fn()} required value="2026-09-01" />);

    expect(screen.getByRole('group', { name: '开始日期' })).toBeVisible();
    expect(screen.getByRole('button', { name: /选择日期/ })).toBeVisible();
  });

  it('forwards form field wiring to the filled date input', () => {
    const inputRef = createRef<HTMLInputElement>();
    const onBlur = vi.fn();
    const { container } = render(<MaterialDateField inputRef={inputRef} label="开始日期" name="termStartDate" onBlur={onBlur} onChange={vi.fn()} value="" />);

    const input = container.querySelector<HTMLInputElement>('input[name="termStartDate"]');
    expect(input).not.toBeNull();
    if (!input) throw new Error('Date input was not rendered.');
    expect(input).toHaveAttribute('name', 'termStartDate');
    expect(inputRef.current).toBe(input);
    expect(input.closest('.MuiPickersFilledInput-root')).toBeInTheDocument();

    fireEvent.blur(screen.getByRole('spinbutton', { name: '年份' }));
    expect(onBlur).toHaveBeenCalledOnce();
  });
});
