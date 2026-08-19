# PRD Backend Delivery Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Each production behaviour starts with a focused failing integration test.

**Goal:** Deliver every backend resource family defined in the product baseline, as a new-data-only Spring DDD modular monolith: governance, daily operations, teaching, assessment, compliance, notifications and authorised realtime state updates.

**Architecture:** The application remains a Java 21 Spring Boot modular monolith backed only by Flyway-managed PostgreSQL. `identityaccess` owns accounts and sessions; `governance` owns terms, stores, teams and versioned templates; `operations` owns operating days, shifts, assignments, task execution, approvals, incidents, handovers and external-data summaries; `learning` owns teaching material, feedback, retraining, certification and creative work; `assessment` owns rubrics, portfolios, invitations and published results. Controllers call application use cases; use cases depend only on domain/application ports; JDBC, object-storage and WebSocket adapters stay in infrastructure.

**Tech Stack:** Java 21, Spring Boot 3.4.5, Spring Security, JDBC, Flyway, PostgreSQL 16, Spring WebSocket/STOMP, JUnit 5, MockMvc, Testcontainers, Testcontainers PostgreSQL. Spring AI 1.0 remains dependency-managed only—there is no AI provider, model, API key or request path in this scope.

---

## 1. Non-negotiable rules

- Product source of truth: `docs/plans/2026-08-02-beverage-training-operations-system-design.md`.
- Use **only new PostgreSQL tables** introduced by Flyway in this branch. Do not read, import, map, synchronise, dual-write, or provide compatibility endpoints for `backend/`, SQLite, PocketBase, FastAPI or old frontend data.
- All IDs are UUIDs; business timestamps are UTC `timestamptz`; all state-changing commands record actor, timestamp, reason when required and an append-only audit entry.
- No normal API deletes operational facts, evidence, assessments, records or audits. Historical changes are represented as versions, returns, cancellation, reopening or corrections.
- Bearer authorisation is server-authoritative and scope-aware; browser-selected roles, payload owner IDs and hidden front-end menus never grant access.
- Each mutation returns `id`, `version`, `updatedAt` (or the immutable event version) and accepts an optimistic-lock version where the resource is mutable.

## 2. Decisions and delivery boundaries

| PRD decision | Implementation boundary | What may proceed now |
| --- | --- | --- |
| DQ-01 unified identity | Keep the implemented local account adapter; define no alternative identity login flow. | All business APIs use account UUIDs and server roles. |
| DQ-02 server media storage, no backup | Closed for phase 1: persist media below the configured server root (`/data/beverage-ops/media` in production), store only controlled relative paths and metadata in PostgreSQL, and expose only authorised backend upload/download routes. No object-storage provider, direct public URL, backup service or virus scanner is used. | Implement local filesystem adapter, metadata/version records, multipart validation, authorised stream/range reads and three-day purge of replaced/withdrawn physical files. |
| DQ-03 pilot term, store and people | No seed business data. P1 creates these through APIs. | All governance CRUD/publish routes. |
| DQ-04 POS/inventory source and voucher format | Store generic `sourceSystem`, `collectionMethod`, `sourceReference`, collector and timestamp; no POS/inventory integration. | External operating summaries and `PENDING_SUPPLEMENT` todo. |
| DQ-05 certification/retraining deadlines and scoring weights | Store P1-authored, versioned rules; do not seed a supposedly official threshold, deadline or score. | Rule management and validation based on configured values. |
| DQ-06 reviewer roster/invite lifetime/public scope | Define invitation and visibility ports/data contracts but do not issue real reviewer invitations until P1 confirms the policy. | Internal portfolio/rubric/result APIs. |
| DQ-07 long-term archive retention | Encode 5-year minimum and read-only archive transitions; deployment storage/destruction policy remains configuration/operations work. | Archive state, audit/search/export manifest endpoints. |

DQ-02 is recorded in [server media storage design](2026-08-19-server-media-storage-design.md). Before implementing public external-review links, obtain a recorded decision for DQ-06. No public media directory, client-provided server path, placeholder provider credential or unauthorised filesystem persistence is allowed.

