# Authentication Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the new system's first end-to-end authentication slice: account application, P1 approval, first-password change, sign-in, refresh, sign-out, and role-aware frontend entry.

**Architecture:** Build a clean, parallel application in `apps/api` and `apps/web`; the current `backend`, `frontend`, SQLite data, PocketBase integration, and the unmerged PostgreSQL migration branch remain read-only reference material. FastAPI exposes same-origin `/api/v1` resources backed by a new PostgreSQL schema. React holds a short-lived access token only in memory; a rotating opaque refresh token lives only in an HttpOnly cookie.

**Tech Stack:** React 19, TypeScript, Vite, React Router, TanStack Query, Vitest, Playwright; FastAPI, SQLAlchemy 2, Alembic, Pydantic 2, PyJWT, pwdlib Argon2id, pytest, PostgreSQL 16, Docker Compose, Nginx.

---

## 1. Status, basis, and delivery boundary

| Item | Decision |
| --- | --- |
| Status | Approved implementation baseline; no implementation completed yet |
| Product basis | `docs/plans/2026-08-02-beverage-training-operations-system-design.md` |
| Product requirements traced | BR-GOV-02, BR-AUD-01, and the role/range rules in sections 4.0-4.1 |
| Delivery boundary | Authentication and onboarding only; no shift, course, evidence, scoring, media, or WebSocket business feature |
| Data start | New PostgreSQL database only; do not import SQLite or PocketBase accounts, passwords, sessions, or business records |
| Legacy code | Do not modify `backend/`, `frontend/`, or `training_frontend/` as part of this slice |

The slice is complete only when a new user can request access, a P1 can approve the request and obtain a one-time temporary password, the user can change it on first sign-in, and then use a browser session that survives an access-token refresh but can be revoked.

## 2. Fixed product and security rules

### 2.1 Identity and roles

- The sole login identifier is `loginId`, displayed to users as "学号或工号". It is normalized with Unicode NFKC, trimmed, and compared case-insensitively; the canonical stored form is uppercase.
- An account has one or more active roles: `P1`, `P2`, `T1`, or `P3`. A role assignment is server-owned; the browser never sends a selected role to obtain extra authority.
- This slice enforces only global assignments. The schema includes `scopeType`, `scopeId`, `effectiveFrom`, and `effectiveUntil` so later term/store/shift grants do not require an authentication redesign.
- `EXTERNAL_REVIEWER` exists as a reserved role code in the authorization model but is not assignable or sign-in capable in this slice. Its invited-entry flow belongs to Phase 3.
- A user with one active role enters that role's workbench. A user with several active roles is sent to a role-selection page. Selecting a workbench changes UI context only; API authorization remains based on all effective assignments.

### 2.2 Account states and onboarding

| State | Can sign in | Meaning and allowed transition |
| --- | --- | --- |
| `PENDING` | No | Public request submitted; P1 can approve or reject it. |
| `ACTIVE` | Yes | Normal account; P1 can disable or reset its password. |
| `DISABLED` | No | Sign-in and refresh are rejected; only a later P1 action may reactivate it. |

- Public registration accepts only `loginId` and `displayName`; it never accepts a role, password, or privilege scope.
- A P1 approval assigns one or more of `P1`-`P3`, activates the account, and causes the server to generate an 18-character temporary password. The password is returned exactly once in that response and is never written to an audit event, application log, database column, browser storage, or notification.
- The account stores only the Argon2id hash of that temporary password and has `mustChangePassword = true`.
- A reset follows the same one-time temporary-password rule and revokes all existing refresh sessions immediately.
- The first P1 is an exception to the approval chain. Deployment configuration supplies `AUTH_BOOTSTRAP_P1_LOGIN_ID` and `AUTH_BOOTSTRAP_P1_TEMP_PASSWORD`. The first registration matching the configured identifier atomically creates an active P1 account with that password and `mustChangePassword = true`. It is consumed once, recorded in the database, and cannot be reused even if the environment variable remains present.
- The bootstrap password is supplied as a Docker secret or runtime environment secret, never committed to `.env.example`. The deployment operator delivers it out of band.

