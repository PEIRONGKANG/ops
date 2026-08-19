# Server Media Storage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add authorised, server-filesystem-backed binary evidence upload, retrieval, replacement, withdrawal and three-day historical-file purging without storing absolute paths or binary data in PostgreSQL.

**Architecture:** The `operations` application layer owns evidence-file state and authorisation, and calls a narrow `EvidenceMediaStoragePort`. A local infrastructure adapter stages data below a configured root, validates it, hashes it and atomically publishes an application-generated relative path. PostgreSQL persists immutable file-version metadata; the web adapter streams only current content after reauthorisation, including HTTP Range support for video.

**Tech Stack:** Java 21, Spring Boot 3.4, Spring MVC Multipart, JDBC/PostgreSQL/Flyway, `java.nio.file`, scheduled Spring tasks, MockMvc, Testcontainers PostgreSQL.

**Approved design:** `docs/plans/2026-08-19-server-media-storage-design.md`

---

### Task 1: Configuration and media-domain contracts

**Files:**

- Create: `apps/backend/src/main/java/com/beverageops/operations/application/usecase/MediaStorageProperties.java`
- Create: `apps/backend/src/main/java/com/beverageops/operations/domain/model/EvidenceFileStatus.java`
- Create: `apps/backend/src/main/java/com/beverageops/operations/domain/model/EvidenceMediaType.java`
- Create: `apps/backend/src/main/java/com/beverageops/operations/domain/port/EvidenceMediaStoragePort.java`
- Modify: `apps/backend/src/main/resources/application.yml`
- Modify: `.env.example`
- Test: `apps/backend/src/test/java/com/beverageops/operations/application/usecase/MediaStoragePropertiesTest.java`

1. Write a failing configuration-binding test. It verifies that an explicit media root is normalized to an absolute path, and that production configuration fails when `BEVERAGE_OPS_MEDIA_ROOT` is empty.
2. Run `cd apps/backend && ./mvnw -Dtest=MediaStoragePropertiesTest test`; expect failure because the property binding does not exist.
3. Implement immutable media properties for `root`, root-local staging directory and purge cron. Local development may have a local default; production requires `BEVERAGE_OPS_MEDIA_ROOT`. Add file statuses `CURRENT`, `REPLACED`, `WITHDRAWN`, `PURGED`; encode the approved allowlist and limits in `EvidenceMediaType`. Define a storage port with relative-path metadata values only—never `Path` or a user-supplied filename.
4. Rerun the test and expect success.
5. Commit: `feat: add evidence media storage contracts`.

### Task 2: File-version schema and JDBC persistence

**Files:**

- Create: `apps/backend/src/main/resources/db/migration/V10__create_evidence_file_version_schema.sql`
- Modify: `apps/backend/src/main/java/com/beverageops/operations/domain/port/ShiftExecutionRepository.java`
- Modify: `apps/backend/src/main/java/com/beverageops/operations/infrastructure/persistence/JdbcShiftExecutionRepository.java`
- Test: `apps/backend/src/test/java/com/beverageops/operations/infrastructure/persistence/EvidenceFileVersionSchemaIntegrationTest.java`

1. Write a failing PostgreSQL integration test: one evidence has one `CURRENT` file; a second `CURRENT` row fails; `REPLACED`/`WITHDRAWN` records carry `purge_after`; a `PURGED` record retains filename, SHA-256 and timestamps.
2. Run `./mvnw -Dtest=EvidenceFileVersionSchemaIntegrationTest test`; expect the table-not-found failure.
3. Add `ops_evidence_file_versions` with UUID, evidence UUID, monotonic version, relative path, display name, safe extension, declared/detected MIME, byte size, SHA-256, status, reason, actor IDs, timestamps, purge time, purge result. Add `(evidence_id, file_version)` uniqueness and a partial unique index for a single `CURRENT` row. Add JDBC methods to lock/insert/list versions, replace/withdraw the current version, select due purges and mark outcomes. Do not add an absolute path or blob column.
4. Rerun the integration test and expect success with Docker/Testcontainers available.
5. Commit: `feat: persist evidence file versions`.