## 3. API resource contract

All routes begin with `/api/v1`; JSON uses camelCase. Responses from identity, administrative, evidence and assessment APIs use `Cache-Control: no-store`. Errors have `{code,message,requestId}`.

### Governance (P1)

- `POST/GET /admin/terms`, `GET/PATCH /admin/terms/{termId}`, `POST /admin/terms/{termId}/publish`, `POST /admin/terms/{termId}/archive`
- `POST/GET/PATCH /admin/stores`, `POST/GET/PATCH /admin/teams`
- `POST/GET/DELETE /admin/terms/{termId}/memberships` (deactivate rather than delete after use)
- `POST/GET/PATCH /admin/template-versions`, `POST /admin/template-versions/{id}/publish`
- Template subresources: roles, shift definitions, SOP task definitions, milestones, incident categories, certification rules and rubric definitions.
- `GET /admin/audit-events` and `GET /admin/change-records` with scope/time/resource filtering.

### Operations (P2 and P3)

- `POST/GET /operating-days`, `GET/PATCH /operating-days/{dayId}`
- `POST/GET /shifts`, `GET/PATCH /shifts/{shiftId}`, `POST /shifts/{shiftId}/schedule`, `POST /shifts/{shiftId}/start`, `POST /shifts/{shiftId}/request-close`, `POST /shifts/{shiftId}/close`, `POST /shifts/{shiftId}/reopen`, `POST /shifts/{shiftId}/cancel`
- `POST/GET/PATCH /shifts/{shiftId}/assignments`; P3 read-only `GET /me/shifts` and `GET /me/shifts/{shiftId}`.
- `GET /shifts/{shiftId}/tasks`, `POST /task-completions/{id}/submit`, `POST /task-completions/{id}/return` (P2 only for return/acceptance), `POST /task-completions/{id}/accept`.
- `POST/GET /evidence` metadata and version relations; `POST /evidence/{id}/files`, `POST /evidence/{id}/files/replace`, `POST /evidence/{id}/files/withdraw`, and authorised `GET /evidence/{id}/files/current` implement server-file upload, history and retrieval after Task 10.
- `POST/GET/PATCH /operating-summaries`, `POST /operating-summaries/{id}/confirm`.
- `POST/GET/PATCH /incidents`, `POST /incidents/{id}/acknowledge`, `POST /incidents/{id}/assign`, `POST /incidents/{id}/submit-verification`, `POST /incidents/{id}/close`, `POST /incidents/{id}/reopen`, `POST /incidents/{id}/waive-blocking`.
- `POST/GET/PATCH /handovers`, `POST /handovers/{id}/submit`, `POST /handovers/{id}/accept`, `POST /handovers/{id}/return`, `POST /handovers/{id}/approve`.
- `GET /me/operations-dashboard` (P3) and `GET /operations/today` (P2), based on server-side actionable work—not a UI-only aggregate.

### Learning (T1, P3, P1)

- `POST/GET/PATCH /teaching-materials`, `POST /teaching-materials/{id}/publish`, `POST /teaching-materials/{id}/acknowledgements`.
- `POST/GET/PATCH /feedback`, `GET /me/feedback`.
- `POST/GET/PATCH /retraining`, `POST /retraining/{id}/submit`, `POST /retraining/{id}/request-retest`, `POST /retraining/{id}/record-retest`; lifecycle: `PENDING → SUBMITTED → RETEST_PENDING → PASSED | RETRAIN_REQUIRED`.
- `POST/GET/PATCH /certifications`, `POST /certifications/{id}/decide`; P3 can only read own certification records.
- `POST/GET/PATCH /course-tasks`, `POST /course-tasks/{id}/submissions`, `POST/GET/PATCH /creative-works`, `POST /creative-works/{id}/publish`, `POST /creative-works/{id}/feedback`, `POST/GET/PATCH /reflections`.

### Assessment and compliance (P1; scoped P2/T1)

