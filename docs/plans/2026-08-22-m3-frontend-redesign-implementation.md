# Material 3 Frontend Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild every currently implemented React screen and shared UI component as one restrained Material 3 Expressive workspace without changing backend contracts or business behavior.

**Architecture:** Extend the existing MUI theme into a semantic token layer, then introduce shared scaffolds for authentication, pages, workspace sections, steps, and supporting actions. Migrate pages from the outside in: theme and primitives first, authentication second, application shell and startup flow third, then governance forms and people lists. Keep all API calls in the existing providers and `GovernanceApi`; this plan is a presentation and interaction refactor only.

**Tech Stack:** React 19, TypeScript, Vite, MUI 7, MUI X Date Pickers, React Hook Form, Vitest, Testing Library, Docker Compose

---

## Constraints

- Work only in `apps/web` and `docs`; do not modify Spring endpoints, persistence, or seed data.
- Do not introduce legacy data compatibility, mock success responses, or a second component library.
- Use `apply_patch` for source changes.
- Preserve every existing real-interface workflow: login, password change, startup state load, period draft, template draft, people organization, return-to-edit, and final publication.
- Keep the page free of global vertical scrolling at 1920×1080 for period and template steps; long people collections may scroll inside their own pane.
- Every production change starts with a failing behavior or theme-contract test.

### Task 1: Expand the semantic Material 3 theme

**Files:**

- Modify: `apps/web/src/shared/ui/theme/tokens.ts`
- Modify: `apps/web/src/shared/ui/theme/createTheme.ts`
- Modify: `apps/web/src/shared/ui/theme/createTheme.test.ts`

**Step 1: Write the failing token and component-style test**

Add assertions that the theme exposes semantic CSS variables and component contracts:

```tsx
it('provides restrained M3 surface, field, and state-layer contracts', () => {
  const theme = createBeverageTheme();

  expect(theme.components?.MuiFilledInput?.styleOverrides?.root).toBeDefined();
  expect(theme.components?.MuiTooltip?.defaultProps).toMatchObject({ arrow: true });
  expect(theme.typography.h1).toMatchObject({ fontWeight: 700 });
});
```

**Step 2: Run the test to verify RED**

Run:

```bash
cd apps/web
npm test -- --run src/shared/ui/theme/createTheme.test.ts
```

Expected: FAIL because filled inputs and tooltip defaults are not configured.

**Step 3: Implement the semantic token layer**

Add tokens for:

```ts
state: {
  hoverOpacity: 0.08,
  focusOpacity: 0.12,
  pressedOpacity: 0.12,
},
layout: {
  compact: 840,
  expanded: 1200,
  contentMax: 1200,
  topBarHeight: 64,
},
shape: {
  small: 12,
  medium: 16,
  large: 24,
  full: 999,
},
```

Configure `MuiFilledInput`, `MuiInputLabel`, `MuiFormHelperText`, `MuiButton`, `MuiIconButton`, `MuiTooltip`, `MuiPopover`, `MuiSnackbar`, `MuiChip`, `MuiSelect`, and `MuiCssBaseline`. Use theme values or CSS variables; remove hard-coded focus blue and replace it with the primary color plus an outer focus ring.

**Step 4: Verify GREEN**

Run the targeted test, lint, and build:

```bash
npm test -- --run src/shared/ui/theme/createTheme.test.ts
npm run lint
npm run build
```

Expected: PASS; Vite may still print the existing chunk-size warning.

**Step 5: Commit**

```bash
git add apps/web/src/shared/ui/theme
git commit -m "refactor(web): establish m3 design tokens"
```

### Task 2: Add shared scaffolds and workspace primitives

**Files:**

- Create: `apps/web/src/shared/ui/components/PageScaffold.tsx`
- Create: `apps/web/src/shared/ui/components/PageScaffold.test.tsx`
- Create: `apps/web/src/shared/ui/components/AuthScaffold.tsx`
- Create: `apps/web/src/shared/ui/components/AuthScaffold.test.tsx`
- Create: `apps/web/src/shared/ui/components/WorkspaceSection.tsx`
- Create: `apps/web/src/shared/ui/components/WorkspaceSection.test.tsx`
- Create: `apps/web/src/shared/ui/components/SupportingActionPane.tsx`
- Create: `apps/web/src/shared/ui/components/SupportingActionPane.test.tsx`