### 2.3 Password, session, and abuse controls

- Passwords must be 12-128 characters after NFKC normalization and must not equal the normalized login identifier. Do not impose composition rules that encourage predictable substitutions.
- Hash passwords with `pwdlib.PasswordHash.recommended()` (Argon2id). Use its verification and automatic rehash support; never implement hashing directly or reuse the old reversible password encryption.
- A normal successful login returns a 15-minute signed access JWT in the JSON response and sets a 7-day opaque refresh-token cookie. The browser stores the access token in JavaScript memory only.
- The refresh cookie is named `ops_rt`, has `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/api/v1/auth`, and no JavaScript-readable domain override. Local HTTP development sets `Secure=false` only when `APP_ENV=development`.
- A refresh token is a random opaque `sessionId.secret` value. The database stores only a SHA-256/HMAC hash of the complete value. Every refresh rotates the token and records the replacement session in the same token family.
- Reuse of a rotated/revoked refresh token revokes the entire token family and returns `401 REFRESH_REUSED`. The frontend clears its in-memory state and returns to sign-in.
- Access JWTs contain `sub` (account UUID), `sid` (session family UUID), `av` (account authorization version), `typ=access`, `iat`, `exp`, and `jti`. Protected endpoints load the account and current effective roles from PostgreSQL, reject an authorization-version mismatch, and never treat role claims in the JWT as authoritative.
- A user required to change password receives only a 10-minute `typ=password_change` JWT, no refresh cookie, and may call only password change and sign-out. It cannot access `/auth/me`, administration, or future business APIs.
- Record failed login attempts against a non-reversible HMAC of normalized `loginId` and a non-reversible HMAC of client IP. After five failures for either key in 15 minutes, respond with `429 LOGIN_THROTTLED` until the window expires. Login failures always use the same public message to prevent account enumeration.
- Password reset, account disable, role change, and activation increment `authorizationVersion`, revoke all refresh sessions for the account, and write an audit event. This invalidates already-issued access tokens on their next protected request.

## 3. New repository and deployment layout

Create the following independent application layout. Do not move or delete the legacy folders during authentication development.

```text
apps/
  api/
    app/
      api/v1/routes/
      core/
      db/
      models/
      schemas/
      services/
    alembic/versions/
    tests/{unit,integration}/
    Dockerfile
    alembic.ini
    pyproject.toml
  web/
    src/{app,features/auth,features/admin,lib,pages}/
    tests/
    e2e/
    Dockerfile
    package.json
    vite.config.ts
  proxy/nginx.conf
compose.yaml
.env.example
docs/plans/2026-08-02-auth-foundation-development.md
```

- `compose.yaml` starts `postgres`, `api`, and `web`. Nginx serves the built React assets, forwards `/api/` to the API service, and is the only browser-facing service in production.
- PostgreSQL data uses the named `ops_postgres_data` volume. No SQLite file, PocketBase container, media volume, or legacy frontend is part of the new Compose stack.
- `apps/web/vite.config.ts` proxies `/api` to `http://localhost:8000` in development and enables credentialed requests. Production uses the same origin and does not enable broad CORS.
- `apps/api` loads configuration through a typed settings object. Required production secrets are the PostgreSQL URL, JWT signing key, refresh-token pepper, bootstrap P1 login ID, and bootstrap temporary password. Startup fails if a production secret is missing, has a documented placeholder value, or uses the development default.
- Pin package versions in the new Python `pyproject.toml` and frontend `package-lock.json`; do not add dependencies to the legacy requirement or package files.

## 4. Data model and audit contract

Use UUID primary keys, UTC `timestamptz` values, and `created_at`/`updated_at` on mutable tables. Migration names are timestamped Alembic revisions and are immutable after use.

