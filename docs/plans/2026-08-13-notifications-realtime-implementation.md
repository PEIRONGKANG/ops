# 通知、运营工作台与授权实时事件 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** 为全新饮品实训运营系统提供安全的站内通知、P3/P2 服务端工作台和认证实时状态刷新。

**Architecture:** 在新的 Flyway V6 PostgreSQL 通知表上实现通知端口和 JDBC 适配器。应用服务仅在已提交事务后由事件监听器创建通知并向个人队列推送刷新消息；STOMP `/ws` 握手复用现有 Bearer token，订阅由服务端限定到当前用户队列。工作台仅从当前 PostgreSQL 运行事实聚合，绝不访问旧系统或旧数据。

**Tech Stack:** Java 21、Spring Boot 3.4、Spring Security、Spring WebSocket/STOMP、JDBC、Flyway、PostgreSQL、JUnit 5、MockMvc、Testcontainers。

---

### Task 1: 持久通知、事务后投递与读取 API

**Files:**
- Create: `apps/backend/src/main/resources/db/migration/V6__create_notifications_schema.sql`
- Create: `apps/backend/src/main/java/com/beverageops/shared/notification/**`
- Test: `apps/backend/src/test/java/com/beverageops/shared/notification/NotificationIntegrationTest.java`

1. 写失败集成测试：事件仅为正确收件人创建通知，非收件人无法读取/标记，已读操作幂等。
2. 运行该测试，确认因路由/实现缺失失败。
3. 创建追加式通知表、领域端口、JDBC 适配器、用例与 `GET/POST` API；通知创建必须写入审计事实。
4. 添加 `@TransactionalEventListener(AFTER_COMMIT)` 监听器，并使运行领域事件在 assignment、任务退回、异常指派、交接提交/退回、待补充经营摘要后发布。
5. 运行聚焦测试；提交 `feat: add persistent operational notifications`。

### Task 2: P3/P2 服务器授权工作台

**Files:**
- Create: `apps/backend/src/main/java/com/beverageops/operations/application/usecase/OperationsDashboardUseCase.java`
- Create: `apps/backend/src/main/java/com/beverageops/operations/adapter/in/web/OperationsDashboardController.java`
- Modify: operations JDBC ports/adapters as required for确定性查询。
- Test: `apps/backend/src/test/java/com/beverageops/operations/adapter/in/web/OperationsDashboardIntegrationTest.java`

1. 写失败测试：P3 只能看本人班次和待办；P2 只能看获授权门店的当日待排班/签核/风险，不能用参数扩大范围。
2. 运行该测试，确认端点缺失。
3. 实现由服务端身份派生的个人与 P2 scope 聚合查询；返回清晰的实体引用及其当前版本，不依赖前端推断。
4. 运行聚焦测试；提交 `feat: add authorised operations dashboards`。

### Task 3: WebSocket/STOMP 认证与个人实时刷新

**Files:**
- Modify: `apps/backend/pom.xml`, `shared/security/SecurityConfiguration.java`
- Create: `apps/backend/src/main/java/com/beverageops/shared/realtime/**`
- Test: `apps/backend/src/test/java/com/beverageops/shared/realtime/RealtimeAuthorisationTest.java`

1. 写失败测试：缺少或无效 Bearer token 的握手被拒绝；任何 `/topic/**`、其他用户队列和资源 ID 主题订阅被拒；只允许当前用户的 `/user/queue/operations`。
2. 运行测试，确认配置不存在。
3. 添加 WebSocket/STOMP 依赖、握手 token 认证、入站订阅授权和在 AFTER_COMMIT 通知监听器中发出的个人刷新事件。
4. 运行聚焦测试、全量 Maven 测试、`mvn package` 与 `git diff --check`；提交 `feat: add authorised realtime operations events`。
