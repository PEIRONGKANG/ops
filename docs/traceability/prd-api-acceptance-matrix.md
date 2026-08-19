# PRD 后端实现追踪矩阵

更新时间：2026-08-18

基线：`docs/plans/2026-08-02-beverage-training-operations-system-design.md`

实施计划：`docs/plans/2026-08-12-prd-backend-delivery.md`

## 1. 审计结论

当前后端**尚未完成全部 PRD**。Task 1–5 已形成日常运营主链路；Task 6 已实现反馈、补训、复测和通用岗位认证闭环，但 DQ-05 的正式教学规则与 BR-EDU-04 的红线自动联动尚未确认/实现；Task 7–8 已实现课程筹备、成果包、内部评分及成绩发布闭环。Task 9–11 仍未全部实施。

本矩阵只认定当前 Java 21、Spring Boot 3.4.5、PostgreSQL/Flyway 模块化单体。系统从空 PostgreSQL 模式启动，不读取、不迁移、不双写、不兼容 SQLite、PocketBase、FastAPI 或旧前端业务数据。

状态定义：

- `完成`：已有后端接口、状态/权限实现和自动化测试证据。
- `部分完成`：主能力已实现，但仍有明确 PRD 子项或非功能要求未覆盖。
- `未开始`：尚无对应业务表、应用服务和 API。
- `阻塞`：必须先关闭 PRD 待决项，开发人员不得自行假设。

## 2. 业务规则追踪

