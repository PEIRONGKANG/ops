# 身份认证首次启动手册

本手册仅适用于 `renovate` 分支的全新 Spring DDD 后端。它只使用 Flyway 创建的 PostgreSQL 表；不得读取、导入或映射仓库中的 SQLite、PocketBase、FastAPI 或旧前端数据。

## 1. 准备新环境

1. 从 `.env.example` 复制为本机受保护的 `.env`，不要提交该文件。
2. 为 `POSTGRES_PASSWORD` 设置新的数据库密码。
3. 生成不同且均不少于 32 字符的 `AUTH_JWT_SECRET` 与 `AUTH_TOKEN_HMAC_SECRET`；密钥不得写入代码、日志、工单或浏览器。
4. 设置首位 P1 的规范化工号、一次性初始密码和一次性 `AUTH_BOOTSTRAP_P1_CLAIM_SECRET`。初始密码必须满足 12–128 个 NFKC 字符且不能等于工号。
5. 配置 `AUTH_TRUSTED_ORIGINS` 为允许读取带凭据响应的前端 Origin（逗号分隔）。生产环境应使用 HTTPS 且保持 `AUTH_SECURE_COOKIES=true`。

启动 PostgreSQL 与后端：

```bash
docker compose up -d --build
curl --fail http://localhost:18080/api/v1/health
```

PostgreSQL 使用宿主机端口 `55433`，避免干扰旧系统默认端口。Flyway 自动创建新表，严禁通过直接 SQL 写入账户密码或会话。

## 2. 安全领取唯一 P1

使用受控管理终端调用一次，不要在浏览器历史、shell history、聊天记录或日志中保存临时密码与领取密钥：

```http
POST /api/v1/auth/registrations
X-Bootstrap-Claim: <AUTH_BOOTSTRAP_P1_CLAIM_SECRET>
Content-Type: application/json

{"loginId":"<AUTH_BOOTSTRAP_P1_LOGIN_ID>","displayName":"首位管理员姓名"}
```

成功只会返回 `201 {"status":"bootstrapActivated"}`，不会回传任何部署密钥或临时密码。Flyway 建立的单例记录锁定后只能成功一次。首位 P1 以部署配置中的临时密码登录，并必须立即通过 `POST /api/v1/auth/change-password` 修改。

领取后，立即从运行环境安全移除 `AUTH_BOOTSTRAP_P1_CLAIM_SECRET` 和 `AUTH_BOOTSTRAP_P1_TEMP_PASSWORD`，然后滚动重启后端。保留 JWT 与 HMAC 密钥。

## 3. 帐号审批与密码交付

普通人员仅提交工号/学号与姓名，状态为 `PENDING`。P1 通过管理接口批准时，系统生成 18 字符临时密码；此密码仅在该次响应中出现一次。

- 只通过经批准的线下或安全渠道交付临时密码；不要转存到数据库、审计事件、截图、邮件群发或聊天群。
- 用户使用临时密码登录后只能调用改密与登出；改密成功才创建正常浏览器会话。
- 重置密码、禁用、重新启用和角色变更都会立即吊销已有会话；要求用户重新登录。

## 4. 前端对接约定

- `POST /api/v1/auth/login` 返回 15 分钟 access token（仅保存在前端内存）和 `ops_rt` HttpOnly 刷新 Cookie。
- 使用 Cookie 的 `/refresh` 与 `/logout` 必须携带受信任的 `Origin`；浏览器请求需 `credentials: 'include'`。
- access token 使用 `Authorization: Bearer <token>`；不能写入 `localStorage`、`sessionStorage` 或持久化状态库。
- 认证与管理响应均含 `Cache-Control: no-store`；CORS 只向 `AUTH_TRUSTED_ORIGINS` 配置的前端 Origin 开放带凭据读取。

## 5. 运行前检查

```bash
cd apps/backend
export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
./mvnw test
./mvnw package
```

上线前应确认：未迁移任何旧业务记录；生产 Cookie 为 Secure；所有环境变量来自受控密钥管理；前端 Origin 已精确配置。
