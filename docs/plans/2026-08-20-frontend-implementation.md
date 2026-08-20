# 饮品实训运营系统前端 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在 `apps/web` 交付一套全新的 React 前端，以清爽专业的现代饮品品牌体验接入 Spring 后端真实接口，并提供 P1、P2、P3、T1 的完整工作台和核心业务页面。

**Architecture:** React + TypeScript + Vite 组成单页应用；MUI 仅负责可靠的 React 无障碍交互底座，项目 Material 3 Token 与封装组件定义最终视觉。`shared/api` 是 HTTP 唯一边界，访问令牌只存在内存、刷新令牌由 HttpOnly Cookie 管理；TanStack Query 统一管理缓存，STOMP 事件只会使明确的 Query key 失效并重取服务端事实。

**Tech Stack:** React 19、TypeScript、Vite、React Router、MUI、TanStack Query/Table、React Hook Form、Zod、`@stomp/stompjs`、Vitest、Testing Library、Playwright。

---

## 工作约束

- 只在 `apps/web` 建立新前端；不得引用、复制、迁移或兼容旧 `frontend`、`training_frontend`、FastAPI、SQLite、PocketBase 和旧业务数据。
- 现有 Spring 控制器、集成测试和 `docs/traceability/prd-api-acceptance-matrix.md` 是接口唯一来源；不得从旧系统猜测 DTO 字段。
- 页面和组件禁止直接使用 `fetch`；所有网络调用、DTO、错误映射均归属 `src/shared/api` 或对应 feature API 文件。
- 业务页面禁止硬编码颜色、圆角、阴影、间距或动画值，必须复用 Material 3 Token/封装组件。
- 每项任务遵循 TDD：写失败测试、执行并确认失败、最小实现、执行验证、独立提交。

## Task 1：创建 Vite 前端工程和测试基线

**Files:**
- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/tsconfig.json`, `apps/web/tsconfig.app.json`, `apps/web/index.html`
- Create: `apps/web/src/main.tsx`, `apps/web/src/app/App.tsx`, `apps/web/src/test/setup.ts`, `apps/web/src/test/render.tsx`, `apps/web/src/app/App.test.tsx`, `apps/web/.env.example`
- Modify: `README.md`, `compose.yaml`

**Step 1: Write the failing test.** Add `App.test.tsx`: `render(<App />)` must expose `aria-label="正在初始化会话"`.

**Step 2: Verify failure.** Run `cd apps/web && npm test -- --run src/app/App.test.tsx`; expected failure because the project does not exist.

**Step 3: Implement minimum bootstrap.** Configure Vite/Vitest/jsdom/strict TypeScript and scripts `dev`, `build`, `test`, `test:coverage`, `lint`, `e2e`. Add only `VITE_API_BASE_URL` to `.env.example`, never browser secrets. Provide a root bootstrap state and documented local start command. Add an optional web Compose service only if it cannot change backend semantics.

**Step 4: Verify.** Run `npm install && npm test -- --run src/app/App.test.tsx && npm run build`; expected test PASS and zero TypeScript errors.

**Step 5: Commit.** `git add apps/web compose.yaml README.md && git commit -m "feat(web): bootstrap React application"`.

## Task 2：建立 Material 3 饮品品牌 Token 与公共状态

**Files:**
- Create: `apps/web/src/shared/ui/theme/tokens.ts`, `createTheme.ts`, `AppThemeProvider.tsx`, `createTheme.test.ts`
- Create: `apps/web/src/shared/ui/components/PageState.tsx`, `StatusChip.tsx`, `AppShell.tsx`, `PageState.test.tsx`
- Modify: `apps/web/src/app/App.tsx`

**Step 1: Write failing tests.** Assert `createBeverageTheme().palette.primary.main` is the selected tea-green `#176B5B`; render `PageState kind="error"` and verify its accessible `重试` action invokes the callback.

**Step 2: Verify failure.** Run `cd apps/web && npm test -- --run src/shared/ui`; expected missing-module failure.