- `POST/GET/PATCH /rubric-versions`, `POST /rubric-versions/{id}/publish`.
- `POST/GET /assessment-records`, `POST /assessment-records/{id}/score`, `POST /assessment-records/{id}/submit`.
- `POST/GET /portfolios`, `POST /portfolios/{id}/generate`, `POST /portfolios/{id}/publish`, `GET /portfolios/{id}/export-manifest`.
- `POST /results/{id}/publish`, `POST /results/{id}/correct`; published results are read-only and a correction creates a new version.
- Future DQ-06 routes: `POST/GET /review-invitations`, `GET /external/portfolios/{token}`, `POST /external/portfolio-scores`; they remain unavailable until invite policy is enabled.
- `POST /archives/{id}/transition-read-only`, `GET /archives`, `GET /archives/{id}/export-manifest`.

### Notifications and realtime

- `GET /notifications`, `POST /notifications/{id}/read`, `POST /notifications/read-all`.
- WebSocket endpoint `/ws`, authenticated by a normal access token during the handshake. Topics are derived server-side from `term`, `store`, `operatingDay`, `shift` and current account scope; clients never subscribe to arbitrary IDs.
- State-changing commands publish events only after their transaction commits. Failed writes never emit a success event.

## 4. Implementation tasks

### Task 1: Shared foundation, governance and immutable audit

**Files:**
- Create: `apps/backend/src/main/resources/db/migration/V2__create_governance_and_audit_schema.sql`
- Create: `apps/backend/src/main/java/com/beverageops/governance/{domain,application,infrastructure,adapter/in/web}/...`
- Create: `apps/backend/src/main/java/com/beverageops/shared/audit/...`
- Test: `apps/backend/src/test/java/com/beverageops/governance/adapter/in/web/GovernanceControllerIntegrationTest.java`

1. Write failing tests proving P1 can create a draft term/store/team/template version; P2/P3 cannot; a published template cannot be modified in place; changing it creates a new version; every command creates an audit event.
2. Add migration tables for terms, weeks, stores, teams, memberships, template versions, roles, SOP definitions, milestones, incident categories and shared audit events. Use foreign keys, state checks, immutable published snapshots and `version` counters.
3. Implement use cases/repository ports and JDBC adapters. Do not seed a pilot term or default business thresholds.
4. Add controllers and server-side P1 checks. Verify version mismatch returns `409 VERSION_CONFLICT` and audit response excludes sensitive identity data.
5. Run focused tests, then full Maven tests; commit `feat: add governance templates and audit trail`.

### Task 2: Operating-day, shift and scheduling lifecycle

**Files:**
- Create: `V3__create_operations_scheduling_schema.sql`
- Create: `operations/domain/model/{ShiftStatus,AssignmentStatus}.java`, ports, use cases and JDBC adapters.
- Create: `operations/adapter/in/web/{OperatingDayController,ShiftController,AssignmentController}.java`
- Test: `OperationsSchedulingIntegrationTest.java`

1. Write failing tests for P2 creation of an operating day/shifts from a published template snapshot, assignment conflict detection, required cancellation reason, P3 personal schedule visibility and unauthorised cross-store rejection.
2. Migrate operating days, shifts, template snapshots, assignments, assignment change history and scope grants. Enforce unique store/date and non-overlapping shift/assignment constraints at the database/application boundary.
3. Implement lifecycle `DRAFT → SCHEDULED → IN_PROGRESS → KEY_APPROVAL_PENDING → CLOSED`, with `CANCELLED` and controlled `REOPENED`; only P2/P1 can schedule/cancel/reopen in scope.
4. Generate notifications and audit events after assignment changes. Return current version on every mutable response.
5. Verify focused/full tests; commit `feat: add operating day shift scheduling`.

### Task 3: SOP task execution, evidence metadata and key approvals

**Files:**
- Create: `V4__create_task_execution_and_evidence_schema.sql`
- Create: `operations/domain/model/{TaskCompletionStatus,MilestoneDecision,EvidenceKind}.java`
- Create: task/evidence/milestone ports, use cases, JDBC adapters and controllers.
- Test: `ShiftExecutionIntegrationTest.java`