| Table | Required fields and rules |
| --- | --- |
| `accounts` | `id`, `login_id` unique canonical value, `display_name`, `status`, `password_hash` nullable only for `PENDING`, `must_change_password`, `authorization_version` default 1, `last_login_at`, `created_at`, `updated_at`. |
| `role_assignments` | `id`, `account_id`, `role_code`, `scope_type`, `scope_id` nullable, `effective_from`, `effective_until` nullable, `granted_by_account_id`, `revoked_at`, timestamps. Enforce one active identical assignment with a partial unique index. |
| `registration_requests` | `id`, `login_id` unique while pending, `display_name`, `status` (`PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`), `account_id` nullable, `reviewed_by_account_id`, `reviewed_at`, `review_reason`, timestamps. |
| `refresh_sessions` | `id`, `account_id`, `family_id`, `token_hash` unique, `parent_session_id` nullable, `expires_at`, `rotated_at`, `revoked_at`, `revoke_reason`, `created_ip_hash`, `user_agent_summary`, `created_at`. A session is usable only when unexpired, unrevoked, and its account authorization version matches. |
| `auth_events` | `id`, `event_type`, `actor_account_id` nullable, `subject_account_id` nullable, `request_id`, `ip_hash` nullable, safe metadata JSON, `occurred_at`. It is append-only and excludes password, access JWT, refresh token, and temporary password values. |
| `auth_throttle_windows` | `key_type`, `key_hash`, `failed_count`, `window_started_at`, `blocked_until`, `updated_at`; used with an atomic database update to apply the 5-failures-in-15-minutes rule. |
| `system_bootstrap` | Singleton row with `bootstrap_p1_consumed_at`, `bootstrap_account_id`, and `created_at`; used by the transactional first-P1 rule. |

All normal API responses use camelCase. Error responses use the stable contract below; error messages may be localized later without changing `code`.

```json
{
  "code": "LOGIN_INVALID",
  "message": "账号或密码错误。",
  "requestId": "01J..."
}
```

## 5. HTTP interface contract

All routes below are served from `/api/v1`. JSON request bodies require `Content-Type: application/json`. Successful responses include `Cache-Control: no-store` for every authentication resource.

### 5.1 Public and session routes

| Route | Request | Response and rules |
| --- | --- | --- |
| `POST /auth/registrations` | `{ "loginId", "displayName" }` | `202` with `{ "status": "pending" }`; duplicate and unknown identifiers return the same public response. A configured, unconsumed bootstrap P1 receives `201 { "status": "bootstrapActivated" }`. |
| `POST /auth/login` | `{ "loginId", "password" }` | For an active normal account, `200` with an authenticated session payload and `Set-Cookie: ops_rt=...`. For `mustChangePassword`, `200` with a password-change payload and no cookie. Invalid, pending, disabled, or incorrect credentials return `401 LOGIN_INVALID`; throttling returns `429 LOGIN_THROTTLED`. |
| `POST /auth/change-password` | bearer password-change token and `{ "newPassword" }` | `200` with a normal authenticated session payload and a new refresh cookie. Reject any normal access token or expired/change token with `401 TOKEN_INVALID`. |
| `POST /auth/refresh` | refresh cookie only | `200` with a normal authenticated session payload and a rotated refresh cookie. Missing/invalid/reused/disabled sessions clear the cookie and return `401` with a stable code. |
| `POST /auth/logout` | optional bearer token and/or refresh cookie | `204`; revoke the supplied current session/family where resolvable, clear `ops_rt`, and remain idempotent. |
| `GET /auth/me` | normal access bearer token | `200` with the current account and effective role assignments. A password-change token is rejected. |

An authenticated session payload has this exact shape:

```json
{
  "accessToken": "eyJ...",
  "expiresIn": 900,
  "user": {
    "id": "uuid",
    "loginId": "20260001",
    "displayName": "张三",
    "roles": ["P3"],
    "authorizationVersion": 1
  },
  "mode": "authenticated"
}
```

A forced-change response uses the same user fields and has `mode: "passwordChangeRequired"`, a 10-minute `accessToken`, and `expiresIn: 600`; it has no `Set-Cookie` header.

### 5.2 P1 administration routes

