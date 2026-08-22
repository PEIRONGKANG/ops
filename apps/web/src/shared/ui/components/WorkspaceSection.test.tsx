import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WorkspaceSection } from './WorkspaceSection';

describe('WorkspaceSection', () => {
  it('associates the section landmark with its level-two heading', () => {
    render(
      <WorkspaceSection description="设置周期代码和日期范围。" id="period-timing" title="周期与时间">
        <label>
          周期代码
          <input />
        </label>
      </WorkspaceSection>,
    );

    const section = screen.getByRole('region', { name: '周期与时间' });
    const heading = within(section).getByRole('heading', { level: 2, name: '周期与时间' });

    expect(section).toHaveAttribute('aria-labelledby', heading.id);
    expect(within(section).getByText('设置周期代码和日期范围。')).toBeVisible();
    expect(within(section).getByLabelText('周期代码')).toBeVisible();
  });
});
