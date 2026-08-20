# 课程域受控媒体附件设计

## 1. 目标与范围

本设计补齐 `BR-CRS-01`、`BR-CRS-02` 中课程资料、课程任务提交和创意成果的真实二进制附件能力。附件复用已交付的服务器受控目录 `/data/beverage-ops/media`、类型/签名校验、后端流式鉴权读取和三天历史文件物理清理；PostgreSQL 只保存服务端生成的相对路径及版本元数据。

本轮不创建公开文件 URL，不兼容任何旧系统文件或数据，不迁移 SQLite、PocketBase、FastAPI 或旧前端记录；不接入对象存储、备份、病毒扫描和外部评审入口。反思文本继续作为结构化文本，不新增附件接口。

## 2. 附件宿主与权限

| 宿主 | 可写角色与状态 | 可读范围 | 不可变规则 |
| --- | --- | --- | --- |
| 教学资料 | 该学期的 P1/T1；仅 `DRAFT` | P1/T1 始终可读；P3 仅可读 `PUBLISHED` 资料 | 资料发布后不能新增、替换或撤回附件；需派生新草稿资料。 |
| 课程任务提交 | 创建该提交的 P3 | 提交创建者；`TEAM` 任务的同小组 P3；该学期 P1/T1 | 每个提交版本都是历史事实；附件变更只作用于该提交版本，且只能由创建者执行。 |
| 创意成果 | 该成果小组成员 P3；仅 `DRAFT` | 同小组 P3；该学期 P1/T1 | 发布后成果及附件只读；需创建/更新新的草稿成果，而不是修改已发布版本。 |

每个读取请求均重新校验上述范围；列表和下载不返回绝对文件系统路径。P3 无法通过猜测 UUID 获取其他学生、其他小组或未发布资料的附件。

## 3. 数据与生命周期

新增独立的 `learning_course_media_file_versions` 表。每个版本归属一个不可混淆的宿主类型：`TEACHING_MATERIAL`、`COURSE_TASK_SUBMISSION` 或 `CREATIVE_WORK`，并保存宿主 UUID、文件版本号、相对路径、原始展示文件名、安全扩展名、声明/检测 MIME、大小、SHA-256、状态、变更原因、创建/变更人、创建时间、清理时间和结果。

物理路径由服务端生成：

```text
course/{ownerType}/{ownerId}/v{version}/{storageUuid}.{safeExtension}
```

状态转换严格为：

```text
CURRENT → REPLACED → PURGED
CURRENT → WITHDRAWN → PURGED
```

一个宿主一次只能有一个 `CURRENT` 附件。替换和撤回必须提供 1–500 字符原因；历史物理内容三天后才可清理，版本元数据、哈希和审计永久保留。当前文件绝不被清理任务删除。

## 4. 共享存储边界

现有证据存储端口升格为共享的“受保护媒体存储”端口：调用方传入受控命名空间、宿主 UUID 和版本；基础设施适配器只生成相对路径、暂存、流式计算哈希、检查类型并原子发布。控制器和领域服务不得接触 `Path`。

证据使用命名空间 `evidence`，课程附件使用 `course/{ownerType}`；二者同样继承：图片/PDF/DOCX/XLSX/PPTX 最大 50 MB，MP4/WebM/MOV 最大 500 MB、OOXML 防解压炸弹/宏检查、无符号链接、`nosniff`、`no-store` 与视频单 Range 支持。

数据库提交失败时，事务完成回调补偿删除新发布文件；上传中断留下的 `.staging/*.part` 仍由运行手册规定的 24 小时人工清理，不与三天历史清理混用。

## 5. API 约定

所有 API 位于 `/api/v1` 并要求正常登录态：

| 宿主路由前缀 | 接口 |
| --- | --- |
| `/teaching-materials/{id}/files` | `POST` 上传、`GET` 列表、`GET /current` 下载、`POST /replace`、`POST /withdraw` |
| `/course-task-submissions/{id}/files` | 同上 |
| `/creative-works/{id}/files` | 同上 |

上传及替换是单文件 `multipart/form-data` 的 `file` 字段；替换/撤回额外要求 `reason`。文件响应仅包含版本元数据（包括受控相对路径，供审计与前端版本识别），下载始终通过后端且使用 `Content-Disposition: attachment`。视频接收单个 `Range`，非法或越界返回 `416`。

## 6. 审计、清理与验收

审计事件为 `COURSE_MEDIA_FILE_UPLOADED`、`COURSE_MEDIA_FILE_REPLACED`、`COURSE_MEDIA_FILE_WITHDRAWN`、`COURSE_MEDIA_FILE_ACCESSED`、`COURSE_MEDIA_FILE_PURGED`。清理任务与证据清理一并扫描课程媒体到期版本，单条失败记录 `DELETE_FAILED` 且不阻塞其他记录。

验收覆盖：P1/T1 在草稿资料上传并在发布后只读；P3 对自己提交/同组成果按范围操作；无关 P3 和跨学期 T1 受 `403`；发布的创意/资料无法修改附件；替换/撤回保留版本；无效类型不留数据库或物理文件；下载/视频 Range 有安全响应头；过期历史文件清理但当前文件、审计和元数据保留。

## 7. 仍开放的边界

本设计不关闭 DQ-05、DQ-06 或 DQ-07。课程附件可被内部成果包的未来导出引用，但外部评审可见性、五年后归档位置和销毁审批仍不得由本实现推断。
