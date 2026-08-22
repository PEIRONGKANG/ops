import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthScaffold } from './AuthScaffold';

describe('AuthScaffold', () => {
  it('provides one named main area and keeps the responsive system introduction in the DOM', () => {
    render(
      <AuthScaffold description="使用受分配的账号继续。" title="登录">
        <form aria-label="登录表单" />
      </AuthScaffold>,
    );

    const main = screen.getByRole('main', { name: '登录' });
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(within(main).getByRole('heading', { level: 1, name: '登录' })).toBeVisible();
    expect(within(main).getByText('使用受分配的账号继续。')).toBeVisible();
    expect(within(main).getByRole('form', { name: '登录表单' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: '系统简介', hidden: true })).toBeInTheDocument();
    expect(screen.queryByText(/BEVERAGE OPS/i)).not.toBeInTheDocument();
  });
});