All routes require an active P1 role, are audited, and reject a password-change token.

| Route | Request | Response and rules |
| --- | --- | --- |
| `GET /admin/registration-requests?status=PENDING` | none | Paginated pending requests, without passwords or security data. |
| `POST /admin/registration-requests/{requestId}/approve` | `{ "roles": ["P3"], "reason": "optional" }` | Atomically approve, activate, assign roles, and return `201 { "account": ..., "temporaryPassword": "..." }`. The temporary password is omitted from all later reads. Reserved external-reviewer role is rejected. |
| `POST /admin/registration-requests/{requestId}/reject` | `{ "reason" }` | `204`; preserve the rejection audit trail. |
| `POST /admin/accounts/{accountId}/reset-password` | `{ "reason" }` | `200 { "temporaryPassword": "..." }`; revoke all sessions and require a first-password change. |
| `POST /admin/accounts/{accountId}/disable` | `{ "reason" }` | `204`; mark disabled, increment authorization version, and revoke all sessions. |

`P1` may approve P1/P2/T1/P3 roles because organization governance belongs to P1 under BR-GOV-02. No endpoint in this slice deletes accounts, role grants, registrations, sessions, or audit events.

## 6. Frontend behavior contract

- `AuthProvider` owns the access token, current user, roles, initialization state, and `signIn`, `refresh`, `signOut`, and `changePassword` operations. Its state is React memory only.
- Application startup calls `/auth/refresh` once. A valid cookie restores the session; a `401` is a normal anonymous state and must not produce an error toast.
- The fetch client adds the in-memory bearer token. On exactly one `401` from a protected request, it makes one shared refresh request, retries the original request once on success, and signs out on failure. Concurrent requests await the same refresh promise.
- `/login` contains the academic/employee identifier and password fields, a link to `/apply`, generic invalid-login feedback, accessible validation, and no role selector.
- `/apply` accepts only identifier and display name, displays a non-enumerating acceptance message, and does not reveal whether the identifier already has an account.
- `/change-password` is reachable only with a password-change token. Back/refresh/navigation must not grant access to normal routes. On success it replaces the restricted token with the normal session response and routes to role entry.
- `/select-workbench` is shown only when the user has more than one effective role. The selected role is saved as non-sensitive UI preference; it is never sent as proof of authorization.
- `/admin/access-requests` is P1-only and supports pending list, approve/reject, generated-password one-time modal, reset-password one-time modal, and disable confirmation. The modal warns P1 to copy and deliver the password through an approved offline channel before closing.
- Route guards distinguish anonymous, password-change-only, authenticated, and required-role states. They redirect rather than merely hiding menu items.

## 7. Implementation tasks

Each task is small enough to implement and review independently. Run the named test before the implementation step, then run it again after the change. Commit only the listed files plus directly required lockfiles or migrations.

### Task 1: Create the isolated application and Compose skeleton

**Files:**
- Create: `apps/api/pyproject.toml`, `apps/api/app/main.py`, `apps/api/app/core/config.py`, `apps/api/Dockerfile`
- Create: `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/Dockerfile`, `apps/proxy/nginx.conf`
- Create: `compose.yaml`, `.env.example`
- Test: `apps/api/tests/integration/test_health.py`

1. Write a failing `GET /api/v1/health` test that expects `{ "status": "ok" }`.
2. Run `cd apps/api && pytest tests/integration/test_health.py -q`; expect collection/import failure before the app exists.
3. Implement typed settings, FastAPI app factory, health route, Docker images, Compose health checks, same-origin Nginx proxy, and Vite `/api` proxy.
4. Run `docker compose up --build -d`, `curl -fsS http://localhost/api/v1/health`, and `docker compose down`; expect the health JSON and clean shutdown.
5. Commit: `chore: scaffold new operations platform`.

### Task 2: Establish database lifecycle and authentication tables

