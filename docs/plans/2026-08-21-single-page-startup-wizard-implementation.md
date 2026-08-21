# 单页启动配置向导 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 P1 工作台中完成横向三步启动配置及真实服务端闭环，而不跳转到三个独立页面。

**Architecture:** Dashboard 根据治理 API 的服务端事实计算进度，并以嵌入模式复用已有周期、模板与人员表单。每个成功回调都会重新读取服务端状态并切换到下一个未完成步骤，保证刷新与并发变更的准确性。

**Tech Stack:** React 19、TypeScript、MUI 7（Material 3 主题）、React Hook Form、Vitest、Testing Library。

---

### Task 1: 锁定工作台的单页初始行为

**Files:**

- Modify: `apps/web/src/features/dashboard/DashboardPage.test.tsx`

**Step 1: Write the failing test**

断言没有周期时，工作台同时包含 `启动配置流程` 横向列表和第一步的 `周期代码` 表单字段；不再期待外部工作区回调。

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/dashboard/DashboardPage.test.tsx`

Expected: FAIL，因为 Dashboard 仍只渲染纵向清单且需要导航回调。

**Step 3: Implement minimal code**

将 Dashboard 的清单替换为语义化横向进度轨道，将当前表单嵌入轨道下方。

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/features/dashboard/DashboardPage.test.tsx`

Expected: PASS。

### Task 2: 为真实配置表单增加嵌入外观

**Files:**

- Modify: `apps/web/src/features/governance/TermWorkspacePage.tsx`
- Modify: `apps/web/src/features/governance/TemplateWorkspacePage.tsx`
- Modify: `apps/web/src/features/governance/PeopleWorkspacePage.tsx`
- Test: `apps/web/src/features/governance/*WorkspacePage.test.tsx`

**Step 1: Write failing tests**

分别渲染三个页面的 `embedded` 模式，断言不出现“返回工作台”，但仍可见各自的标题或可执行表单。

**Step 2: Run tests to verify failure**

Run: `npm test -- --run src/features/governance/TermWorkspacePage.test.tsx src/features/governance/TemplateWorkspacePage.test.tsx src/features/governance/PeopleWorkspacePage.test.tsx`

Expected: FAIL，因为 props 尚不存在。

**Step 3: Implement minimal code**

将返回回调改为可选，新增 `embedded?: boolean`，仅在非嵌入模式套用返回按钮和治理页眉；保留所有既有 API、表单和错误路径。

**Step 4: Run tests to verify pass**

Run: `npm test -- --run src/features/governance/TermWorkspacePage.test.tsx src/features/governance/TemplateWorkspacePage.test.tsx src/features/governance/PeopleWorkspacePage.test.tsx`

Expected: PASS。

### Task 3: 完成自动推进与应用入口收敛

**Files:**

- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.test.tsx`
- Modify: `apps/web/src/app/App.tsx`
- Test: `apps/web/src/app/App.test.tsx`

**Step 1: Write failing tests**

模拟周期初始化返回，断言 Dashboard 重新读取状态后显示模板配置；模拟已发布模板，断言显示人员组织。断言 App 不再切换到孤立的工作区视图。

**Step 2: Run tests to verify failure**

Run: `npm test -- --run src/features/dashboard/DashboardPage.test.tsx src/app/App.test.tsx`

Expected: FAIL，因为 App 仍持有内部视图路由，Dashboard 没有嵌入回调。

**Step 3: Implement minimal code**

删除 App 的内部工作区视图状态；Dashboard 在成功回调时重新加载并选择第一个未完成步骤。通知按钮同步选择该步骤并滚动到当前配置。

**Step 4: Run tests to verify pass**

Run: `npm test -- --run src/features/dashboard/DashboardPage.test.tsx src/app/App.test.tsx`

Expected: PASS。

### Task 4: 全量验证与提交

**Files:**

- Modify: 上述文件及本计划文档

**Step 1: Run all frontend tests**

Run: `npm test -- --run`

Expected: PASS。

**Step 2: Build and lint**

Run: `npm run build && npm run lint && git diff --check`

Expected: 所有命令成功；构建包体告警如存在须记录但不视为失败。

**Step 3: Commit**

Run: `git add docs/plans apps/web/src/app/App.tsx apps/web/src/features/dashboard apps/web/src/features/governance && git commit -m 'feat(web): guide startup setup on one page'`
