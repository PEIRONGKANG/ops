# Authentication Foundation Implementation Plan

> **For Codex:** Implement this plan using tests first. The former FastAPI plan was superseded on 2026-08-02; do not create or reuse a Python authentication application.

**Goal:** Deliver the new system's first backend slice: secure local account onboarding, P1 administration, authentication, and renewable browser sessions in a Java DDD modular monolith.

**Architecture:** A Spring Boot 3 modular monolith places the implemented identity-and-access bounded context in `apps/backend/identity-access`; its API adapter calls application use cases, which operate on domain aggregates through repository ports. `operations`, `learning`, `assessment`, and `ai-platform` are named future module boundaries only. All persistent state begins in new PostgreSQL tables created exclusively by Flyway; no legacy schema, SQLite file, PocketBase collection, data import, compatibility adapter, or dual write is permitted.

**Tech Stack:** Java 21, Spring Boot 3.4.5, Spring Security, Spring Data JPA, PostgreSQL 16, Flyway, JJWT, Argon2id, JUnit 5, MockMvc, Testcontainers, Maven Wrapper, Docker Compose. Spring AI BOM 1.0.0 is managed in Maven dependency management, without a provider, model client, API key, vector store, MCP client, or AI request path in this phase.

---

## 1. Delivery status and non-negotiable boundary

| Item | Decision |
| --- | --- |
| Status | Approved Java implementation baseline |
| Product basis | `docs/plans/2026-08-02-beverage-training-operations-system-design.md` — BR-GOV-02 and BR-AUD-01 |
| Implemented bounded context | `identity-access` |
| Future context boundaries | `operations`, `learning`, `assessment`, `ai-platform` |
| Legacy rule | `backend/`, `frontend/`, `training_frontend/`, existing SQLite/PocketBase records, and unmerged branches are read-only reference material |
| New-data rule | Flyway creates a fresh PostgreSQL schema; importing/mapping/copying old users, passwords, sessions, roles, or business facts is prohibited |
| AI rule | Spring AI is an architecture dependency boundary only; no AI provider integration is included in login phase |

The phase is complete when an applicant can request access, the deployment bootstrap operator can safely claim the first P1 account exactly once, a P1 can approve/reset/disable/reactivate accounts, and normal users can securely sign in, change temporary passwords, refresh a current-device browser session, and sign out.

## 2. Fixed business and security decisions

### 2.1 Identity and roles

- Local `loginId` (displayed as “学号或工号”) plus password is the only phase-one login method. A future `IdentityProviderPort` may support unified institutional identity without changing identity domain rules.
- Login IDs are Unicode NFKC normalized, trimmed, uppercased, and stored only in canonical form.
- Accounts may hold effective global assignments for `P1`, `P2`, `T1`, and `P3`; a future context uses scope fields for term, store, student, and shift authorization. API authorization always derives from server-side effective roles, never a browser-selected role.
- `EXTERNAL_REVIEWER` is a reserved code only. Invitation and login are deferred to the assessment phase.

### 2.2 Lifecycle and P1 bootstrap

| State | Sign in | Transitions |
| --- | --- | --- |
| `PENDING` | No | P1 approves or rejects the associated registration request. |
| `ACTIVE` | Yes | P1 resets password or disables the account. |
| `DISABLED` | No | P1 may reactivate it through an audited command; reactivation requires a password reset. |

- Public registration accepts `loginId` and `displayName` only. It never accepts roles, scopes, passwords, bootstrap secrets, or claimed privileges.
- P1 approval activates an account, assigns one or more P1–P3 roles, and returns one server-generated 18-character temporary password exactly once. Only its Argon2id hash persists; it is excluded from logs, audits, and later reads.
- Reset has the same temporary-password rule, sets `mustChangePassword`, increments authorization version, and revokes all refresh sessions.
- First P1 bootstrap requires all three deployment-provided values: allowed canonical login ID, temporary password, and a one-time bootstrap claim secret. Registration sends the claim secret only in the bootstrap request header; it is HMAC compared, never persisted or audited. Flyway creates the sole `system_bootstrap` row, and the use case locks that existing row before claiming it.
- Bootstrap is consumed exactly once and records only timestamp and target account ID. The public response never includes its password or claim secret.

### 2.3 Password, session, CSRF, and abuse rules