| 规则 | 状态 | 当前接口/实现 | 自动化验收证据 | 缺口或限制 |
| --- | --- | --- | --- | --- |
| BR-GOV-01 | 完成 | `/admin/terms`、教学周、门店、成员关系、学期发布/归档 | `GovernanceControllerIntegrationTest` | 归档策略本身尚未成为独立版本化配置，长期归档见 BR-ARC。 |
| BR-GOV-02 | 完成 | 身份管理、角色分配、团队、成员关系、运营范围授权 | 身份集成测试、`GovernanceControllerIntegrationTest`、`OperationsSchedulingIntegrationTest` | 当前使用本地统一账号实现；学院统一认证仍属 DQ-01 的未来替换边界。 |
| BR-GOV-03 | 完成 | 版本化岗位/班次/SOP/节点/异常/认证模板及正式评分量规；量规有谱系修订号与 `effectiveAt`，已发布版本仅可派生新草稿 | `GovernanceControllerIntegrationTest`、`AssessmentPortfolioIntegrationTest`（6 项） | 评分具体权重由 P1 创建时配置，未内置 DQ-05 默认值。 |
| BR-GOV-04 | 完成 | 运营日保存已发布模板快照，班次任务/节点由快照展开 | `OperationsSchedulingIntegrationTest`、`ShiftExecutionIntegrationTest` | — |
| BR-GOV-05 | 完成 | `/admin/audit-events`、`/admin/change-records` | `GovernanceControllerIntegrationTest` | 审计为追加写，普通业务无删除接口。 |
| BR-SHF-01 | 部分完成 | 运营日、班次、范围、时间冲突、排班 | `OperationsSchedulingIntegrationTest`、`OperationsDashboardIntegrationTest` | 缺岗识别主要依赖今日工作台，尚无按模板岗位配额的完整缺岗规则。 |
| BR-SHF-02 | 部分完成 | 班次岗位分配与变更 | `OperationsSchedulingIntegrationTest` | 已有岗位和班次时段；职责、到岗要求、显式交接关系主要来自模板/交接对象，未作为分配记录的结构字段完整建模。 |
| BR-SHF-03 | 完成 | 岗位变更原因、历史、通知 | `OperationsSchedulingIntegrationTest`、`NotificationIntegrationTest` | — |
| BR-SHF-04 | 完成 | `/me/shifts`、`/me/shifts/{id}` | `OperationsSchedulingIntegrationTest` | — |
| BR-SHF-05 | 完成 | 取消要求原因，记录保留，不提供删除 | `OperationsSchedulingIntegrationTest` | — |
| BR-OPS-01 | 完成 | `/me/operations-dashboard` | `OperationsDashboardIntegrationTest` | 前端移动端呈现不属于本次后端审计。 |
| BR-OPS-02 | 部分完成 | 模板 SOP 展开为岗位任务，可配置证据和 P2 验收 | `ShiftExecutionIntegrationTest` | 任务时间段和认证关联尚未形成可查询的正式关系。 |
| BR-OPS-03 | 完成 | 任务提交、撤回、P2 退回/通过 | `ShiftExecutionIntegrationTest` | — |
| BR-OPS-04 | 部分完成 | 文本、外链、经营摘要引用、对象引用元数据 | `ShiftExecutionIntegrationTest` | 照片/文件二进制上传、下载及媒体安全访问受 DQ-02 阻塞。 |
| BR-OPS-05 | 部分完成 | 任务/节点历史和证据元数据保留 | `ShiftExecutionIntegrationTest` | 现有证据仅创建，无完整证据替换/撤回版本 API。 |
| BR-OPS-06 | 完成 | `/operations/today` | `OperationsDashboardIntegrationTest` | — |
| BR-DATA-01 | 完成 | 经营摘要及 JSON 摘要行 | `OperationalRiskIntegrationTest` | 金额、成本、损耗等只保存外部摘要，不成为订单/库存事实源。 |
| BR-DATA-02 | 完成 | 来源系统、采集方式、引用、采集人、时间 | `OperationalRiskIntegrationTest` | — |
| BR-DATA-03 | 完成 | `PENDING_SUPPLEMENT`，不以零值伪造 | `OperationalRiskIntegrationTest` | — |
| BR-DATA-04 | 部分完成 | P2 确认经营摘要 | `OperationalRiskIntegrationTest` | P1 的展示字段/异常阈值仅可放入通用模板 JSON，尚无专门校验与分析。 |
| BR-EDU-01 | 完成 | `POST/GET/PATCH /feedback`、`GET /me/feedback` | `LearningProgressIntegrationTest`（15 项） | 反馈引用会校验班次、任务、异常、证据及学生关系。 |
| BR-EDU-02 | 完成 | `POST/GET/PATCH /retraining` 及提交、请求复测、记录复测 | `LearningProgressIntegrationTest`（15 项） | 状态为 `PENDING → SUBMITTED → RETEST_PENDING → PASSED/RETRAIN_REQUIRED`；补训证据可来自同学期同门店的后续岗位班次。 |
| BR-EDU-03 | 部分完成 | 认证规则快照、`POST/GET/PATCH /certifications`、不可覆盖决定 | `GovernanceControllerIntegrationTest`（7 项）、`LearningProgressIntegrationTest`（15 项） | 已强制规则包含授权决定角色、证据数与复测要求；通过时校验证据、同范围已通过补训及数据库关联一致性。DQ-05 尚未给出正式岗位达标条件、补训时限及量规权重，因此不能认定完整教学认证制度完成。 |
| BR-EDU-04 | 部分完成 | 支持反馈触发补训、再次补训，不含现金处罚或硬编码扣分 | `LearningProgressIntegrationTest` | “红线事项自动触发”尚未由异常类别规则自动执行；需后续规则联动。 |
| BR-EDU-05 | 完成 | `/me/learning-growth` | `LearningProgressIntegrationTest`（15 项） | — |
| BR-CRS-01 | 完成（受 DQ-02 限制） | `POST/GET/PATCH /teaching-materials`、发布与学习确认；`POST/GET/PATCH /course-tasks` 与学生提交历史 | `CoursePreparationIntegrationTest`（4 项） | 教学资料、调研、方案、配方、特殊物料和海报均以 JSON/受控对象引用元数据保存；真实文件二进制上传与受控下载仍受 DQ-02 阻塞。 |
| BR-CRS-02 | 完成 | `POST/GET/PATCH /creative-works`、版本历史、教师反馈、发布 | `CoursePreparationIntegrationTest`（4 项） | 强制学期、教学周和小组归属；P3 仅可读取本组草稿，发布后不可原地修改。 |
| BR-CRS-03 | 完成 | 学生/小组成果包快照汇总轮值任务、已发布创意、已提交反思、课程提交、认证、带教反馈、补训及受控证据元数据；生成不修改来源事实 | `CoursePreparationIntegrationTest`、`AssessmentPortfolioIntegrationTest`（6 项） | “小组优化方案”目前以课程任务/创意成果版本事实承载，未另建重复资源。 |
| BR-CRS-04 | 部分完成 | P1 可按学期列出学生/小组成果包，并读取已生成成果包的内部 JSON 导出清单；读取行为写审计 | `AssessmentPortfolioIntegrationTest`（6 项） | 可打印版与长期归档导出由 Task 9/DQ-07 处理；未实现外部公开导出。 |
| BR-ASM-01 | 完成 | `POST/GET/PATCH /rubric-versions`、发布和 `/derive`；维度、权重、满分、及格分、允许评分角色及生效时间均为版本事实 | `AssessmentPortfolioIntegrationTest`（6 项） | 具体评分权重仍由 P1 配置，未自行填充 DQ-05 默认规则。 |
| BR-ASM-02 | 部分完成 | P2/T1 需处于学期成员范围、持有授权评分授予且仅能在允许的维度评分；记录保存 `sourceRole` | `AssessmentPortfolioIntegrationTest`（6 项） | 外部评审来源受 DQ-06/Task 9 阻塞。 |
| BR-ASM-03 | 完成（内部） | 已提交的 P2/T1 分维度评分按 `score / maxScore × weight` 确定性汇总建议成绩；P1 发布最终成绩 | `AssessmentPortfolioIntegrationTest`（6 项） | 认证结论在学习域保持独立事实，未以未确认的 DQ-05 规则推断新结论。 |
| BR-ASM-04 | 完成 | 发布后只读；更正创建新的已发布版本，保留根结果、前序版本、理由、发布人和时间，并拒绝从历史版本分叉 | `AssessmentPortfolioIntegrationTest`（6 项） | — |
| BR-ASM-05 | 阻塞 | — | — | 外部评审入口属于 Task 9，必须先关闭 DQ-06。 |
| BR-COM-01 | 部分完成 | 站内通知及读状态，成绩发布/更正通知学生 | `NotificationIntegrationTest`、业务集成测试、`AssessmentPortfolioIntegrationTest` | 已覆盖排班/退回/异常/交接/反馈/补训/认证/评分发布等核心事件；超期定时通知尚未实现。 |
| BR-COM-02 | 完成 | `/notifications`、单条/全部已读、WebSocket 事件 | `NotificationIntegrationTest`、实时测试 | WebSocket 建连后 token 过期、登出、账号禁用或授权版本变化不会主动断开，属于实时层待加固项。 |
| BR-AUD-01 | 部分完成 | 治理、运营、学习、正式量规、成果包生成/发布/内部导出、评分、成绩发布及更正均写追加审计 | 各资源集成测试、`CoursePreparationIntegrationTest`、`AssessmentPortfolioIntegrationTest` | 外部评审和合规归档审计待 Task 9。 |
| BR-ARC-01 | 未开始 | 学期可标记归档，但不等同 5 年合规归档 | `GovernanceControllerIntegrationTest` 仅覆盖学期状态 | 独立留存期计算、只读归档状态和禁止普通修改属于 Task 9；制度细节受 DQ-07 约束。 |
| BR-ARC-02 | 未开始 | — | — | 归档检索、导出清单和审计属于 Task 9。 |

