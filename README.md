# 饮品生产性实训基地数字化运营系统

`renovate` 是全新系统的发布分支，后端采用 Java 21、Spring Boot 3.4、Spring Security、Flyway、PostgreSQL 和 DDD 模块化单体架构。Spring AI 1.0 仅作为依赖管理基线，本期不接入任何 AI 供应商或模型。

本分支不迁移、不兼容旧 FastAPI、SQLite、PocketBase、旧前端或旧业务记录。数据库从 Flyway `V1` 开始初始化，业务事实只写入 PostgreSQL；证据二进制对象在对象存储决策（DQ-02）确认前不落本地文件系统。

## 目录

- `apps/backend`：Spring DDD 后端
- `docs/plans`：产品设计、后端交付计划与待决项
- `docs/traceability`：PRD 到接口、规则和验收测试的追踪矩阵
- `docs/runbooks`：认证启动和安全事件运行手册
- `compose.yaml`：PostgreSQL 与后端本地编排

## 本地验证

```bash
cd apps/backend
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
./mvnw test
./mvnw package
```

需要 PostgreSQL 16（或使用 Testcontainers）。复制 `.env.example` 为 `.env` 后，可通过 `docker compose up --build` 启动全新数据库和后端。

## 当前交付边界

已覆盖内部身份、治理、排班与班次执行、证据元数据、异常与交接、通知与实时状态、带教反馈与补训、课程筹备、内部量规评分、成果包和成绩发布。

PRD 尚未全部完成：真实对象存储与媒体下载（DQ-02）、正式认证参数和红线联动（DQ-05）、外部评审门户（DQ-06）、五年只读归档（DQ-07），以及追踪矩阵中标记为“部分完成/未开始”的细项。前端可以基于已交付的内部接口实现日常运营、课程和内部评价流程；上述能力应显示为待决或禁用状态。
