import { act, fireEvent, render, screen } from '@testing-library/react';
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

    act(() => inputRef.current?.focus());
    expect(screen.getByRole('spinbutton', { name: '年份' })).toHaveFocus();
  });

  it('links an invalid date field to a visually hidden error description', () => {
    render(<MaterialDateField error helperText="开始日期为必填项。" label="开始日期" onChange={vi.fn()} value="" />);

    const field = screen.getByRole('group', { name: '开始日期' });
    const descriptionId = field.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    const description = document.getElementById(descriptionId ?? '');
    expect(description).toHaveTextContent('开始日期为必填项。');
    expect(description).toHaveStyle({ height: '1px', overflow: 'hidden', position: 'absolute', width: '1px' });
  });
});
