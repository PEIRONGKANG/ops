# 启动清单前后端交互实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将 P1 启动清单连接到真实 Spring/PostgreSQL 治理接口，完成实训周期、运营模板和实训人员的可查询、可创建、可发布与可组织闭环。

**Architecture:** 后端继续使用 identityaccess/governance 的 DDD 应用服务与 JDBC 端口，不引入旧数据或兼容层；仅新增账号只读查询端口以支撑人员组织。前端在 `features/governance` 中定义类型化 API 和页面状态，Dashboard 通过真实治理查询计算三步清单状态，并通过抽屉/内联表单调用 `/api/v1/admin`。

**Tech Stack:** Java 21, Spring Boot 3.4, PostgreSQL/Flyway, React 19, TypeScript, MUI 7, React Hook Form, Vitest/Testing Library, Docker。

---

### Task 1: 补齐 P1 可见账号查询接口

**Files:**
- Modify: `apps/backend/src/main/java/com/beverageops/identityaccess/domain/port/IdentityAdministrationRepository.java`
- Modify: `apps/backend/src/main/java/com/beverageops/identityaccess/infrastructure/persistence/JdbcIdentityAdministrationRepository.java`
- Modify: `apps/backend/src/main/java/com/beverageops/identityaccess/application/usecase/IdentityAdministrationUseCase.java`
- Modify: `apps/backend/src/main/java/com/beverageops/identityaccess/adapter/in/web/AdminIdentityController.java`
- Test: `apps/backend/src/test/java/com/beverageops/identityaccess/adapter/in/web/AdminIdentityControllerIntegrationTest.java`

**Steps:** 先写 P1 可读取账号摘要、非 P1 返回 403 的失败集成测试；实现只返回 id/loginId/displayName/status/roles 的只读查询，严禁 passwordHash、临时密码和安全字段；运行治理与身份集成测试。

### Task 2: 建立前端治理 API 契约

**Files:**
- Create: `apps/web/src/features/governance/governanceApi.ts`
- Test: `apps/web/src/features/governance/governanceApi.test.ts`

**Steps:** 先测试 terms/stores/teaching-weeks/templates/teams/memberships/accounts/registration-requests 的路径、方法和 JSON body；实现使用注入的 `ApiClient`，不在页面直接 fetch。

### Task 3: 实现实训周期工作区

**Files:**
- Create: `apps/web/src/features/governance/TermWorkspacePage.tsx`
- Create: `apps/web/src/features/governance/TermWorkspacePage.test.tsx`
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/app/App.tsx`

**Steps:** 先测试空状态、创建周期表单、创建后展示 draft 周期；实现真实列表和创建周期/门店/教学周流程，使用当前 P1 会话，处理加载、校验、业务错误和版本状态。

### Task 4: 实现运营模板与人员组织

**Files:**
- Create: `apps/web/src/features/governance/TemplateWorkspacePage.tsx`
- Create: `apps/web/src/features/governance/PeopleWorkspacePage.tsx`
- Create: corresponding tests
- Modify: `apps/web/src/features/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/app/App.tsx`

**Steps:** 以已创建周期/门店为前置条件，创建并发布模板版本；展示待审批申请、账号摘要、团队与学期成员，完成审批、团队创建、成员加入。所有动作使用后端版本和状态，不在前端推断权限或阈值。

### Task 5: 验证、容器更新与提交

**Steps:** 运行后端 `./mvnw test`（或可用 Maven 测试）、前端全量测试/build/lint，重建 web/backend 容器并以真实接口验证 P1 流程；最后提交每个完整闭环。