**Step 3: Implement minimum design system.** Define semantic CSS variables and MUI overrides for warm-white surfaces, tea-green action, citrus warning, berry danger, 16–20px shape, visible focus, 44px touch targets, typography and reduced-motion-safe 150–220ms transitions. Implement loading, empty, error, permission and offline states. Build a responsive shell with skip link, landmarks, desktop navigation rail, mobile header/drawer and optional P3 bottom navigation.

**Step 4: Verify.** Run `npm test -- --run src/shared/ui && npm run build`; expected PASS.

**Step 5: Commit.** `git add apps/web && git commit -m "feat(web): add Material 3 beverage design system"`.

## Task 3：实现 API 错误模型、内存会话和单飞刷新

**Files:**
- Create: `apps/web/src/shared/api/ApiError.ts`, `httpClient.ts`, `httpClient.test.ts`, `authApi.ts`
- Create: `apps/web/src/shared/auth/sessionStore.ts`, `AuthProvider.tsx`, `useAuth.ts`, `AuthProvider.test.tsx`
- Modify: `apps/web/src/app/App.tsx`

**Step 1: Write failing tests.** Mock two 401 protected calls followed by successful refresh; assert refresh runs once and both replay with `Bearer new-token`. Assert session assignment writes neither localStorage nor sessionStorage.

**Step 2: Verify failure.** Run `cd apps/web && npm test -- --run src/shared/api src/shared/auth`; expected missing-module failure.

**Step 3: Implement minimal secure boundary.** Add JSON/FormData transport with `credentials: 'include'`, Bearer injection, normalized error code/message and at-most-one replay. Never refresh a refresh request. Startup sequence is refresh then `GET /api/v1/auth/me`; failed refresh clears memory session. Implement exact login, logout and password-change contracts based on `AuthenticationController`. Keep a safe in-app return path only.

**Step 4: Verify.** Run `npm test -- --run src/shared/api src/shared/auth && npm run build`; expected single-flight test PASS.

**Step 5: Commit.** `git add apps/web && git commit -m "feat(web): add secure authenticated API client"`.

## Task 4：实现登录、改密、路由守卫和角色工作台

**Files:**
- Create: `apps/web/src/features/auth/LoginPage.tsx`, `ChangePasswordPage.tsx`, `LoginPage.test.tsx`
- Create: `apps/web/src/app/router.tsx`, `RouteGuards.tsx`, `roleNavigation.ts`, `RoleWorkspaceLayout.tsx`, `RoleWorkspaceLayout.test.tsx`

**Step 1: Write failing tests.** A guest who opens `/p3/shifts`, logs in, reaches heading `我的当班`; a P3 at `/p1/overview` sees heading `没有访问权限`, not a blank page.

**Step 2: Verify failure.** Run `cd apps/web && npm test -- --run src/features/auth src/app`; expected missing route/page failures.

**Step 3: Implement minimal role experience.** Use RHF/Zod for accessible login and first-password-change forms. Add P3 navigation `我的当班、我的日程、任务与证据、异常与交接、学习与成长、我的成果`; P2 `今日运营、排班定岗、签核中心、异常中心、运行记录`; T1 `带教观察、反馈与补训、学生成长、课程筹备`; P1 `运行总览、学期与人员、模板中心、课程与成果、归档与审计`. Multi-role accounts can switch workspace; backend remains authoritative.

**Step 4: Verify.** Run `npm test -- --run src/features/auth src/app && npm run build`; expected PASS.

**Step 5: Commit.** `git add apps/web && git commit -m "feat(web): add login and role workspaces"`.

## Task 5：接入通知中心和认证 STOMP 实时刷新

**Files:**
- Create: `apps/web/src/features/notifications/notificationsApi.ts`, `NotificationCenter.tsx`, `NotificationCenter.test.tsx`
- Create: `apps/web/src/shared/realtime/OperationsRealtimeClient.ts`, `RealtimeProvider.tsx`, `eventInvalidation.ts`, `eventInvalidation.test.ts`
- Modify: `apps/web/src/app/App.tsx`, `apps/web/src/shared/ui/components/AppShell.tsx`

**Step 1: Write failing tests.** For an `OPERATIONS_REFRESH` event, assert only `operationsKeys.all` is invalidated. For a listed notification, assert click `标记“任务被退回”为已读` invokes `POST /api/v1/notifications/{id}/read`.