**Files:**
- Create: `apps/api/app/db/base.py`, `apps/api/app/db/session.py`, `apps/api/app/models/auth.py`
- Create: `apps/api/alembic.ini`, `apps/api/alembic/env.py`, `apps/api/alembic/versions/<timestamp>_create_auth_tables.py`
- Test: `apps/api/tests/integration/test_auth_schema.py`

1. Write schema tests for account uniqueness, a pending request without a password hash, and a unique active role assignment.
2. Run `cd apps/api && pytest tests/integration/test_auth_schema.py -q`; expect failure because no database schema exists.
3. Implement SQLAlchemy metadata, PostgreSQL session lifecycle, enum/check/index constraints, and the initial Alembic migration for every table in section 4.
4. Run `docker compose exec api alembic upgrade head` and the schema test; expect all tests to pass against an isolated test database.
5. Commit: `feat: add authentication persistence schema`.

### Task 3: Implement password policy, token primitives, and safe audit logging

**Files:**
- Create: `apps/api/app/services/passwords.py`, `apps/api/app/services/tokens.py`, `apps/api/app/services/audit.py`
- Create: `apps/api/tests/unit/test_passwords.py`, `apps/api/tests/unit/test_tokens.py`, `apps/api/tests/unit/test_audit.py`

1. Write failing unit tests for 12-character acceptance, identifier rejection, Argon2 verification, access/password-change token type rejection, refresh-token hashing, and audit metadata redaction.
2. Run `cd apps/api && pytest tests/unit/test_passwords.py tests/unit/test_tokens.py tests/unit/test_audit.py -q`; expect failure.
3. Implement the policy and primitives in one place; use an injected clock and token generator in tests, and make audit logging reject sensitive keys recursively.
4. Re-run the unit tests; expect pass. Add a test proving that a generated temporary password is absent from a serialized audit event.
5. Commit: `feat: add secure authentication primitives`.

### Task 4: Implement public application and one-time P1 bootstrap

**Files:**
- Create: `apps/api/app/schemas/auth.py`, `apps/api/app/services/registration.py`, `apps/api/app/api/v1/routes/registrations.py`
- Modify: `apps/api/app/main.py`
- Test: `apps/api/tests/integration/test_registration_api.py`

1. Write failing API tests for normal pending registration, a duplicate non-enumerating response, bootstrap activation, and concurrent bootstrap attempts yielding exactly one P1.
2. Run `cd apps/api && pytest tests/integration/test_registration_api.py -q`; expect failure.
3. Implement normalized identifiers, generic public responses, a transaction/row lock around `system_bootstrap`, server-side hash of the bootstrap temporary password, and append-only events.
4. Re-run the registration tests; expect all pass and confirm no test response returns a bootstrap password.
5. Commit: `feat: add account application and P1 bootstrap`.

### Task 5: Implement P1 approval, reset, disable, and role assignment

**Files:**
- Create: `apps/api/app/api/v1/dependencies.py`, `apps/api/app/api/v1/routes/admin_accounts.py`, `apps/api/app/services/accounts.py`
- Test: `apps/api/tests/integration/test_admin_accounts_api.py`

1. Write failing tests that prove only P1 can list/approve/reject, approve returns a temporary password once, invalid role codes are rejected, reset revokes sessions, and disable blocks sign-in.
2. Run `cd apps/api && pytest tests/integration/test_admin_accounts_api.py -q`; expect failure.
3. Implement current-user dependency with authoritative account/role lookup, atomic approval, secure password generation, authorization-version increment, and audit events.
4. Re-run the tests; expect pass. Inspect captured logs in the test and assert no temporary password appears.
5. Commit: `feat: add P1 account approval controls`.

### Task 6: Implement login, forced password change, and current identity

**Files:**
- Create: `apps/api/app/api/v1/routes/auth.py`, `apps/api/app/services/auth.py`
- Modify: `apps/api/app/api/v1/dependencies.py`, `apps/api/app/main.py`
- Test: `apps/api/tests/integration/test_login_api.py`