- Passwords must be 12–128 NFKC-normalized characters and must not equal the normalized login ID. Password hashes use Argon2id through Spring Security's `Argon2PasswordEncoder`.
- Normal login returns a 15-minute signed JWT access token in JSON plus a 7-day rotating opaque refresh cookie. Access tokens stay in frontend memory only.
- The refresh cookie is `ops_rt`, `HttpOnly`, `Secure` outside development, `SameSite=Lax`, `Path=/api/v1/auth`, and host-only. It has no JavaScript-readable domain override.
- Each refresh session has its own ID (`sid`) and belongs to a family (`fid`). Access JWTs contain `sub`, `sid`, `fid`, `av`, `typ=access`, `iat`, `exp`, and `jti`. Current-device bearer/logout revokes its `sid`; cookie logout also revokes the current `sid`, not unrelated devices.
- Refresh rotation replaces the session token atomically. Reuse of a prior/revoked refresh token revokes its entire `fid` and returns `401 REFRESH_REUSED`.
- Refresh and logout are cookie-backed state changes. Require an allowed `Origin` header validated against `AUTH_TRUSTED_ORIGINS`; reject absent/mismatched browser origins with `403 ORIGIN_INVALID`. Same-origin production is the default.
- A temporary-password sign-in returns only a 10-minute `typ=password_change` token, no refresh cookie. It can call change-password and logout only.
- Five failed attempts for either a HMACed canonical login ID or HMACed IP in 15 minutes cause `429 LOGIN_THROTTLED`; public failures use the same `LOGIN_INVALID` response.
- Any password reset, disable, reactivation, activation, or role change increments `authorizationVersion`, revokes all sessions, and appends an audit event.

## 3. Modular structure

```text
apps/backend/
  pom.xml
  mvnw
  .mvn/wrapper/
  src/main/java/com/beverageops/
    BootstrapApplication.java
    shared/{config,security,web}/
    identityaccess/
      domain/{model,port,service}/
      application/{command,query,usecase}/
      infrastructure/{persistence,security}/
      adapter/in/web/
    operations/README.md
    learning/README.md
    assessment/README.md
    aiplatform/README.md
  src/main/resources/{application.yml,db/migration/}
  src/test/java/com/beverageops/
compose.yaml
.env.example
```

Dependencies flow inward: web and persistence adapters depend on application/domain code; application depends on domain ports; domain has no Spring MVC/JPA/security imports. JPA entities are infrastructure records mapped to domain aggregates at repository boundaries.

## 4. Fresh schema and audit contract

All tables are Flyway-managed, use UUID IDs and UTC `timestamptz`, and contain `created_at`/`updated_at` when mutable.

| Table | Contract |
| --- | --- |
| `iam_accounts` | Canonical unique login ID, display name, status, nullable password hash only while pending, `must_change_password`, `authorization_version`, `last_login_at`, timestamps. |
| `iam_role_assignments` | Account, role, future scope fields, effective range, granting actor, revocation, timestamps; partial unique index prevents duplicate active grants. |
| `iam_registration_requests` | Pending/approved/rejected state, account and reviewer references, reason, timestamps. |
| `iam_refresh_sessions` | Session ID, account, family ID, HMAC token fingerprint, parent session, expiry, rotation/revocation metadata, authorization version snapshot, safe client metadata. |
| `iam_auth_events` | Append-only event type, actor, subject, request ID, HMAC IP, redacted safe metadata, timestamp. |
| `iam_login_throttle_windows` | HMAC key, failure counter, window and block timestamps; database upsert updates it atomically. |
| `iam_system_bootstrap` | Flyway-inserted singleton row, bootstrap consumption timestamp and account ID. |

Audits never contain passwords, temporary passwords, JWTs, refresh tokens, claim secrets, cookie values, or raw IP addresses. No endpoint deletes accounts, requests, sessions, grants, or audit events.

## 5. API contract

All routes begin `/api/v1`, use camelCase JSON, include `Cache-Control: no-store` for identity routes, and return errors as `{ "code", "message", "requestId" }`.

