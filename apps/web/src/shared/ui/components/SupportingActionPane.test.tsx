import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SupportingActionPane, supportingActionPaneLayout } from './SupportingActionPane';

describe('SupportingActionPane', () => {
  it('exposes supporting content as a named complementary landmark', () => {
    render(
      <SupportingActionPane action={<button type="button">继续</button>} title="下一步">
        <p>保存周期后配置运营模板。</p>
      </SupportingActionPane>,
    );

    const pane = screen.getByRole('complementary', { name: '下一步' });
    expect(within(pane).getByRole('heading', { level: 2, name: '下一步' })).toBeVisible();
    expect(within(pane).getByText('保存周期后配置运营模板。')).toBeVisible();
    expect(within(pane).getByRole('button', { name: '继续' })).toBeVisible();
  });

  it('uses a tonal full-row pane before becoming a fixed-width expanded-side pane', () => {
    expect(supportingActionPaneLayout.backgroundColor).toBe('var(--beverage-surface-container)');
    expect(supportingActionPaneLayout.gridColumn).toEqual({ xs: '1 / -1', lg: 'auto' });
    expect(supportingActionPaneLayout.width).toEqual({ xs: '100%', lg: 292 });
    expect(supportingActionPaneLayout.justifySelf).toEqual({ xs: 'stretch', lg: 'end' });
  });
});