**Step 1: Write failing semantic-layout tests**

Test the public contracts rather than generated class names:

```tsx
render(<PageScaffold title="实训周期" actions={<button>保存</button>}><p>正文</p></PageScaffold>);
expect(screen.getByRole('heading', { level: 1, name: '实训周期' })).toBeVisible();
expect(screen.getByRole('region', { name: '实训周期内容' })).toContainElement(screen.getByText('正文'));

render(<SupportingActionPane action={<button>下一步</button>} title="完成基础配置" />);
expect(screen.getByRole('complementary', { name: '完成基础配置' })).toBeVisible();
```

`AuthScaffold` must expose one `main` landmark, a brand-context region on expanded screens, and a form-content region. `WorkspaceSection` must connect `aria-labelledby` to its heading.

**Step 2: Run the tests to verify RED**

```bash
npm test -- --run src/shared/ui/components/PageScaffold.test.tsx src/shared/ui/components/AuthScaffold.test.tsx src/shared/ui/components/WorkspaceSection.test.tsx src/shared/ui/components/SupportingActionPane.test.tsx
```

Expected: FAIL because the modules do not exist.

**Step 3: Implement minimal semantic components**

Use these APIs:

```ts
interface PageScaffoldProps extends PropsWithChildren {
  actions?: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  title: string;
}

interface WorkspaceSectionProps extends PropsWithChildren {
  description?: string;
  id: string;
  title: string;
}

interface SupportingActionPaneProps extends PropsWithChildren {
  action?: ReactNode;
  title: string;
}
```

`PageScaffold` caps content at 1200px. `SupportingActionPane` is a right column at expanded widths and becomes a bottom row below 1200px. None of these primitives owns business state.

**Step 4: Verify GREEN and regressions**

```bash
npm test -- --run src/shared/ui/components
npm run lint
npm run build
```

Expected: all shared component tests pass.

**Step 5: Commit**

```bash
git add apps/web/src/shared/ui/components
git commit -m "feat(web): add m3 workspace scaffolds"
```

### Task 3: Redesign authentication screens

**Files:**

- Modify: `apps/web/src/features/auth/LoginPage.tsx`
- Modify: `apps/web/src/features/auth/ChangePasswordPage.tsx`
- Modify: `apps/web/src/app/App.test.tsx`
- Use: `apps/web/src/shared/ui/components/AuthScaffold.tsx`

**Step 1: Write failing authentication-layout tests**

Extend `App.test.tsx`:

```tsx
expect(await screen.findByRole('main', { name: '登录' })).toBeVisible();
expect(screen.getByRole('region', { name: '系统简介' })).toBeVisible();
expect(screen.queryByText('BEVERAGE OPS')).not.toBeInTheDocument();
expect(screen.getByRole('button', { name: '登录' })).toBeVisible();
```

Add equivalent assertions for `更新登录密码`. Preserve the existing login error Toast and password-change exchange tests.

**Step 2: Run the test to verify RED**

```bash
npm test -- --run src/app/App.test.tsx
```

Expected: FAIL because the authentication pages do not yet use the shared scaffold.

**Step 3: Implement the new pages**

- Replace bordered `Paper` cards with `AuthScaffold`.
- Use a low-contrast brand-context panel only at expanded widths.
- Change fields to the theme-default filled style.
- Keep the form width between 400px and 460px.
- Keep all existing `useAuth`, React Hook Form, autocomplete, loading, and Toast logic unchanged.
- Do not add remote images or fonts.

**Step 4: Verify GREEN**

```bash
npm test -- --run src/app/App.test.tsx
npm run lint
npm run build
```

Expected: all authentication behavior and layout assertions pass.

**Step 5: Commit**

```bash
git add apps/web/src/features/auth apps/web/src/app/App.test.tsx
git commit -m "refactor(web): redesign authentication screens"
```

### Task 4: Rebuild the application shell and startup navigation