1. Write failing tests for P3 completing only assigned tasks, evidence-required task rejection without evidence, P2 acceptance/return with reasons, and task/milestone history staying immutable after resubmission.
2. Add versioned task-completion, evidence metadata/version, milestone submission and approval records. Supported evidence kinds are `TEXT`, `EXTERNAL_LINK`, `OPERATING_SUMMARY_REFERENCE`, and `OBJECT_REFERENCE`; the last has no binary storage adapter until DQ-02.
3. Implement actual template snapshot task expansion at shift scheduling, then P3 submit/replace/withdraw flows with reasons and P2 approval/return.
4. Require P2 approval at configured milestones and prevent closing with an unapproved required milestone.
5. Test/audit/commit `feat: add shift task execution and approvals`.

### Task 4: External operating summaries, incidents and handovers

**Files:**
- Create: `V5__create_operational_risk_schema.sql`
- Create: operations risk models, ports, use cases, JDBC adapters and controllers.
- Test: `OperationalRiskIntegrationTest.java`

1. Write failing tests for a P3/P2 operating summary marked pending instead of zero when external data is unavailable; P2 confirmation; blocking incident assignment/verification; close refusal without verification; mandatory handover acceptance before close.
2. Persist generic summary source metadata (not POS facts), summary lines, pending-supplement items, incidents, actions, verification evidence relations, waivers and handover versions.
3. Implement incident lifecycle and severity/blocking rules. T1 may link an incident to learning but cannot close a safety incident; P2/P1 reopening preserves history.
4. Implement handover submit/return/accept/approve and close guards for blocking incidents and required handovers.
5. Test/audit/commit `feat: add operational summaries incidents and handovers`.

### Task 5: Notifications, dashboards and authorised realtime events

**Files:**
- Create: `V6__create_notifications_schema.sql`
- Create: `shared/notification/...`, `shared/realtime/...`, `operations/...Dashboard...`
- Modify: `SecurityConfiguration.java`
- Test: `NotificationIntegrationTest.java`, `RealtimeAuthorisationTest.java`

1. Write failing tests for assignment/return/incident/handover events creating recipients in the correct scope, P3 dashboard excluding other users, P2 today view surfacing missing scheduling/approvals/risk, and forbidden WebSocket subscription rejection.
2. Add append-only notifications and read state. Implement application event publication after commit, not from controllers.
3. Add authenticated WebSocket/STOMP configuration and a server-side subscription authorizer. Never expose raw topic destinations as authorisation.
4. Implement deterministic P3/P2 dashboard queries with current actionable items, not front-end inferred state.
5. Test/commit `feat: add operational notifications dashboards and realtime events`.

### Task 6: Teaching feedback, retraining and certification

**Files:**
- Create: `V7__create_learning_feedback_schema.sql`
- Create: learning domain, application, infrastructure and web adapter files.
- Test: `LearningProgressIntegrationTest.java`

1. Write failing tests for T1 scoped feedback, P3 feedback visibility, retraining state transitions, re-test evidence requirement and certification decision scoped by rule/version.
2. Persist feedback links, retraining records/actions/evidence links, certification rule snapshots and immutable certification decisions.
3. Implement P3/T1/P2/P1 authorisation exactly as PRD specifies; no cash penalty or unconfigured automatic score deduction.
4. Add student growth endpoint that combines only authorised feedback, retraining, certification and open actions.
5. Test/commit `feat: add learning feedback retraining and certification`.

### Task 7: Course materials, preparation and creative work

**Files:**
- Create: `V8__create_course_and_creative_work_schema.sql`
- Create: learning course/creative work ports, use cases, adapters and controllers.
- Test: `CoursePreparationIntegrationTest.java`

1. Write failing tests for P1/T1 material publishing, P3 acknowledgement, team-scoped creative work submission, feedback, versioned resubmission and published immutability.
2. Persist teaching materials, course tasks/submissions, creative work versions, recipe/material-list metadata, poster references and reflections. Object bodies remain under DQ-02.
3. Enforce term/team/stage ownership and visibility; never permit one team to read another team’s draft work.
4. Test/commit `feat: add course preparation and creative work`.

### Task 8: Rubrics, assessment records, portfolios and internal results

