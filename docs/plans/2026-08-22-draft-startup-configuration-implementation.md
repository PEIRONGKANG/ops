# 草稿式启动配置 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 提供可回退编辑的草稿启动配置，并且只在最后一步原子发布周期与模板。

**Architecture:** 后端用 DDD 应用服务承载跨聚合的原子保存和最终发布事务；前端 Dashboard 管理可查看步骤，嵌入式工作区只渲染内容与表单。所有接口通过 `GovernanceApi` 调用，所有写操作依赖对象版本号。

**Tech Stack:** Java 21、Spring Boot、Spring Transaction、PostgreSQL、React 19、TypeScript、MUI 7、MUI X Date Pickers、Vitest、Testing Library。

---

### Task 1: 锁定周期草稿的原子保存接口

**Files:**

- Modify: `apps/backend/src/test/java/com/beverageops/governance/adapter/in/web/GovernanceControllerIntegrationTest.java`
- Modify: `apps/backend/src/main/java/com/beverageops/governance/application/usecase/GovernanceUseCase.java`
- Modify: `apps/backend/src/main/java/com/beverageops/governance/domain/port/GovernanceRepository.java`
- Modify: `apps/backend/src/main/java/com/beverageops/governance/infrastructure/persistence/JdbcGovernanceRepository.java`
- Modify: `apps/backend/src/main/java/com/beverageops/governance/adapter/in/web/GovernanceController.java`

**Step 1: Write the failing integration test**

创建周期、门店、首周后，对 `PATCH /api/v1/admin/startup-configurations/{termId}` 提交三个对象的版本和新值；断言三个返回对象均更新。再以过期版本提交并断言 `409`，且数据库未留下任一部分更新。

**Step 2: Run test to verify it fails**

Run:

```bash
JAVA_HOME=/Users/ultrao/Library/Java/JavaVirtualMachines/corretto-21.0.5/Contents/Home ./mvnw test -Dtest=GovernanceControllerIntegrationTest
```

Expected: FAIL，因为接口不存在。

**Step 3: Implement minimal application transaction**

为教学周加入带版本号的更新 port 和 JDBC 实现；在 `GovernanceUseCase` 验证周期为草稿、首周属于周期且门店存在后，以同一事务依次更新周期、门店、首周并写审计。Controller 只做请求映射并返回更新后的三项。

**Step 4: Run test to verify it passes**

Run the command in Step 2. Expected: PASS。

**Step 5: Commit**

```bash
git add apps/backend/src/test/java/com/beverageops/governance/adapter/in/web/GovernanceControllerIntegrationTest.java apps/backend/src/main/java/com/beverageops/governance
git commit -m "feat(governance): save startup period drafts atomically"
```

### Task 2: 锁定模板草稿保存与最终发布事务

**Files:**

- Modify: `apps/backend/src/test/java/com/beverageops/governance/adapter/in/web/GovernanceControllerIntegrationTest.java`
- Modify: `apps/backend/src/main/java/com/beverageops/governance/application/usecase/GovernanceUseCase.java`
- Modify: `apps/backend/src/main/java/com/beverageops/governance/domain/port/GovernanceRepository.java`
- Modify: `apps/backend/src/main/java/com/beverageops/governance/infrastructure/persistence/JdbcGovernanceRepository.java`
- Modify: `apps/backend/src/main/java/com/beverageops/governance/adapter/in/web/GovernanceController.java`

**Step 1: Write the failing integration tests**

1. 草稿模板、首个岗位、首项 SOP 可通过一个 `PATCH` 请求共同保存，三个版本都递增；
2. 仅在存在活跃团队和其活跃成员时，`POST /api/v1/admin/startup-configurations/{termId}/publish` 才能同时发布草稿周期与草稿模板；
3. 缺人员或版本过期时，发布失败且两对象继续保持草稿。

**Step 2: Run tests to verify they fail**

Run the command in Task 1 Step 2. Expected: FAIL because both routes are absent.

**Step 3: Implement minimal transactions**

为模板组件增加查询单项和更新 port；保存模板草稿时锁定模板并校验两个组件属于同一草稿版本。发布时锁定周期与模板，检查模板归属与最低活跃人员组织条件，再发布两者并写审计。

**Step 4: Run tests to verify they pass**

Run the command in Task 1 Step 2. Expected: PASS。

**Step 5: Commit**