**Step 2: Verify failure.** Run `cd apps/web && npm test -- --run src/features/notifications src/shared/realtime`; expected failure.

**Step 3: Implement minimum realtime lifecycle.** Implement typed notification list/read/read-all. Connect STOMP only with a valid access token, subscribe exclusively to `/user/queue/operations`, map recognised event types to curated query keys, exponential-backoff reconnect and unobtrusive connection state. Disconnect on logout or invalid session. Treat event payloads as untrusted; never merge arbitrary payloads into cached records.

**Step 4: Verify.** Run `npm test -- --run src/features/notifications src/shared/realtime && npm run build`; expected PASS.

**Step 5: Commit.** `git add apps/web && git commit -m "feat(web): add notifications and realtime refresh"`.

## Task 6：实现 P3/P2 运营工作台、班次列表与详情读模型

**Files:**
- Create: `apps/web/src/features/operations/operationsApi.ts`, `operationsKeys.ts`, `operationsApi.test.ts`
- Create: `OperationsDashboardPage.tsx`, `MyShiftListPage.tsx`, `TodayOperationsPage.tsx`, `ShiftDetailPage.tsx`, `OperationsDashboardPage.test.tsx`, `ShiftDetailPage.test.tsx`
- Modify: `apps/web/src/app/router.tsx`

**Step 1: Write failing tests.** Fixture `GET /me/operations-dashboard` must produce text `上午营业班 · 调饮岗` and action link `完成开店检查`. A P2 `GET /operations/today` response containing a blocker must show heading `需立即处置` before normal summaries.

**Step 2: Verify failure.** Run `cd apps/web && npm test -- --run src/features/operations`; expected missing-module failure.

**Step 3: Implement read clients and pages.** Implement exact contracts from `OperationsDashboardController` and `OperationsSchedulingController`: P3 dashboard/current shifts and P2 today operations. Add real endpoints for operating days, shifts, assignments, tasks and milestones. The shift detail groups status, assignments, tasks, milestones, evidence summary, incidents and handovers into a contextual work area; use loading/empty/error/permission states and card/table responsive switching.

**Step 4: Verify.** Run `npm test -- --run src/features/operations && npm run build`; expected PASS with no runtime mock data.

**Step 5: Commit.** `git add apps/web && git commit -m "feat(web): add operations workspaces and shift details"`.

## Task 7：实现班次、任务、签核、异常、交接和经营摘要写操作

**Files:**
- Create: `apps/web/src/features/operations/ShiftActionBar.tsx`, `TaskCompletionForm.tsx`, `MilestoneDecisionForm.tsx`, `IncidentWorkflow.tsx`, `HandoverWorkflow.tsx`, `OperatingSummaryForm.tsx`, `operationsMutations.test.tsx`
- Modify: `apps/web/src/features/operations/operationsApi.ts`, `ShiftDetailPage.tsx`

**Step 1: Write failing tests.** `退回补充` without reason displays `请说明退回原因` and sends no request. Assigning a blocking incident invalidates the affected shift, dashboard and incidents queries.

**Step 2: Verify failure.** Run `cd apps/web && npm test -- --run src/features/operations/operationsMutations.test.tsx`; expected failure.

**Step 3: Implement supported workflows.** Use only controller commands: operating-day and shift create/update/schedule/start/request-close/close/reopen/cancel; assignment actions; task submit/return/accept/withdraw; milestone submit/approve/return; summary create/update/confirm; incident report/acknowledge/update/assign/verify/close/return/reopen/waive; handover create/update/submit/accept/return/approve. Show legal actions based on role/status but display server rejection when state has changed. Required reasons, deadlines and version-conflict reload are RHF/Zod-driven.

**Step 4: Verify.** Run `npm test -- --run src/features/operations && npm run build`; expected PASS.

**Step 5: Commit.** `git add apps/web && git commit -m "feat(web): add operational execution workflows"`.

## Task 8：实现运营证据文件生命周期

**Files:**
- Create: `apps/web/src/features/evidence/evidenceApi.ts`, `EvidencePanel.tsx`, `EvidenceUpload.tsx`, `EvidenceVersionHistory.tsx`, `evidenceValidation.ts`, `EvidenceUpload.test.tsx`, `evidenceApi.test.ts`
- Modify: `apps/web/src/features/operations/ShiftDetailPage.tsx`