**Files:**

- Modify: `apps/web/src/shared/ui/components/AppShell.tsx`
- Create: `apps/web/src/shared/ui/components/AppShell.test.tsx`
- Create: `apps/web/src/features/dashboard/StartupStepper.tsx`
- Create: `apps/web/src/features/dashboard/StartupStepper.test.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.test.tsx`

**Step 1: Write failing shell and stepper tests**

Required assertions:

```tsx
expect(screen.getByRole('banner')).toHaveAccessibleName('应用栏');
expect(screen.getByRole('button', { name: '通知' })).toBeVisible();
expect(screen.getByRole('list', { name: '启动配置流程' })).toBeVisible();
expect(screen.getByText('建立实训周期').closest('li')).toHaveAttribute('aria-current', 'step');
expect(screen.queryByText('当前步骤')).not.toBeInTheDocument();
```

The dashboard test must assert a complementary region named `完成实训周期` and that the initial arrow control is inside it, not inside the page header.

**Step 2: Run the tests to verify RED**

```bash
npm test -- --run src/shared/ui/components/AppShell.test.tsx src/features/dashboard/StartupStepper.test.tsx src/features/dashboard/DashboardPage.test.tsx
```

Expected: FAIL on missing components and the current floating arrow structure.

**Step 3: Implement shell and stepper**

- Keep the top bar 64px and single-line.
- Move layout width and gutters into `PageScaffold`.
- Extract step rendering from `DashboardPage` into `StartupStepper`.
- Use one subtle surface container, a 2px track, 32px state nodes, primary-container selection, completion icons, and blocked text.
- Preserve click access to completed steps and disabled behavior for blocked steps.
- Keep notifications exclusively in the top bar Popover.

**Step 4: Implement the startup supporting pane**

- Compose the current step as `minmax(0, 2fr) minmax(240px, 1fr)` at expanded widths.
- Put the initial translucent forward icon, its Tooltip, and brief consequence text inside `SupportingActionPane`.
- Place `保存修改`, `保存模板草稿`, and `发布实训配置` in the same semantic pane.
- Collapse actions below the form on compact and medium widths.
- Remove all absolute positioning and raw `rgba(...)` values from `DashboardPage`.

**Step 5: Verify GREEN**

```bash
npm test -- --run src/shared/ui/components/AppShell.test.tsx src/features/dashboard/StartupStepper.test.tsx src/features/dashboard/DashboardPage.test.tsx
npm run lint
npm run build
```

Expected: PASS with all current workflow tests intact.

**Step 6: Commit**

```bash
git add apps/web/src/shared/ui/components/AppShell.tsx apps/web/src/shared/ui/components/AppShell.test.tsx apps/web/src/features/dashboard
git commit -m "refactor(web): rebuild m3 startup workspace"
```

### Task 5: Consolidate forms and validation feedback

**Files:**

- Create: `apps/web/src/shared/ui/forms/useFormErrorToast.ts`
- Create: `apps/web/src/shared/ui/forms/useFormErrorToast.test.tsx`
- Modify: `apps/web/src/features/governance/TermWorkspacePage.tsx`
- Modify: `apps/web/src/features/governance/TermWorkspacePage.test.tsx`
- Modify: `apps/web/src/features/governance/TemplateWorkspacePage.tsx`
- Modify: `apps/web/src/features/governance/TemplateWorkspacePage.test.tsx`
- Modify: `apps/web/src/shared/ui/components/MaterialDateField.tsx`
- Modify: `apps/web/src/shared/ui/components/MaterialDateField.test.tsx`
- Use: `apps/web/src/shared/ui/components/WorkspaceSection.tsx`

**Step 1: Write failing form-error tests**

For the period form, submit empty fields and assert:

```tsx
await user.click(screen.getByRole('button', { name: '创建实训周期' }));
expect(await screen.findByRole('alert')).toHaveTextContent('请完成 9 个必填项');
expect(screen.getByRole('textbox', { name: '周期代码' })).toHaveFocus();
expect(screen.queryByText('请填写此项。')).not.toBeInTheDocument();
```

