# RBAC Workflow Design

## Goal

为当前教学系统补齐服务端会话、角色/范围权限控制、统一工作流状态和审计日志，替换现有仅靠 `X-Actor-Username` 的伪登录方式，并为后续驾驶舱和归档能力提供底座。

## Context

当前系统已经具备课程配置、分组排班、周数据、岗位认证、课程评分、展示赛评分和个人手册导出，但登录态仍然只是前端把用户名写到请求头，后端没有真正的会话、没有范围控制、没有统一状态流转，也没有审计日志。

## Chosen Approach

采用轻量会话制和统一工作流底座：

- 登录后由后端创建 `sessions` 记录并返回 bearer token
- 所有后续接口通过 `Authorization: Bearer <token>` 解析当前 actor
- 后端集中提供角色和 scope 校验
- `week`、`certification`、`course_score`、`showcase_score` 统一使用工作流状态
- 关键动作统一写入 `audit_logs`

## Alternatives Considered

### 1. 最小补丁型

只替换登录方式，不做统一状态与日志。实现最快，但会把后续 PRD 里的驳回、归档、驾驶舱统计继续推迟，后面还要返工。

### 2. 工作流底座型

当前选择。一次性把 session、RBAC、scope、workflow、audit 这几层补齐，保留现有 JSON 周数据和页面结构，风险可控且能托住后续功能。

### 3. 完整重构型

把 `weeks` JSON 拆成完整业务表并实现细粒度流程引擎。长期最规范，但对当前仓库跨度过大，会直接演变成半重写。

## Authentication Model

- 登录接口验证账号密码后创建 session，并返回：
  - `token`
  - `actor`
  - `sessionUsers`
- session 表存储：
  - `token_hash`
  - `username`
  - `paired_usernames`
  - `created_at`
  - `expires_at`
  - `last_seen_at`
  - `revoked_at`
- 前端把 token 写入本地存储并在启动时调用 `/api/session`
- 失效 session 自动清空本地状态并回到登录页
- `/api/logout` 标记当前 session 为 revoked

## RBAC Model

### Roles

- `P3`
  - 可登录
  - 可读写本人周数据
  - 可在双人协同登录时读写同组第二个学生的周数据
  - 可提交 week 工作流
- `P2`
  - 可查看全体学生周数据
  - 可执行审核动作
  - 可录入岗位认证、课程评分、展示赛评分
  - 不可管理账号和课程配置
- `P1`
  - 全量权限

### Scope Rules

- `week` 和 `week_group`
  - `P3` 仅限自己的 scope 或 paired scope
  - `P2/P1` 可查看任意学生
- `foundation`
  - `P1` 可写课程配置、排班、账号
  - `P2/P1` 可读 foundation bootstrap
- `certification/course_score/showcase_score`
  - `P2/P1` 可写
  - `P3` 仅读与自己相关的数据

## Workflow Model

统一状态：

- `draft`
- `submitted`
- `approved`
- `rejected`
- `archived`

第一批接入对象：

- `weeks`
- `certifications`
- `course_scores`
- `showcase_scores`

动作边界：

- `P3` 可保存和提交 `week`
- `P2/P1` 可审核通过和驳回
- `P1` 可归档
- 导出行为不单独创建状态机，但写入审计日志

周数据继续保留现有分项确认逻辑，统一 workflow 只作用于整份 `week` 记录。

## Audit Log Model

新增 `audit_logs` 表，记录：

- `actor_username`
- `action`
- `resource_type`
- `resource_id`
- `target_scope`
- `before_status`
- `after_status`
- `detail_json`
- `created_at`

第一批审计动作：

- login
- logout
- create
- update
- submit
- approve
- reject
- archive
- delete
- export

## Data Model Changes

### New Tables

- `sessions`
- `audit_logs`

### Existing Tables Extended

- `weeks`
  - `workflow_status`
  - `submitted_at`
  - `submitted_by`
  - `reviewed_at`
  - `reviewed_by`
  - `review_comment`
- `certifications`
  - same workflow fields
- `course_scores`
  - same workflow fields
- `showcase_scores`
  - same workflow fields

## API Changes

### New Endpoints

- `POST /api/logout`
- `GET /api/session`
- `POST /api/workflows/submit`
- `POST /api/workflows/approve`
- `POST /api/workflows/reject`
- `POST /api/workflows/archive`

### Existing Endpoints Updated

- `/api/login`
  - 返回 session token 和 actor，不再仅返回 user
- 全部写接口
  - 改为 bearer session 认证
  - 统一 role + scope 校验
- `/api/bootstrap`
  - 不再返回明文密码
- `/api/accounts`
  - 不再返回密码字段

## Frontend Changes

- `api.js`
  - 管理 bearer token
  - 登录、会话恢复、登出
- `App.jsx`
  - 启动时调用 `/api/session`
  - 统一当前 actor 与 sessionUsers 来源
  - 请求失败遇到 401 时自动清理本地 session
- 页面显示统一 workflow 状态条
- 仅对允许的角色显示提交、审核、驳回、归档按钮

## Non-Goals

本轮不做：

- 密码哈希迁移
- 字段级权限
- 完整审批中心
- 驾驶舱页面
- PDF 导出

## Verification Strategy

- 后端单测覆盖：
  - session 登录/恢复/登出
  - P3 scope 访问限制
  - P2/P1 审核权限
  - workflow 状态迁移
  - audit log 写入
- 前端测试覆盖：
  - token 恢复
  - 401 自动清理
  - workflow 状态渲染辅助函数
- 全量验证：
  - `python3 -m unittest discover -s backend/tests -p 'test_*.py'`
  - `node --test frontend/tests/*.test.js`
  - `python3 -m compileall backend`
  - `npm run lint`
  - `npm run build`