## 3. 后端交付任务状态

| 任务 | 状态 | 说明 |
| --- | --- | --- |
| Task 1 治理与审计 | 完成 | 学期、周、门店、团队、成员、模板组件和审计已实现。 |
| Task 2 运营日、班次与排班 | 完成 | 生命周期、范围、冲突、个人班次已实现。 |
| Task 3 SOP、证据元数据和关键签核 | 完成（受 DQ-02 限制） | 文字/链接/引用元数据和关键节点已实现；二进制媒体未实现。 |
| Task 4 经营摘要、异常和交接 | 完成 | 运行风险闭环和关闭守卫已实现。 |
| Task 5 通知、工作台和实时事件 | 完成（有加固项） | 主功能已实现；连接存续期授权撤销需后续加固。 |
| Task 6 反馈、补训和认证 | 部分完成 | 已交付创建/修改/查询、权限、关联一致性、P2/T1 规则授权、版本冲突和学生成长视图；正式 DQ-05 认证条件/补训时限/量规权重与红线自动补训联动尚未交付。 |
| Task 7 课程资料、筹备与创意成果 | 完成（受 DQ-02 限制） | 已交付课程资料发布/确认、任务与版本化提交、小组创意成果、教师反馈、发布和个人反思；文件只保存对象引用元数据。 |
| Task 8 量规、评分、成果包和成绩 | 完成 | 已交付量规谱系/生效时间、P2/T1 授权维度评分、确定性建议成绩、来源快照成果包、P1 内部发布、更正线性版本、学生只读结果和内部导出清单。 |
| Task 9 外部评审、归档和导出 | 阻塞/未开始 | 外部评审受 DQ-06 阻塞；内部归档契约仍可在决策后拆分实施。 |
| Task 10 对象存储与媒体安全访问 | 阻塞 | 受 DQ-02 阻塞。 |
| Task 11 全量验收与追踪 | 进行中 | 本矩阵已建立；全量端到端验收须在 Tasks 7–10 完成后关闭。 |