Add the matching template count assertion. Keep `aria-invalid="true"` on invalid fields so the Toast is not the only machine-readable error signal.

**Step 2: Run tests to verify RED**

```bash
npm test -- --run src/features/governance/TermWorkspacePage.test.tsx src/features/governance/TemplateWorkspacePage.test.tsx src/shared/ui/components/MaterialDateField.test.tsx
```

Expected: FAIL because errors currently render under each field and no summary Toast is produced.

**Step 3: Implement `useFormErrorToast`**

The hook accepts React Hook Form errors, field order, and a field-to-label map. It must:

1. count invalid fields;
2. enqueue one Toast message;
3. focus the first invalid input/group;
4. avoid duplicate Toasts for the same failed submit count.

Use React Hook Form's invalid-submit callback:

```ts
const submit = handleSubmit(save, (errors) => showFormErrors(errors));
```

**Step 4: Replace duplicated form sections**

- Use `WorkspaceSection` in period and template pages.
- Use two equal columns from medium widths upward and one column on compact.
- Use filled fields from the theme; keep field labels and backend values unchanged.
- Keep the first teaching-week name and template effective date span rules only where they improve reading order.
- Remove inline helper sentences for required errors; retain accessible invalid state.

**Step 5: Verify GREEN**

```bash
npm test -- --run src/features/governance/TermWorkspacePage.test.tsx src/features/governance/TemplateWorkspacePage.test.tsx src/shared/ui/forms/useFormErrorToast.test.tsx src/shared/ui/components/MaterialDateField.test.tsx
npm run lint
npm run build
```

Expected: PASS; form submission still calls the same `GovernanceApi` methods.

**Step 6: Commit**

```bash
git add apps/web/src/shared/ui/forms apps/web/src/shared/ui/components/WorkspaceSection.tsx apps/web/src/shared/ui/components/MaterialDateField.tsx apps/web/src/features/governance/TermWorkspacePage.tsx apps/web/src/features/governance/TemplateWorkspacePage.tsx apps/web/src/features/governance/*.test.tsx apps/web/src/shared/ui/components/MaterialDateField.test.tsx
git commit -m "refactor(web): unify m3 governance forms"
```

### Task 6: Redesign people governance as flat operational sections

**Files:**

- Modify: `apps/web/src/features/governance/PeopleWorkspacePage.tsx`
- Modify: `apps/web/src/features/governance/PeopleWorkspacePage.test.tsx`
- Use: `apps/web/src/shared/ui/components/WorkspaceSection.tsx`
- Use: `apps/web/src/shared/ui/components/StatusChip.tsx`

**Step 1: Write failing information-architecture tests**

Assert named regions and flat rows:

```tsx
expect(screen.getByRole('region', { name: '待审批账号' })).toBeVisible();
expect(screen.getByRole('region', { name: '已启用账号' })).toBeVisible();
expect(screen.getByRole('region', { name: '团队与本期成员' })).toBeVisible();
expect(screen.queryAllByTestId('person-card')).toHaveLength(0);
```

Preserve existing tests for approval roles, temporary credentials, team creation, and membership creation.

**Step 2: Run the test to verify RED**

```bash
npm test -- --run src/features/governance/PeopleWorkspacePage.test.tsx
```

Expected: FAIL until the page uses semantic shared sections.

**Step 3: Implement the flat people workspace**

- Put term selection into a compact context toolbar.
- Use stable columns for account, role, approval note, and action at expanded widths.
- Stack the same controls in logical label order on compact screens.
- Use a tonal information panel for the one-time credential.
- Keep team creation and membership addition as separate inline toolbars.
- Give member collections an internal max-height and overflow only when necessary.

**Step 4: Verify GREEN**

```bash
npm test -- --run src/features/governance/PeopleWorkspacePage.test.tsx
npm run lint
npm run build
```

Expected: all four existing business tests and the new layout tests pass.

**Step 5: Commit**

```bash
git add apps/web/src/features/governance/PeopleWorkspacePage.tsx apps/web/src/features/governance/PeopleWorkspacePage.test.tsx
git commit -m "refactor(web): flatten people governance workspace"
```