**Files:**
- Create: `V9__create_assessment_and_portfolio_schema.sql`
- Create: assessment domain/application/infrastructure/web files.
- Test: `AssessmentPortfolioIntegrationTest.java`

1. Write failing tests for P1 versioned rubric publication, scorer-dimension restrictions, differentiated P2/T1 source attribution, deterministic suggested score, P1 publication and correction-as-new-version.
2. Persist rubric versions/dimensions/weights, scoped assessor grants, assessment records/scores, portfolio membership snapshots and result versions.
3. Generate a portfolio manifest from authorised operations/learning facts; manifest generation never modifies the source facts.
4. Enforce result publication read-only state and correction provenance.
5. Test/commit `feat: add internal assessment portfolios and result publishing`.

### Task 9: External review invitations, archive and export

**Files:**
- Create: `V10__create_review_and_archive_schema.sql`
- Create: assessment invitation/archive ports, use cases, adapters and controllers.
- Test: `ExternalReviewAndArchiveIntegrationTest.java`

1. Do not start this task until DQ-06 is approved. Write failing tests for least-privilege invited access, non-enumerable expiring token, scope-restricted external score submission, archive read-only enforcement and authorised export manifest lookup.
2. Persist invitations, allowed portfolio versions, reviewer score source, archive state/transition and export manifests. Do not store reviewer passwords or public media URLs.
3. Implement a dedicated external token verifier with narrowly scoped authorities; it must not reuse P1/P2/T1 management endpoints.
4. Enforce archive transition no sooner than configured 5-year retention and block all normal mutations after archive.
5. Test/commit `feat: add external review archive and export contracts`.

### Task 10: Server filesystem media adapter, access and lifecycle runbooks

**Files:**
- Create: local filesystem media adapter, media properties, file-version migration, scheduled purge task and integration tests.
- Modify: evidence controller/use case, evidence repository, `application*.yml`, `.env.example`, `README.md`, runbooks and PRD change log.

1. DQ-02 is confirmed: production root is `/data/beverage-ops/media`; upload is backend Multipart only; PostgreSQL stores only relative paths and metadata; no backup or virus scanner is added. Write failing tests for allowed/denied types, scoped upload/download, `Range` video reads, replacement/withdrawal history and a purge that never deletes current content.
2. Implement a local adapter behind an evidence media port. Stage under the configured root, validate extension/MIME/signature and macro-free OOXML container, compute SHA-256, then atomically publish an application-generated relative path. Never accept or return a server filesystem path.
3. Persist immutable file version metadata. Replaced/withdrawn physical files receive `purge_after = now + 3 days`; current files remain until superseded or withdrawn. A daily task removes only due non-current physical files and preserves the database/audit fact even when a file is already missing.
4. Stream all reads through a reauthorising controller; no public/static media route. Enforce `nosniff` and `no-store`, force document download, and support standard HTTP range responses for video.
5. Add server-directory startup/incident/no-backup runbooks. Test/package/compose verify; commit `feat: add protected server media storage`.

### Task 11: System verification and PRD traceability

**Files:**
- Modify: `docs/plans/2026-08-02-beverage-training-operations-system-design.md`
- Create: `docs/traceability/prd-api-acceptance-matrix.md`
- Create/extend: end-to-end integration tests for every section-10 acceptance scenario.

1. Write an acceptance matrix mapping every BR-GOV/SHF/OPS/DATA/EDU/CRS/ASM/COM/AUD/ARC rule to role, API, state transition, permission test and acceptance test.
2. Run all Maven tests and package build; run Docker Compose health checks with only generated new PostgreSQL data.
3. Add implementation status/change-log entries to the PRD and list still-open DQ items explicitly.
4. Commit `docs: record prd backend traceability`.

## 5. Verification gates

At the end of each task, run its focused Testcontainers suite, then `cd apps/backend && ./mvnw test && ./mvnw package`. Before any release claim, run `git diff --check`, validate `docker compose config`, and execute the relevant PRD section-10 scenario with real authenticated roles.

No task is complete if it merely exposes a controller: it must prove correct roles, scope, state transition, audit event, immutable history and a fresh Flyway schema path.
