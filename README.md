# 饮品生产性实训基地数字化运营系统

`renovate` 是全新系统的发布分支，后端采用 Java 21、Spring Boot 3.4、Spring Security、Flyway、PostgreSQL 和 DDD 模块化单体架构。Spring AI 1.0 仅作为依赖管理基线，本期不接入任何 AI 供应商或模型。

本分支不迁移、不兼容旧 FastAPI、SQLite、PocketBase、旧前端或旧业务记录。数据库从 Flyway `V1` 开始初始化；业务事实和媒体版本元数据写入 PostgreSQL，证据二进制对象写入受控服务器目录。

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

PRD 尚未全部完成：正式认证参数和红线联动（DQ-05）、外部评审门户（DQ-06）、五年只读归档（DQ-07），以及追踪矩阵中标记为“部分完成/未开始”的细项。前端可以基于已交付的内部接口实现日常运营、课程和内部评价流程；上述能力应显示为待决或禁用状态。

## 证据媒体存储

生产环境必须设置 `BEVERAGE_OPS_MEDIA_ROOT=/data/beverage-ops/media` 及 `BEVERAGE_OPS_MEDIA_PRODUCTION=true`。PostgreSQL 只保存服务端生成的相对路径、哈希和版本元数据；媒体目录没有静态 URL，上传与下载均通过后端再次鉴权。

- 允许图片：JPG/JPEG、PNG、WebP；文档：PDF、DOCX、XLSX、PPTX；视频：MP4、WebM、MOV。
- 图片/文档上限 50 MB，视频上限 500 MB；后端同时验证扩展名、声明 MIME、签名和无宏 OOXML 容器。
- Multipart 层允许单个文件最大 500 MB、单个请求最大 501 MB；图片和文档的 50 MB 上限仍由媒体类型校验强制执行。
- 旧 Office、宏 Office 及其他文件类型会被拒绝；本期没有病毒扫描和备份服务。
- 被替换或撤回的文件保留三天后由定时任务删除物理内容，版本元数据和审计继续保留；当前文件永不被该任务删除。

部署、恢复限制与故障处理见 [媒体存储运行手册](docs/runbooks/media-storage.md)。