## 4. 业务验收场景状态

| 场景 | 状态 | 证据/缺口 |
| --- | --- | --- |
| 完整班次 | 完成 | 排班、任务、证据元数据、节点、经营摘要、异常、交接和关闭守卫均有集成测试。 |
| 异常闭环 | 完成 | 上报、知悉、指派、验证、退回、关闭、复开和豁免均有测试。 |
| 带教与补训 | 部分完成 | `LearningProgressIntegrationTest` 覆盖反馈、补训提交、复测、认证与学生下一步；认证执行的是 P1 发布的通用结构规则，正式 DQ-05 条件及红线自动触发仍未确定。 |
| 排班变更 | 完成 | 变更原因、历史与通知已覆盖。 |
| 成果与评分 | 完成（内部） | `AssessmentPortfolioIntegrationTest` 覆盖量规发布/派生、维度授权、建议成绩、成果包事实快照、内部导出、发布、更正及学生可见范围；外部评审仍由 Task 9 / DQ-06 阻塞。 |
| 外部评审 | 阻塞 | Task 9 / DQ-06。 |
| 五年归档 | 未开始 | Task 9 / DQ-07。 |

## 5. 待决项与下一步

| 待决项 | 当前影响 |
| --- | --- |
| DQ-01 统一身份 | 当前本地账号满足一期；若切学院统一认证，应替换身份适配器，不改业务账号 UUID 边界。 |
| DQ-02 对象存储 | 阻塞真实照片/文件上传、受控下载、备份和媒体域名。 |
| DQ-03 试点数据 | 不阻塞开发；系统不内置业务种子，P1 通过 API 新建。 |
| DQ-04 外部经营数据 | 当前用通用摘要契约，不阻塞；真实连接器和凭证格式待定。 |
| DQ-05 默认规则 | 通用认证规则结构已实现并由 P1 发布（授权角色、证据要求/数量、复测要求）；仍阻塞正式岗位达标条件、补训时限和评分量规权重的确认，不能由开发填充默认值。 |
| DQ-06 外部评审策略 | 阻塞公开/邀请评审入口。 |
| DQ-07 五年后制度 | 阻塞最终销毁/续存流程；不应由开发自行假设。 |

下一步不可自行启动 Task 9 的外部评审，因为 DQ-06 尚未确认。可在不触及邀请策略的前提下补做 Task 11 的全量验收追踪；对象存储与五年归档分别继续受 DQ-02、DQ-07 约束。Task 8 未填充 DQ-05 默认评分权重，全部权重均由 P1 创建量规时配置。
