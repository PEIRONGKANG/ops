# Startup Notification Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 P1 的首次启动引导从首页正文迁移到可操作的顶部通知面板。

**Architecture:** `DashboardPage` 已经从治理 API 计算启动状态，因此它负责将状态、未完成步骤和工作区动作传给 `AppShell`。`AppShell` 只管理通知图标的锚点、打开和关闭，并把通知内容作为 React 节点渲染到 MUI `Popover`，不引入全局通知存储。

**Tech Stack:** React 19、TypeScript、MUI 7、Vitest、Testing Library。

---

### Task 1: 建立通知交互的失败测试

**Files:**

- Modify: `apps/web/src/features/dashboard/DashboardPage.test.tsx`
- Modify: `apps/web/src/app/App.test.tsx`

**Step 1: Write the failing test**

添加测试，服务端没有周期时顶部存在名为“通知”的按钮；点击它会显示“系统管理员，欢迎回来”和“建立实训周期”，再点击行动会调用 `onOpenTermWorkspace`。同时断言正文中不再出现该欢迎语。

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/dashboard/DashboardPage.test.tsx src/app/App.test.tsx`

Expected: FAIL，因为当前 `AppShell` 没有通知按钮，`DashboardPage` 仍在正文输出欢迎语。

### Task 2: 实现单行通知面板

**Files:**

- Modify: `apps/web/src/shared/ui/components/AppShell.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`

**Step 1: Implement the minimal shell API**

为 `AppShell` 增加可选 `notificationContent`；只有内容存在时才渲染带语义名称“通知”的 `IconButton` 和受控 `Popover`。使用 `aria-haspopup`、`aria-expanded`、焦点可达按钮和关闭行为，不使用 CSS 哈希类。

**Step 2: Move current startup guidance**

从 Dashboard 正文移除欢迎标题区；基于已有 `currentState` 和步骤状态构造通知内容。第一个 `current` 步骤显示真实按钮，完成时只显示完成状态。

**Step 3: Run targeted tests**

Run: `npm test -- --run src/features/dashboard/DashboardPage.test.tsx src/app/App.test.tsx`

Expected: PASS。

### Task 3: 回归验证与提交

**Files:**

- Modify as required by Task 1–2 only.

**Step 1: Run full frontend verification**

Run: `npm test -- --run && npm run build && npm run lint`

Expected: all tests pass; TypeScript build and ESLint succeed.

**Step 2: Check the staged diff**

Run: `git diff --check && git status --short`

Expected: only notification design, implementation, and tests are changed.

**Step 3: Commit**

```bash
git add docs/plans/2026-08-21-startup-notification-design.md docs/plans/2026-08-21-startup-notification-implementation.md apps/web/src/shared/ui/components/AppShell.tsx apps/web/src/features/dashboard/DashboardPage.tsx apps/web/src/features/dashboard/DashboardPage.test.tsx apps/web/src/app/App.test.tsx
git commit -m "feat(web): move startup guidance to notifications"
```