**Step 1: Write failing tests.** Uploading `unsafe.exe` displays `仅支持图片、PDF、Office 文档或视频` without a request. File history shows `当前文件` separate from `已撤回 · 2 天前`.

**Step 2: Verify failure.** Run `cd apps/web && npm test -- --run src/features/evidence`; expected failure.

**Step 3: Implement multipart API.** Implement evidence create/list/current/upload/replace/withdraw from `/api/v1/evidence*`. Use FormData without manually setting Content-Type; use progress-capable multipart transport while retaining cookie and Bearer auth. Precheck only allowed types: JPG/JPEG, PNG, WebP, PDF, DOCX, XLSX, PPTX, MP4, WebM, MOV; the server remains final validator. Show current/replaced/withdrawn versions, reason, three-day history, retry and authorized download. Never reveal relative server storage paths or invent course-attachment upload UI.

**Step 4: Verify.** Run `npm test -- --run src/features/evidence && npm run build`; expected PASS and no storage path in DOM.

**Step 5: Commit.** `git add apps/web && git commit -m "feat(web): add evidence media lifecycle"`.

## Task 9：实现 T1/P3 学习成长、反馈、补训和认证

**Files:**
- Create: `apps/web/src/features/learning/learningApi.ts`, `learningKeys.ts`, `TeachingObservationPage.tsx`, `FeedbackRetrainingPage.tsx`, `StudentGrowthPage.tsx`, `MyGrowthPage.tsx`, `LearningWorkflowForm.tsx`, `learningApi.test.ts`, `FeedbackRetrainingPage.test.tsx`
- Modify: `apps/web/src/app/router.tsx`

**Step 1: Write failing tests.** T1 feedback page displays `待完成补训` before completed observations. P3 sees `申请复测` only for a server-provided eligible retraining status.

**Step 2: Verify failure.** Run `cd apps/web && npm test -- --run src/features/learning`; expected failure.

**Step 3: Implement supported learning API.** Add feedback, retraining, certifications and `/me/learning-growth`; build T1 observation, feedback/retraining, student growth and P3 personal learning. Use feedback create/update; retraining create/update/submit/request-retest/record-retest; certification create/decide/update/list. Never hard-code certification thresholds or deadlines.

**Step 4: Verify.** Run `npm test -- --run src/features/learning && npm run build`; expected PASS.

**Step 5: Commit.** `git add apps/web && git commit -m "feat(web): add learning and certification workspaces"`.

## Task 10：实现课程筹备、创意成果与反思

**Files:**
- Create: `apps/web/src/features/course/courseApi.ts`, `CoursePreparationPage.tsx`, `CreativeWorkPage.tsx`, `ReflectionPage.tsx`, `CoursePreparationPage.test.tsx`
- Modify: `apps/web/src/app/router.tsx`

**Step 1: Write failing test.** A published material `门店卫生规范` renders, and no `上传附件` button renders because course binary media API is unavailable.

**Step 2: Verify failure.** Run `cd apps/web && npm test -- --run src/features/course`; expected failure.

**Step 3: Implement supported course contracts.** Use `CoursePreparationController` endpoints for materials/acknowledgements, tasks/submissions, creative works/feedback/publish and reflections. Surface teaching stage/publication/feedback state. Do not add any binary attachment control until the explicitly planned backend feature exists.

**Step 4: Verify.** Run `npm test -- --run src/features/course && npm run build`; expected PASS.

**Step 5: Commit.** `git add apps/web && git commit -m "feat(web): add course preparation and creative work pages"`.

## Task 11：实现 P1 治理、模板、账号与审计页面

**Files:**
- Create: `apps/web/src/features/governance/governanceApi.ts`, `GovernanceOverviewPage.tsx`, `TermPeoplePage.tsx`, `TemplateCenterPage.tsx`, `AuditArchivePage.tsx`, `GovernanceFormDrawer.tsx`, `GovernanceOverviewPage.test.tsx`, `TemplateCenterPage.test.tsx`
- Modify: `apps/web/src/app/router.tsx`