1. Write failing tests for invalid/pending/disabled generic rejection, normal login cookie issuance, a password-change token with no cookie, successful forced change, and `/auth/me` role output.
2. Run `cd apps/api && pytest tests/integration/test_login_api.py -q`; expect failure.
3. Implement the response shapes in section 5, authorization-version validation, `Cache-Control: no-store`, secure cookie settings, last-login update, and the restricted-token guard.
4. Re-run the login tests; expect pass. Verify that a password-change token is rejected by `/auth/me` and every admin route.
5. Commit: `feat: add authentication login and password change`.

### Task 7: Implement refresh rotation, replay defense, logout, and throttling

**Files:**
- Modify: `apps/api/app/services/auth.py`, `apps/api/app/api/v1/routes/auth.py`, `apps/api/app/models/auth.py`
- Create: `apps/api/app/services/throttle.py`
- Test: `apps/api/tests/integration/test_session_api.py`, `apps/api/tests/integration/test_login_throttle_api.py`

1. Write failing tests for normal refresh rotation, replaying an old cookie revoking its family, logout idempotency, password reset invalidating a live access token, and five failures causing a 15-minute throttle.
2. Run `cd apps/api && pytest tests/integration/test_session_api.py tests/integration/test_login_throttle_api.py -q`; expect failure.
3. Implement atomic session rotation, family revocation, cookie clearing on all failure paths, and database-backed throttle windows using transactional updates.
4. Re-run both files and the full API suite; expect pass.
5. Commit: `feat: add rotating sessions and login throttling`.

### Task 8: Create the TypeScript frontend foundation and API client

**Files:**
- Create: `apps/web/src/main.tsx`, `apps/web/src/app/App.tsx`, `apps/web/src/lib/api.ts`, `apps/web/src/lib/http.ts`, `apps/web/src/features/auth/AuthProvider.tsx`
- Create: `apps/web/src/features/auth/auth.test.tsx`, `apps/web/vitest.config.ts`

1. Write failing tests proving no token is written to local/session storage, startup treats refresh `401` as anonymous, and concurrent `401` requests share one refresh operation.
2. Run `cd apps/web && npm test -- auth.test.tsx`; expect failure because the app/client do not exist.
3. Implement typed API error parsing, in-memory session state, credentialed refresh requests, single-flight retry, and React Query provider.
4. Re-run the test and `npm run typecheck`; expect pass with no local-storage token key in the source tree.
5. Commit: `feat: add in-memory web authentication client`.

### Task 9: Build public login, application, and forced-change pages

**Files:**
- Create: `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/pages/ApplyPage.tsx`, `apps/web/src/pages/ChangePasswordPage.tsx`
- Create: `apps/web/src/features/auth/LoginForm.tsx`, `apps/web/src/features/auth/ApplicationForm.tsx`, `apps/web/src/features/auth/PasswordChangeForm.tsx`
- Test: `apps/web/src/pages/auth-pages.test.tsx`

1. Write failing interaction tests for generic login failure, non-enumerating application confirmation, forced redirect to password change, and successful transition to an authenticated state.
2. Run `cd apps/web && npm test -- auth-pages.test.tsx`; expect failure.
3. Implement accessible forms, validation messages, busy/error states, and routes exactly described in section 6.
4. Re-run the test and `npm run build`; expect pass.
5. Commit: `feat: add onboarding and authentication pages`.

### Task 10: Build role entry, route guards, and P1 access-request screens

**Files:**
- Create: `apps/web/src/app/router.tsx`, `apps/web/src/app/guards.tsx`, `apps/web/src/pages/RoleSelectionPage.tsx`, `apps/web/src/pages/admin/AccessRequestsPage.tsx`
- Create: `apps/web/src/features/admin/ApprovalDialog.tsx`, `apps/web/src/features/admin/TemporaryPasswordDialog.tsx`
- Test: `apps/web/src/app/guards.test.tsx`, `apps/web/src/pages/admin/AccessRequestsPage.test.tsx`

