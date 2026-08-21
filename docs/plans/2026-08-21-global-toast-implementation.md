# 全局 Toast 提示 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将启动配置与认证过程的非阻断性错误、警告和成功反馈统一为全局 Material Toast。

**Architecture:** 在主题提供者下增加一个 `ToastProvider`，由 `useToast` 提供队列化的消息入口。页面保留字段校验和阻断性的 `PageState`，而完成或失败的业务操作只更新数据状态并发布 Toast。

**Tech Stack:** React 19、TypeScript、MUI 7、Vitest、Testing Library。

---

### Task 1: 建立全局 Toast 基础设施

**Files:**

- Create: `apps/web/src/shared/ui/feedback/ToastProvider.tsx`
- Create: `apps/web/src/shared/ui/feedback/ToastProvider.test.tsx`
- Modify: `apps/web/src/app/App.tsx`

**Step 1: Write the failing test**

渲染一个使用 `useToast` 的探针组件，断言触发 `error` 消息时出现右下角 Toast；断言可选操作按钮能被点击并执行回调。

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/shared/ui/feedback/ToastProvider.test.tsx`

Expected: FAIL，因为 Provider 和 Hook 尚不存在。

**Step 3: Implement minimal code**

实现带顺序队列的 `ToastProvider`、`useToast`、严重级别与可选操作；在 `App` 中将它放到 `AppThemeProvider` 内、`AuthProvider` 外。

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/shared/ui/feedback/ToastProvider.test.tsx`

Expected: PASS。

### Task 2: 将认证与启动工作台迁移到 Toast

**Files:**

- Modify: `apps/web/src/features/auth/LoginPage.tsx`
- Modify: `apps/web/src/features/auth/ChangePasswordPage.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: 对应 `*.test.tsx`

**Step 1: Write failing tests**

断言认证失败不再在表单内渲染结果型 Alert，而在 Toast 中显示；断言启动状态同步失败的重试动作由 Toast 提供。

**Step 2: Run tests to verify failure**

Run: `npm test -- --run src/app/App.test.tsx src/features/dashboard/DashboardPage.test.tsx`

Expected: FAIL，因为页面当前仍使用内嵌 Alert。

**Step 3: Implement minimal code**

用 `useToast` 代替提交错误 state 和页面内 Alert；保留登录字段校验与加载文字。

**Step 4: Run tests to verify pass**

Run: `npm test -- --run src/app/App.test.tsx src/features/dashboard/DashboardPage.test.tsx`

Expected: PASS。

### Task 3: 将治理工作区迁移到 Toast

**Files:**

- Modify: `apps/web/src/features/governance/TermWorkspacePage.tsx`
- Modify: `apps/web/src/features/governance/TemplateWorkspacePage.tsx`
- Modify: `apps/web/src/features/governance/PeopleWorkspacePage.tsx`
- Modify: 对应 `*.test.tsx`

**Step 1: Write failing tests**

断言周期初始化、模板发布和人员审批后的结果通过 Toast 可见，且嵌入工作区中不再出现结果型 Alert。

**Step 2: Run tests to verify failure**

Run: `npm test -- --run src/features/governance/TermWorkspacePage.test.tsx src/features/governance/TemplateWorkspacePage.test.tsx src/features/governance/PeopleWorkspacePage.test.tsx`

Expected: FAIL，因为当前工作区仍在组件内渲染 Alert。

**Step 3: Implement minimal code**

业务操作成功或失败时发布 Toast，删除结果型 Alert；将一次性临时密码改为非警告的凭据交付区域。阻断性加载失败仍保留 `PageState`。

**Step 4: Run tests to verify pass**

Run: `npm test -- --run src/features/governance/TermWorkspacePage.test.tsx src/features/governance/TemplateWorkspacePage.test.tsx src/features/governance/PeopleWorkspacePage.test.tsx`

Expected: PASS。

### Task 4: 完整验证与部署

**Files:**

- Modify: 上述文件及本计划

**Step 1: Run verification**

Run: `npm test -- --run`, `npm run build`, `npm run lint`, `git diff --check`。

**Step 2: Rebuild web Docker image**

构建并替换唯一无状态的 web 容器；后端和 PostgreSQL 容器不变。

**Step 3: Commit**

Run: `git commit -m "feat(web): unify feedback with toast"`。
