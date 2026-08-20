# 服务端媒体文件存储设计

## 1. 决策与范围

本设计关闭 PRD 的 DQ-02（一期媒体存储部分）。系统不接入对象存储服务、病毒扫描服务或备份服务。证据、课程资料、创意成果等二进制文件由后端写入部署服务器的受控文件系统；PostgreSQL 只保存相对路径及元数据，绝不保存绝对路径或二进制内容。

生产根目录固定为：

```text
/data/beverage-ops/media
```

运行时必须通过 `BEVERAGE_OPS_MEDIA_ROOT` 显式配置。默认值仅用于本地开发，生产环境缺失该配置时应用应拒绝启动，避免误写到代码目录或临时目录。

本期范围仅包含已实现的运营证据（`ops_evidence`）文件上传、查看、替换、撤回与清理。课程资料、创意成果及其他域可复用同一存储端口和规则，但不在本轮新增其上传 API。

## 2. 允许文件与限制

| 类别 | 允许扩展名 | 最大大小 | 响应行为 |
| --- | --- | ---: | --- |
| 图片 | `.jpg`、`.jpeg`、`.png`、`.webp` | 50 MB | 受控预览或下载 |
| 文档 | `.pdf`、`.docx`、`.xlsx`、`.pptx` | 50 MB | 强制下载（PDF 可由前端选择预览） |
| 视频 | `.mp4`、`.webm`、`.mov` | 500 MB | 支持 HTTP `Range` 分段读取 |

以下格式一律拒绝：`.doc`、`.xls`、`.ppt`、`.docm`、`.xlsm`、`.pptm`，以及所有未列入白名单的格式。后端同时校验扩展名、客户端声明 MIME 类型和文件签名/容器结构；对 Office Open XML 文件验证 ZIP 容器且不得包含宏部件。前端文件名仅作展示，不参与服务器路径生成。

不接入病毒扫描是已确认的一期风险。服务端仍必须实施类型白名单、大小上限、内容嗅探、路径隔离和受控访问。

## 3. 数据与文件布局

新迁移在 `ops_evidence` 之外建立不可覆盖的 `ops_evidence_file_versions`：每次上传、替换、撤回和清理均形成可审计版本事实。

数据库字段包括：版本 UUID、evidence UUID、版本号、相对路径、原始文件名、允许 MIME、字节数、SHA-256、状态、替换/撤回原因、上传人、时间、`purge_after`、清理时间及清理结果。相对路径必须满足下面的受控格式：

```text
evidence/{evidenceId}/v{version}/{storageUuid}.{safeExtension}
```

后端以 `mediaRoot.resolve(relativePath).normalize()` 解析路径，并在每次读取、移动或删除前确认结果仍位于 `mediaRoot` 内且路径各层不存在符号链接。文件先写入同一文件系统下的 `.staging/{uploadUuid}.part`，校验和计算完成后原子移动到正式路径；失败时仅清理临时文件，绝不产生半完成的数据库当前版本。数据库事务最终回滚时必须补偿删除刚发布的新文件。

数据库只标识逻辑状态：

```text
CURRENT → REPLACED → PURGED
CURRENT → WITHDRAWN → PURGED
```

`REPLACED`/`WITHDRAWN` 的物理文件保留三天，当前版本绝不自动清理。即便物理文件已 `PURGED`，版本元数据、原因、哈希和审计事件仍长期保留；这不改变 PRD 的五年归档业务要求，DQ-07 仍待决。

## 4. 领域端口、授权与接口

`operations` 应新增文件存储端口，应用服务只通过该端口执行暂存、提交、流式读取和删除；本地文件系统适配器位于基础设施层。端口传递受控的 `StoredEvidenceFile` 值对象，不暴露 `java.nio.file.Path` 给控制器、用例或响应 DTO。