### Task 7: Align page states, Toasts, date fields, and status chips

**Files:**

- Modify: `apps/web/src/shared/ui/components/PageState.tsx`
- Modify: `apps/web/src/shared/ui/components/PageState.test.tsx`
- Modify: `apps/web/src/shared/ui/components/StatusChip.tsx`
- Create: `apps/web/src/shared/ui/components/StatusChip.test.tsx`
- Modify: `apps/web/src/shared/ui/feedback/ToastProvider.tsx`
- Modify: `apps/web/src/shared/ui/feedback/ToastProvider.test.tsx`

**Step 1: Write failing state-contract tests**

Test that:

- loading, empty, error, forbidden, and offline use consistent landmarks;
- status chips expose both visible labels and semantic icons for non-neutral states;
- Toast remains queued, does not disappear on clickaway, and uses the correct role for severity;
- action buttons remain keyboard accessible.

**Step 2: Run the tests to verify RED**

```bash
npm test -- --run src/shared/ui/components/PageState.test.tsx src/shared/ui/components/StatusChip.test.tsx src/shared/ui/feedback/ToastProvider.test.tsx
```

Expected: FAIL on the new semantic icon and landmark assertions.

**Step 3: Implement consistent states**

- Render `PageState` as a named status region with a tonal icon container.
- Add success, warning, and danger icons to `StatusChip` while keeping text labels.
- Restyle Toast through theme slots; do not change queue behavior or durations.
- Keep date fields on MUI X Date Picker with Chinese locale and accessible group labels.

**Step 4: Verify GREEN**

```bash
npm test -- --run src/shared/ui/components/PageState.test.tsx src/shared/ui/components/StatusChip.test.tsx src/shared/ui/feedback/ToastProvider.test.tsx
npm run lint
npm run build
```

Expected: PASS.

**Step 5: Commit**

```bash
git add apps/web/src/shared/ui/components apps/web/src/shared/ui/feedback
git commit -m "refactor(web): align shared m3 states"
```

### Task 8: Full regression, responsive visual QA, Docker deployment, and push

**Files:**

- Modify only files proven necessary by verification failures.
- Update: `docs/plans/2026-08-22-m3-frontend-redesign-design.md` only if implementation changes an approved design decision.

**Step 1: Run the full automated frontend gate**

```bash
cd apps/web
npm test -- --run
npm run lint
npm run build
```

Expected: all test files pass, ESLint has zero warnings, TypeScript and Vite build successfully.

**Step 2: Check repository hygiene**

```bash
cd ../..
git diff --check
git status --short
```

Expected: no whitespace errors and only intended redesign files are modified.

**Step 3: Rebuild only the Web service**

Reuse the existing Compose project and its current environment. Do not delete or recreate PostgreSQL volumes.

```bash
docker compose -p beverage-ops-renovate up -d --build --no-deps web
curl --silent --show-error --fail --output /dev/null http://localhost:5173/
docker compose -p beverage-ops-renovate ps web
```

Expected: Web container is `Up` on port 5173 and the root page returns success.

**Step 4: Perform responsive visual QA**

Check these viewports:

- 390×844: authentication, each startup step, people stacked layout.
- 1024×768: no horizontal overflow; supporting actions collapse below content.
- 1440×900: expanded hierarchy remains balanced.
- 1920×1080: period and template startup steps have no page-level vertical scrollbar.

Verify keyboard focus, hover, disabled, error, loading, Toast, Popover, date-picker, back-to-edit, and publish states. Authentication credentials must only be entered after explicit user confirmation if browser automation requires them.

**Step 5: Commit verification fixes**

```bash
git add apps/web docs/plans/2026-08-22-m3-frontend-redesign-design.md
git diff --cached --check
git commit -m "fix(web): complete responsive m3 polish"
```

Skip this commit if no fixes were needed.

**Step 6: Push `renovate` and verify synchronization**

```bash
git -c http.version=HTTP/1.1 push origin renovate
git status --short --branch
git rev-parse HEAD
git rev-parse origin/renovate
```

Expected: working tree clean and local/remote commit hashes identical.
