import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MaterialDateField } from './MaterialDateField';

describe('MaterialDateField', () => {
  it('renders a Material calendar entry point while preserving a labelled date field', () => {
    render(<MaterialDateField label="开始日期" onChange={vi.fn()} required value="2026-09-01" />);

    expect(screen.getByRole('group', { name: '开始日期' })).toBeVisible();
    expect(screen.getByRole('button', { name: /选择日期/ })).toBeVisible();
  });
});