文件写入沿用证据归属权限：P3 只能对自己被分配的任务及所在班次的可写节点上传；P2 仅能在其门店/学期范围内操作；P1 可全局操作。查看与下载必须在每个请求上重新校验证据与班次范围，不能依赖猜测的文件 URL。所有读取写入、替换、撤回和清理都写追加审计；读取还需记录访问审计。

拟定接口如下：

| 接口 | 权限与行为 |
| --- | --- |
| `POST /api/v1/evidence/{evidenceId}/files` | Multipart 上传；创建当前文件版本。证据不存在、无权限、非 `OBJECT_REFERENCE` 或已有当前文件时失败。 |
| `GET /api/v1/evidence/{evidenceId}/files/current` | 鉴权后以流响应当前文件；支持视频 `Range`，不提供静态目录 URL。 |
| `POST /api/v1/evidence/{evidenceId}/files/replace` | Multipart 上传 + 必填替换原因；旧当前版本转 `REPLACED` 并在三天后可清理。 |
| `POST /api/v1/evidence/{evidenceId}/files/withdraw` | 必填撤回原因；当前版本转 `WITHDRAWN` 并在三天后可清理。 |
| `GET /api/v1/evidence/{evidenceId}/files` | 仅受权角色查看版本元数据与状态；不向 P3 暴露他人无关证据。 |

上传事务采用“先安全落临时文件，再写库，再原子发布文件”的补偿策略：任何数据库失败必须删除暂存/正式新文件；任何发布失败不得创建当前版本。当前实现通过事务完成回调补偿提交失败；下一次存储适配器演进可将暂存与发布端口完全拆分，以缩短大文件上传期间的数据库锁持有时间。一次请求只允许一个文件。服务端生成 UTF-8 编码的 `Content-Disposition`，并设置 `X-Content-Type-Options: nosniff`、`Cache-Control: no-store`。

## 5. 清理与运行约束

每天一次的 Spring `@Scheduled` 任务查询 `purge_after <= now()` 且状态为 `REPLACED` 或 `WITHDRAWN` 的版本。任务逐条在事务中锁定记录，删除受控根目录下的物理文件，并把状态更新为 `PURGED`。文件已不存在时也完成状态转换并记录 `MISSING_ON_PURGE`，保证任务可重试、幂等且不阻塞其余清理项。

一期不做媒体目录或 PostgreSQL 备份。服务器磁盘损坏将导致文件不可恢复；该风险应在部署运行手册与 README 中明确。不得用清理任务删除当前版本，也不得用其实现五年归档或普通业务删除。

## 6. 验收场景

1. P3 可向自己在进行中班次的 `OBJECT_REFERENCE` 证据上传合法图片，数据库只写相对路径，物理文件位于根目录下，哈希/大小匹配。
2. 上传 `.docm`、伪造图片 MIME、超过限制的文件或 ZIP 宏部件均返回 400，且不留正式文件或数据库版本。
3. 未分配 P3、无范围 P2 和无关账户不能上传、列出或下载文件；无静态 URL 可绕过授权。
4. 合法视频读取 `Range: bytes=0-1023` 返回 `206`、正确 Content-Range 与相应字节；非视频完整受控下载保持 MIME 与安全头。
5. 替换必须提供原因，新版本为 `CURRENT`，旧版本为 `REPLACED` 且 `purge_after` 为三天后；撤回遵循同样规则。
6. 清理任务不会删除 `CURRENT` 文件；到期的已替换/已撤回文件只删除物理内容并标记 `PURGED`，审计与版本元数据仍可查询。

## 7. 已关闭与仍开放的待决项

DQ-02 一期媒体存储决策已关闭：本地服务器受控目录、`/data/beverage-ops/media`、无备份、无病毒扫描、三天历史文件清理、后端授权读取。

DQ-07（五年期满后的归档位置、续存/销毁和隐私审批）仍未关闭。本设计不允许以三天清理为理由删除当前有效证据，也不允许减少业务档案五年在线保留要求。