### Task 3: Local staged-file validation and atomic publication

**Files:**

- Create: `apps/backend/src/main/java/com/beverageops/operations/infrastructure/media/LocalEvidenceMediaStorageAdapter.java`
- Create: `apps/backend/src/main/java/com/beverageops/operations/infrastructure/media/EvidenceMediaValidationException.java`
- Create: `apps/backend/src/main/java/com/beverageops/operations/infrastructure/media/MediaSignatureValidator.java`
- Test: `apps/backend/src/test/java/com/beverageops/operations/infrastructure/media/LocalEvidenceMediaStorageAdapterTest.java`

1. Write failing adapter tests using a temporary configured root. Assert allowed JPEG/PNG/WebP/PDF/docx/xlsx/pptx/mp4/webm/mov inputs produce `evidence/{evidenceId}/v{version}/{uuid}.ext`, SHA-256 and exact byte count. Assert rejected formats (`.doc`, `.xls`, `.ppt`, `.docm`, `.xlsm`, `.pptm`), traversal names, MIME/signature mismatches, OOXML macro ZIP members, files over 50 MB and videos over 500 MB leave no published/staging content.
2. Run `./mvnw -Dtest=LocalEvidenceMediaStorageAdapterTest test`; expect failure because no adapter exists.
3. Stream Multipart input to `.staging/{uploadUuid}.part`, enforce bytes and calculate SHA-256; validate extension, declared MIME and content signature/container. Reject `vbaProject.bin` and macro relationships in OOXML ZIPs. Generate every relative path on the server and resolve it only with `root.resolve(...).normalize().startsWith(root)`. Publish with atomic move where supported and always clear staging on failure.
4. Rerun the adapter test and expect success.
5. Commit: `feat: validate and stage evidence media files`.

### Task 4: Evidence-file lifecycle and authorisation

**Files:**

- Modify: `apps/backend/src/main/java/com/beverageops/operations/application/usecase/ShiftExecutionUseCase.java`
- Modify: `apps/backend/src/main/java/com/beverageops/operations/domain/port/ShiftExecutionRepository.java`
- Create: `apps/backend/src/main/java/com/beverageops/operations/application/usecase/EvidenceFileNotCurrentException.java`
- Test: `apps/backend/src/test/java/com/beverageops/operations/application/usecase/ShiftExecutionEvidenceFileUseCaseTest.java`

1. Write failing use-case tests with fake repository/storage ports. Verify current evidence scope controls attachment/read access; files attach only to `OBJECT_REFERENCE`; replacement requires a reason and moves prior file to `REPLACED` with `purgeAfter = now + 3 days`; withdrawal requires a reason and moves current file to `WITHDRAWN`; all actions emit append-only audits.
2. Run `./mvnw -Dtest=ShiftExecutionEvidenceFileUseCaseTest test`; expect failure because lifecycle commands are absent.
3. Add upload, list, authorised-read, replacement and withdrawal commands/projections. Reuse existing task/milestone/shift authorisation. Lock evidence/current version transactionally. Coordinate staged file publication with persistence and compensate by deleting the new file on a database failure. Audit `EVIDENCE_FILE_UPLOADED`, `EVIDENCE_FILE_REPLACED`, `EVIDENCE_FILE_WITHDRAWN` and `EVIDENCE_FILE_ACCESSED`.
4. Rerun the use-case tests and expect success.
5. Commit: `feat: add evidence file lifecycle`.

### Task 5: Multipart endpoints, authorised retrieval and video ranges

**Files:**

- Modify: `apps/backend/src/main/java/com/beverageops/operations/adapter/in/web/OperationsSchedulingController.java`
- Modify: `apps/backend/src/main/java/com/beverageops/shared/web/ApiExceptionHandler.java`
- Test: `apps/backend/src/test/java/com/beverageops/operations/adapter/in/web/EvidenceMediaIntegrationTest.java`