| Route | Rule |
| --- | --- |
| `POST /auth/registrations` | Accepts `loginId`, `displayName`; returns non-enumerating `202 {status:"pending"}`. Bootstrap additionally requires `X-Bootstrap-Claim`; it returns `201 {status:"bootstrapActivated"}` without secrets. |
| `POST /auth/login` | Normal active account returns access token/session payload and refresh cookie. Forced password change returns a restricted token with no cookie. Invalid/pending/disabled credentials return `401 LOGIN_INVALID`. |
| `POST /auth/change-password` | Requires a password-change token; returns normal session and sets the current-device refresh cookie. |
| `POST /auth/refresh` | Requires cookie and allowed `Origin`; rotates only current session and returns a new normal session payload/cookie. |
| `POST /auth/logout` | Requires allowed `Origin` if a refresh cookie is supplied; revokes resolved current `sid`, clears cookie, and is idempotent. |
| `GET /auth/me` | Requires a normal access token; reads account and effective roles from PostgreSQL. |
| `GET /admin/registration-requests` | P1-only paginated list of pending requests. |
| `POST /admin/registration-requests/{id}/approve` | P1-only; assigns permitted roles and returns temporary password once. |
| `POST /admin/registration-requests/{id}/reject` | P1-only audited rejection. |
| `POST /admin/accounts/{id}/reset-password` | P1-only temporary password and session revocation. |
| `POST /admin/accounts/{id}/disable` | P1-only disable and session revocation. |
| `POST /admin/accounts/{id}/reactivate` | P1-only reactivation plus one-time temporary password and session revocation. |

## 6. TDD implementation tasks

### Task 1: Scaffold a fresh Java modular monolith

**Files:** Create `apps/backend/pom.xml`, Maven Wrapper, `BootstrapApplication`, `application.yml`, `HealthController`, and `HealthControllerTest`; create `compose.yaml` and `.env.example` at repository root.

1. Write a MockMvc test expecting `GET /api/v1/health` to return `{ "status": "ok" }`.
2. Run it with Maven Wrapper and observe compilation/test failure before the controller exists.
3. Add only the Spring Boot web application and health adapter needed for the test to pass.
4. Add Maven dependency management for Spring AI BOM `1.0.0`, but no provider dependency or AI runtime wiring.
5. Verify the focused test, then the full Maven suite; commit `chore: scaffold spring ddd backend`.

### Task 2: Establish Flyway-only identity persistence

**Files:** Create identity domain value types/aggregates/ports, JPA persistence adapter, `V1__create_identity_access_schema.sql`, and Testcontainers schema tests.

1. Test first that Flyway creates a new database with bootstrap singleton, canonical account uniqueness, and no legacy table dependency.
2. Implement the migration and adapter mapping with no old-data reads/imports.
3. Verify Testcontainers tests and commit `feat: add fresh identity access schema`.

### Task 3: Implement registration and safe bootstrap claim

**Files:** Create registration use case, bootstrap secret port, REST adapter, and integration tests.

1. Test normal non-enumerating registration, invalid claim rejection, and concurrent bootstrap attempts producing exactly one P1.
2. Lock the Flyway-created singleton row in one transaction and HMAC-compare the deployment claim secret.
3. Verify no response, log, or audit metadata contains a bootstrap password/claim; commit `feat: add account registration bootstrap`.

### Task 4: Implement P1 identity governance

**Files:** Create P1 authorization adapter, account administration use cases/endpoints, temporary password generator, audit adapter, and integration tests.

1. Test P1-only approve/reject/reset/disable/reactivate behavior, including revocation and authorization-version changes.
2. Keep temporary passwords response-only and exclude all secrets from audit serialization.
3. Verify integration tests; commit `feat: add p1 identity governance`.

### Task 5: Implement authentication and current-device sessions

**Files:** Create password/token/session/throttle ports and adapters, login/change-password/me/refresh/logout REST endpoints, Spring Security configuration, and integration tests.

1. Test invalid/pending/disabled responses, restricted forced-change access, cookie rotation, refresh replay family revocation, current-device logout, and password reset invalidating an existing token.
2. Test trusted-origin enforcement for refresh/logout and five-attempt throttle semantics.
3. Verify focused and full suite; commit `feat: add secure identity sessions`.

### Task 6: Document and operationally verify the backend

**Files:** Update `README.md`; create `docs/runbooks/auth-bootstrap.md` and `docs/runbooks/auth-incident-response.md`.

1. Document new-only data setup, PostgreSQL startup on a non-conflicting local port, first-P1 claim handling, password delivery, session compromise response, and explicit prohibition on legacy import/direct SQL password changes.
2. Run full Maven tests, package build, and Docker Compose health check.
3. Commit `docs: add spring identity operations runbook`.

## 7. Acceptance cases

- A deployment operator can activate exactly one first P1 only with the configured identifier and claim secret; neither secret returns to the browser.
- P1 approval produces a one-time password and a user must change it before normal access.
- P1 reset, disable, role changes, and reactivation invalidate access on the next protected request and generate safe audit entries.
- A refresh cookie renews only the current device; old-token replay revokes the full family.
- A cross-origin refresh or cookie logout is rejected before a session mutation.
- Database startup and all test fixtures use only newly created PostgreSQL tables; legacy application code/data never participates.
