import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { StatusChip } from './StatusChip';

describe('StatusChip', () => {
  it.each([
    ['success', '已发布'],
    ['warning', '待确认'],
    ['danger', '已阻断'],
  ] as const)('combines a visible label with a decorative icon for %s states', (tone, label) => {
    render(<StatusChip label={label} tone={tone} />);

    const chip = screen.getByText(label).closest('.MuiChip-root');
    const icon = chip?.querySelector('.MuiChip-icon');

    expect(chip).toBeInTheDocument();
    expect(screen.getByText(label)).toBeVisible();
    expect(icon).toBeInTheDocument();
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('keeps neutral status concise without implying a semantic outcome icon', () => {
    render(<StatusChip label="草稿" />);

    const chip = screen.getByText('草稿').closest('.MuiChip-root');
    expect(chip?.querySelector('.MuiChip-icon')).not.toBeInTheDocument();
  });
});