**Step 1: Write failing tests.** A `v3 · 草稿` template has accessible action `发布 v3`; term archive requires `请填写归档原因` before request.

**Step 2: Verify failure.** Run `cd apps/web && npm test -- --run src/features/governance`; expected failure.

**Step 3: Implement real governance contracts.** Use `/api/v1/admin` contracts for terms, teaching weeks, stores, teams, memberships, templates/components, registration approval/accounts, audit events and change records. Respect server filters and version fields. Render audit/change information read-only. The audit page cannot claim that five-year archival operations exist; only available audit/change APIs are shown.

**Step 4: Verify.** Run `npm test -- --run src/features/governance && npm run build`; expected PASS with P1 routing protected.

**Step 5: Commit.** `git add apps/web && git commit -m "feat(web): add governance and template center"`.

## Task 12：实现评价、成果包与个人成果

**Files:**
- Create: `apps/web/src/features/assessment/assessmentApi.ts`, `RubricPage.tsx`, `PortfolioPage.tsx`, `AssessmentRecordPage.tsx`, `MyResultsPage.tsx`, `AssessmentRecordPage.test.tsx`, `MyResultsPage.test.tsx`
- Modify: `apps/web/src/app/router.tsx`

**Step 1: Write failing tests.** An assessment record in `DRAFT` renders `提交评分` but not `发布结果`; a `已发布` personal result contains no `编辑评分` control.

**Step 2: Verify failure.** Run `cd apps/web && npm test -- --run src/features/assessment`; expected failure.

**Step 3: Implement controller-supported assessment UI.** Use rubric create/update/publish/derive/list, portfolio create/generate/publish/list/export-manifest, record create/score/submit/list, result publish/correct/list plus personal portfolios/results. Separate draft, submitted, published and correction states. Do not create an external-review portal without invitation/scoped-review API.

**Step 4: Verify.** Run `npm test -- --run src/features/assessment && npm run build`; expected PASS.

**Step 5: Commit.** `git add apps/web && git commit -m "feat(web): add assessment and portfolio interfaces"`.

## Task 13：进行可访问性、响应式和真实后端端到端验收

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/auth.spec.ts`, `p3-operations.spec.ts`, `p2-operations.spec.ts`, `accessibility.spec.ts`, `apps/web/src/app/AppShell.responsive.test.tsx`
- Modify: `apps/web/README.md`, `README.md`, `compose.yaml`

**Step 1: Write failing E2E scenarios.** One P3 logs into a separately started new Spring/PostgreSQL environment, enters an actual assigned shift and reaches evidence upload; one P2 opens abnormal centre and reaches a blocking incident. No E2E script may target old services or data.

**Step 2: Verify failure.** Run `cd apps/web && npm run e2e -- --grep "P3"`; expected failure before Playwright harness exists.

**Step 3: Implement verification harness and fix findings.** Use disposable accounts/fixtures documented outside version control. Test keyboard focus, semantic headings, narrow/wide viewports, contrast, permission pages, offline/errors and conflict recovery. Fix design issues in shared components, not with page-specific visual patches.

**Step 4: Verify full suite.** Run `npm run lint && npm test -- --run && npm run build && npm run e2e` in `apps/web`; then `./mvnw test && ./mvnw package` in `apps/backend`. All must pass.

**Step 5: Commit.** `git add apps/web README.md compose.yaml && git commit -m "test(web): verify responsive real API workflows"`.

## Task 14：回写交付记录并推送 renovate

**Files:**
- Modify: `docs/plans/2026-08-20-frontend-architecture-design.md`, `docs/traceability/prd-api-acceptance-matrix.md`, `README.md`

**Step 1: Review traceability.** Trace every delivered page to exact endpoint(s), roles, error states and tests. Retain external review, five-year archival operations and course binary attachments as explicitly unavailable until their backend contracts exist.

**Step 2: Verify clean deliverable.** Run `git status --short`; run the complete web and backend suites. Expected: all verification commands pass.

**Step 3: Update docs.** Mark only actually implemented scope as delivered; write startup and testing instructions.

**Step 4: Commit and push.** Run `git add docs README.md && git commit -m "docs: record frontend delivery status" && git push origin renovate`; expected `renovate` synchronized with origin.
