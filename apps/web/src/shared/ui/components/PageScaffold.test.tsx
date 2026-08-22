import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { beverageTokens } from '../theme/tokens';
import { PageScaffold, pageScaffoldLayout } from './PageScaffold';

describe('PageScaffold', () => {
  it('labels the page heading and content region', () => {
    render(
      <PageScaffold
        actions={<button type="button">新建周期</button>}
        description="管理当前实训周期。"
        eyebrow="运营治理"
        title="实训周期"
      >
        <p>周期列表</p>
      </PageScaffold>,
    );

    expect(screen.getByRole('heading', { level: 1, name: '实训周期' })).toBeVisible();
    expect(screen.getByText('运营治理')).toBeVisible();
    expect(screen.getByText('管理当前实训周期。')).toBeVisible();
    expect(screen.getByRole('button', { name: '新建周期' })).toBeVisible();

    const content = screen.getByRole('region', { name: '实训周期内容' });
    expect(within(content).getByText('周期列表')).toBeVisible();
  });

  it('uses the shared 1200px content boundary and stacks its header only on compact screens', () => {
    expect(beverageTokens.layout.contentMax).toBe(1200);
    expect(pageScaffoldLayout.maxWidth).toBe('var(--beverage-layout-content-max)');
    expect(pageScaffoldLayout.headerDirection).toEqual({ xs: 'column', sm: 'row' });
    expect(pageScaffoldLayout.headerAlignment).toEqual({ xs: 'stretch', sm: 'flex-end' });
  });
});