1. Write failing PostgreSQL/MockMvc integration tests. Create P3-owned `OBJECT_REFERENCE` evidence; upload a `MockMultipartFile`; assert response and database expose a relative path only. Assert unassigned P3 and out-of-scope P2 receive 403 for upload/list/download. Assert PDF retrieval emits attachment, `X-Content-Type-Options: nosniff` and `Cache-Control: no-store`; assert video `Range: bytes=0-1023` emits `206`, `Accept-Ranges`, exact `Content-Range` and only requested bytes. Assert replacement/withdrawal require reasons and validation failure leaves no current file/version.
2. Run `./mvnw -Dtest=EvidenceMediaIntegrationTest test`; expect failure because endpoints do not exist.
3. Add exactly these APIs: `POST /api/v1/evidence/{id}/files`, `GET /api/v1/evidence/{id}/files`, `GET /api/v1/evidence/{id}/files/current`, `POST /api/v1/evidence/{id}/files/replace`, `POST /api/v1/evidence/{id}/files/withdraw`. Accept only multipart content and metadata required by the design; never accept a client file path/reference. Stream reads after every-request authorisation. Parse a single valid range for video MIME types and return 416 for invalid/out-of-bounds values. Map validation/state errors to `{code,message,requestId}`.
4. Rerun the integration test and expect success with Docker/Testcontainers available.
5. Commit: `feat: expose authorised evidence media APIs`.

### Task 6: Scheduled historical-file purge

**Files:**

- Create: `apps/backend/src/main/java/com/beverageops/operations/application/usecase/EvidenceFilePurgeJob.java`
- Modify: `apps/backend/src/main/java/com/beverageops/operations/infrastructure/media/LocalEvidenceMediaStorageAdapter.java`
- Modify: `apps/backend/src/main/java/com/beverageops/operations/domain/port/ShiftExecutionRepository.java`
- Modify: `apps/backend/src/main/java/com/beverageops/operations/infrastructure/persistence/JdbcShiftExecutionRepository.java`
- Test: `apps/backend/src/test/java/com/beverageops/operations/application/usecase/EvidenceFilePurgeJobTest.java`

1. Write failing tests with a fixed `Clock` and fake storage port. Due `REPLACED` and `WITHDRAWN` versions delete and become `PURGED`; a `CURRENT` version is never selected; missing files become `PURGED` with `MISSING_ON_PURGE`; a deletion failure records `DELETE_FAILED` and does not stop later records.
2. Run `./mvnw -Dtest=EvidenceFilePurgeJobTest test`; expect failure because no job exists.
3. Enable scheduling. Implement an injectable purge method with `@Scheduled(cron = "${beverage-ops.media.purge-cron}")`, bounded batch selection and individual row locking. Use the safe local adapter to delete only non-current relative paths. Persist `PURGED`/result and append audits; retain all historical metadata. Never delete business records or `CURRENT` physical files.
4. Rerun the test and expect success.
5. Commit: `feat: purge expired evidence file versions`.

### Task 7: Runbooks, traceability and full verification

**Files:**

- Modify: `.env.example`
- Modify: `README.md`
- Create: `docs/runbooks/media-storage.md`
- Modify: `docs/traceability/prd-api-acceptance-matrix.md`
- Modify: `docs/plans/2026-08-02-beverage-training-operations-system-design.md`

1. Write the runbook checklist first: root ownership/permissions, disk-space responsibility, no-backup and no-virus-scan risks, staged-file cleanup after interruption, handling `DELETE_FAILED`, proof that the directory is not statically served, and the rule that current content is never purged.
2. Add the documented production root, required environment variables, type/size restrictions, historical three-day purge and recovery limits. Mark BR-OPS-04/05 and Task 10 complete only after all relevant integration tests pass; keep DQ-07 open.
3. Run the full verification:

   ```bash
   export JAVA_HOME="$(/usr/libexec/java_home -v 21)"
   cd apps/backend
   ./mvnw test
   ./mvnw package
   cd ../..
   git diff --check
   git status --short
   ```

   Expected: all unit and PostgreSQL integration tests pass and package succeeds. If Docker is unavailable, record the environment failure separately; do not claim the integration suite passed.

4. Commit: `docs: document server media storage operations`.
