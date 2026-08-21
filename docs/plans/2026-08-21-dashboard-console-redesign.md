# 运营工作台首页重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将首次进入的 P1 运营工作台从三张同权重的大卡片改为清爽、连续、可执行的启动控制台，符合现代 Web good design 的信息层级与操作优先级。

**Architecture:** 保留现有 React + TypeScript + MUI Material 3 底座和认证数据流，只重构 `DashboardPage` 的呈现层。页面采用单列主内容与轻量状态栏：启动清单用语义化列表表达配置依赖顺序，当前状态作为辅助信息，不引入伪造业务数据或新的后端接口。

**Tech Stack:** React 19, TypeScript, MUI 7, Vitest, Testing Library, Docker/Nginx。

---

### Task 1: 为新首页结构编写失败测试

**Files:**
- Modify: `apps/web/src/app/App.test.tsx`

**Step 1: Write the failing test**

新增断言：登录后应显示“启动清单”“建立实训周期”“配置运营模板”“组织实训人员”，并且页面不再存在旧的“初始化运行环境”卡片标题和“治理配置即将开放”禁用按钮。

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/app/App.test.tsx`

Expected: FAIL，因为当前页面仍渲染旧卡片文案和禁用按钮。

### Task 2: 实现清单式运营控制台

**Files:**
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/app/App.tsx` only if accessible page semantics need adjustment

**Step 1: Write minimal implementation**

- 删除三张 `Card`/`WelcomeCard` 网格和大面积边框。
- 保留一段简洁问候、角色 chip 和一条主状态摘要。
- 用 `List`/`ListItem` 或等价语义结构呈现三步启动清单；每行包含步骤号、标题、说明和右侧状态。
- 首项标记为“当前步骤”；后续步骤标注“完成上一步后可用”。在对应配置页尚未实现前，不展示无实际导航能力的按钮。
- 将“尚未创建当期运营数据”改为紧凑的状态信息区，不使用禁用的 CTA 假装可操作。
- 使用 `AppShell`、现有品牌 token、响应式断点；桌面端控制内容宽度，移动端保持单列。

**Step 2: Run test to verify it passes**

Run: `npm test -- --run src/app/App.test.tsx`

Expected: PASS。

### Task 3: 完成前端质量验证

**Files:**
- No additional files unless verification reveals a defect.

**Step 1: Run all frontend tests**

Run: `npm test -- --run`

Expected: all tests pass。

**Step 2: Run typecheck/build and lint**

Run: `npm run build && npm run lint && git diff --check`

Expected: build succeeds, lint reports no warnings/errors, diff check is clean。

**Step 3: Rebuild the web container**

Run with the existing local environment: `docker compose up -d --build web` (or rebuild the currently running web image if compose environment variables are unavailable).

Expected: `http://localhost:5173` returns `200`, login/session behavior remains unchanged, and the authenticated P1 page shows the new console layout。

### Task 4: Commit the redesign

**Files:**
- `docs/plans/2026-08-21-dashboard-console-redesign.md`
- `apps/web/src/app/App.test.tsx`
- `apps/web/src/features/dashboard/DashboardPage.tsx`

**Step 1: Commit**

```bash
git add docs/plans/2026-08-21-dashboard-console-redesign.md apps/web/src/app/App.test.tsx apps/web/src/features/dashboard/DashboardPage.tsx
git commit -m "refactor(web): simplify operations dashboard"
```