```bash
git add apps/backend/src/test/java/com/beverageops/governance/adapter/in/web/GovernanceControllerIntegrationTest.java apps/backend/src/main/java/com/beverageops/governance
git commit -m "feat(governance): publish startup configuration"
```

### Task 3: 扩展前端治理 API 的真实草稿契约

**Files:**

- Modify: `apps/web/src/features/governance/governanceApi.test.ts`
- Modify: `apps/web/src/features/governance/governanceApi.ts`

**Step 1: Write failing tests**

断言 `saveStartupPeriod`、`saveStarterTemplate` 和 `publishStartupConfiguration` 分别使用约定 PATCH/POST 路径、JSON 请求体和既有认证 `ApiClient`。

**Step 2: Run tests to verify failure**

```bash
npm test -- --run src/features/governance/governanceApi.test.ts
```

Expected: FAIL，因为 API 方法不存在。

**Step 3: Implement minimal client methods and types**

增加更新输入/响应类型和 API 方法。严禁页面直接 `fetch`。

**Step 4: Run tests to verify pass**

Run the command in Step 2. Expected: PASS。

**Step 5: Commit**

```bash
git add apps/web/src/features/governance/governanceApi.ts apps/web/src/features/governance/governanceApi.test.ts
git commit -m "feat(web): add startup draft governance api"
```

### Task 4: 实现可查看步骤和统一工具栏操作

**Files:**

- Modify: `apps/web/src/features/dashboard/DashboardPage.test.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/features/governance/TermWorkspacePage.test.tsx`
- Modify: `apps/web/src/features/governance/TermWorkspacePage.tsx`
- Modify: `apps/web/src/features/governance/TemplateWorkspacePage.test.tsx`
- Modify: `apps/web/src/features/governance/TemplateWorkspacePage.tsx`
- Modify: `apps/web/src/features/governance/PeopleWorkspacePage.test.tsx`
- Modify: `apps/web/src/features/governance/PeopleWorkspacePage.tsx`

**Step 1: Write failing component tests**

断言：

1. 上方已完成的步骤可点击并显示其表单；
2. 当前配置工具栏左侧显示可用的“返回上一步”，右侧显示唯一主操作；
3. 第一、二步表单底部没有提交按钮，工具栏提交对应同一表单；
4. 第二步只保存模板草稿；第三步满足条件后显示最终发布。

**Step 2: Run tests to verify failure**

```bash
npm test -- --run src/features/dashboard/DashboardPage.test.tsx src/features/governance/TermWorkspacePage.test.tsx src/features/governance/TemplateWorkspacePage.test.tsx src/features/governance/PeopleWorkspacePage.test.tsx
```

Expected: FAIL because selected-step state and external form submission are absent.

**Step 3: Implement minimal UI**

Dashboard 保存选择步骤状态，并只允许选择已完成或当前步骤；渲染 M3 风格工具栏。嵌入式表单暴露 `form` ID，工具栏按钮用 `form` 属性提交，避免重复按钮。存在草稿时表单以服务端对象填充，保存使用新 API 并在成功后刷新进度。发布成功后进入完成态。

**Step 4: Run tests to verify pass**

Run the command in Step 2. Expected: PASS。

**Step 5: Commit**

```bash
git add apps/web/src/features/dashboard apps/web/src/features/governance
git commit -m "feat(web): edit and publish startup configuration"
```

### Task 5: 全量验证、视觉检查、Docker 更新与提交

**Files:**

- Modify: `docs/plans/2026-08-22-draft-startup-configuration-design.md`
- Modify: `docs/plans/2026-08-22-draft-startup-configuration-implementation.md`

**Step 1: Run all automated verification**

```bash
JAVA_HOME=/Users/ultrao/Library/Java/JavaVirtualMachines/corretto-21.0.5/Contents/Home ./mvnw test
cd apps/web && npm test -- --run && npm run build && npm run lint
git diff --check
```

Expected: all commands exit 0.

**Step 2: Inspect desktop flow**

在 1920×1080 浏览器视口确认：进度轨道在上；主体表单在下；工具栏左回退、右主操作；没有表单底部重复按钮；最终发布只在第三步出现。

**Step 3: Rebuild Docker web and backend services**

使用仓库现有 Compose 配置重新构建并替换 web 与 backend 服务，不删除 PostgreSQL 数据卷。

**Step 4: Commit documentation and final changes**

```bash
git add docs/plans
git commit -m "docs: define draft startup configuration workflow"
```