1. Write failing tests for anonymous redirects, password-change-only restriction, role denial, multi-role selection, P1 approval, and one-time password modal closure.
2. Run `cd apps/web && npm test -- guards.test.tsx AccessRequestsPage.test.tsx`; expect failure.
3. Implement route guards, role-selection preference, pending-request query/mutations, approve/reject/reset/disable dialogs, and a modal that clears its password state when closed or unmounted.
4. Re-run the tests and `npm run typecheck`; expect pass.
5. Commit: `feat: add role-aware entry and P1 onboarding controls`.

### Task 11: Add cross-service end-to-end coverage

**Files:**
- Create: `apps/web/e2e/auth-onboarding.spec.ts`, `apps/web/playwright.config.ts`
- Modify: `compose.yaml`, CI configuration if present when implementation begins

1. Write a failing Playwright scenario: bootstrap P1 registers and changes password, P1 approves a P3 application, P3 changes temporary password, refreshes after page reload, and logout returns to login.
2. Run `docker compose up --build -d && cd apps/web && npx playwright test e2e/auth-onboarding.spec.ts`; expect failure until the full stack is implemented.
3. Add deterministic test fixtures/secrets and wait for health checks; do not expose test credentials in production configuration.
4. Re-run the scenario and a replay-token scenario; expect pass.
5. Commit: `test: cover end-to-end authentication onboarding`.

### Task 12: Document operations and lock the authentication baseline

**Files:**
- Modify: `README.md`
- Create: `docs/runbooks/auth-bootstrap.md`, `docs/runbooks/auth-incident-response.md`
- Modify: `docs/plans/2026-08-02-beverage-training-operations-system-design.md`

1. Write a documentation checklist test/manual review for secret setup, bootstrap consumption, password delivery, session revocation, backup, and incident recovery.
2. Add exact Compose startup, Alembic migration, bootstrap, test, and rollback procedures. Explicitly prohibit legacy-data import and direct SQL password changes.
3. Update the product baseline's DQ-01 as decided: local password authentication with a future provider adapter; record external reviewer login as deferred to Phase 3.
4. Run all API tests, all frontend tests, typecheck, production build, and the Compose E2E suite; expect pass.
5. Commit: `docs: add authentication operations runbook`.

## 8. Definition of done and acceptance scenarios

| Scenario | Required result |
| --- | --- |
| First P1 | The configured identifier can register exactly once; it receives no secret from the browser, signs in with the deployment-delivered password, must change it, and receives P1 access. |
| Standard onboarding | A P3 applicant sees an acceptance message; P1 approves it, sees one temporary password once, and the P3 must change it before reaching a workbench. |
| Multiple roles | An approved P2+T1 account receives both roles from `/auth/me`, sees role selection, and cannot access P1 administration. |
| Secure renewal | Page reload restores a valid session through the HttpOnly cookie; the access token cannot be found in local/session storage or the DOM. |
| Replay defense | Reusing a pre-rotation refresh cookie revokes its full family; both the legitimate and replaying browser are signed out. |
| Revocation | P1 reset/disable immediately blocks the subject's protected API call even if its 15-minute access JWT has not expired. |
| Abuse handling | Six failed attempts within 15 minutes return the non-enumerating throttle response; successful/failed messages do not reveal account existence. |
| Audit and privacy | Every approval, reset, disable, login, failure, logout, and session-reuse event is queryable by safe metadata; no password or token secret is present in database records or logs. |

## 9. Explicit deferrals and assumptions

- No direct self-service password reset, email, SMS, MFA, unified academy SSO, invited external-reviewer login, device-management page, or external notification delivery is included.
- P1 gives generated temporary passwords to users through an approved offline institutional channel; this workflow must be reviewed before production operation.
- User/contact identity verification, initial real role assignments, first trial store, and term scopes are operational inputs for the next business slice; authentication only provides global role groundwork.
- Object storage, uploaded evidence access, WebSocket authorization, term/store/shift scopes, and all business permissions must reuse the `CurrentUser`/effective-role dependency created here rather than inventing client-side checks.
- Database backups, TLS certificate management, and Docker host hardening are deployment-owner responsibilities; the runbook records required controls but this code slice does not operate a cloud service.
