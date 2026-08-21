# 紧凑启动工作台 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 交付一个上下分层、居中、无重复引导文案的 Material 启动配置工作台，并使用真正的 Material 日期选择器。

**Architecture:** Dashboard 仅负责上方的服务端驱动进度轨道与下方当前步骤容器。各真实治理表单提供紧凑嵌入变体；共享的日期控件负责 Day.js 字符串与 MUI X `DatePicker` 间的转换。

**Tech Stack:** React 19、TypeScript、MUI 7、MUI X Date Pickers 8、Day.js、Vitest、Testing Library。

---

### Task 1: 锁定紧凑两层工作台行为

**Files:**

- Modify: `apps/web/src/features/dashboard/DashboardPage.test.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`

**Step 1: Write the failing test**

断言页面不包含“启动清单”及“当前配置”，但包含进度列表和 `当前步骤配置` 主体区域；该区域内直接可见周期表单。

**Step 2: Run test to verify it fails**

Run: `npm test -- --run src/features/dashboard/DashboardPage.test.tsx`

Expected: FAIL，因为当前 Dashboard 仍渲染两段截图中的文案。

**Step 3: Implement minimal code**

删除重复标题，使用全高居中容器、紧凑进度轨道和下方配置主体。保留服务端状态与通知定位逻辑。

**Step 4: Run test to verify it passes**

Run: `npm test -- --run src/features/dashboard/DashboardPage.test.tsx`

Expected: PASS。

### Task 2: 引入 Material 日期选择器

**Files:**

- Modify: `apps/web/package.json`
- Modify: `apps/web/package-lock.json`
- Create: `apps/web/src/shared/ui/components/MaterialDateField.tsx`
- Create: `apps/web/src/shared/ui/components/MaterialDateField.test.tsx`

**Step 1: Add compatible dependencies**

Run: `npm install @mui/x-date-pickers@^8 dayjs`

**Step 2: Write the failing test**

验证日期字段拥有日历打开按钮；选择 Day.js 日期时，回调输出 `YYYY-MM-DD` 字符串。

**Step 3: Run test to verify it fails**

Run: `npm test -- --run src/shared/ui/components/MaterialDateField.test.tsx`

Expected: FAIL，因为共享日期组件尚不存在。

**Step 4: Implement minimal code**

使用 `LocalizationProvider`、`AdapterDayjs`、中文 locale 与 `DatePicker`，处理空值、错误和文本标签。

**Step 5: Run test to verify it passes**

Run: `npm test -- --run src/shared/ui/components/MaterialDateField.test.tsx`

Expected: PASS。

### Task 3: 紧凑化周期与模板日期表单

**Files:**

- Modify: `apps/web/src/features/governance/TermWorkspacePage.tsx`
- Modify: `apps/web/src/features/governance/TemplateWorkspacePage.tsx`
- Modify: `apps/web/src/features/governance/TermWorkspacePage.test.tsx`
- Modify: `apps/web/src/features/governance/TemplateWorkspacePage.test.tsx`

**Step 1: Write failing tests**

在嵌入周期表单中断言重复页标题/说明不存在，保留必要分组与 Material 日历按钮；断言模板生效日期同样使用共享日期组件。

**Step 2: Run tests to verify failure**

Run: `npm test -- --run src/features/governance/TermWorkspacePage.test.tsx src/features/governance/TemplateWorkspacePage.test.tsx`

Expected: FAIL。

**Step 3: Implement minimal code**

使用共享日期字段；嵌入模式减少描述和间距，桌面端采用三列栅格，独立工作区继续保留完整上下文。

**Step 4: Run tests to verify pass**

Run: `npm test -- --run src/features/governance/TermWorkspacePage.test.tsx src/features/governance/TemplateWorkspacePage.test.tsx`

Expected: PASS。

### Task 4: 验证、视觉检查与部署

**Files:**

- Modify: 上述文件及本计划文档

**Step 1: Run verification**

Run: `npm test -- --run && npm run build && npm run lint && git diff --check`

Expected: 全部成功。

**Step 2: Inspect desktop composition**

启动本地前端，在 1920×1080 视口检查主区无垂直滚动、上方轨道与下方表单同时可见、日期按钮可打开日历。

**Step 3: Commit and rebuild web Docker image**

Run: `git commit -m "refactor(web): compact startup workspace"`，随后重建并替换无状态 web 容器；不删除后端或数据库容器。
