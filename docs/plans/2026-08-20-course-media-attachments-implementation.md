# 课程域受控媒体附件 Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Add authorised, versioned local-server attachments to teaching materials, course-task submissions and creative works without introducing public URLs or any legacy-data compatibility path.

**Architecture:** Generalise the existing protected filesystem media port so evidence and learning resources share one validation, staging, range-read and deletion implementation. The learning application layer owns host-state and scope authorisation, records immutable attachment versions through a learning repository port, and invokes the generic storage port only with server-controlled namespace/id/version data.

**Tech Stack:** Java 21, Spring Boot 3.4.5, Spring MVC Multipart, JDBC/PostgreSQL/Flyway, `java.nio.file`, JUnit 5, MockMvc and Testcontainers PostgreSQL.

---

### Task 1: Generalise the protected media storage boundary

**Files:**

- Create: `apps/backend/src/main/java/com/beverageops/shared/media/ProtectedMediaStoragePort.java`
- Move/rename: existing operations media port and local adapter as required
- Modify: evidence storage use case, controller and purge job callers
- Test: existing `LocalEvidenceMediaStorageAdapterTest.java`

1. Add a focused failing test that passes a controlled `course/TEACHING_MATERIAL` namespace and asserts the adapter publishes only `course/TEACHING_MATERIAL/{uuid}/v1/{uuid}.pdf` below its configured root.
2. Run the adapter test and confirm it fails because the storage contract only permits the evidence namespace.
3. Replace the evidence-specific upload value with a generic server-supplied `namespace`, `ownerId` and `fileVersion` contract. Preserve every existing validation and use `evidence/{id}` for current operations callers.
4. Run adapter and existing evidence media tests; commit `refactor: share protected media storage boundary`.

### Task 2: Persist course attachment versions and purge them safely

**Files:**

- Create: `apps/backend/src/main/resources/db/migration/V11__create_course_media_file_version_schema.sql`
- Modify: `CoursePreparationRepository.java`, `JdbcCoursePreparationRepository.java`
- Modify: shared purge job or add a learning-media purge collaborator
- Test: `CourseMediaFileVersionSchemaIntegrationTest.java`, `EvidenceFilePurgeJobTest.java`

1. Write failing PostgreSQL tests for one `CURRENT` file per `(owner_type, owner_id)`, immutable historical metadata and due `REPLACED`/`WITHDRAWN` selection.
2. Run the focused schema test and confirm Flyway lacks the relation.
3. Add immutable version table, check constraints, partial unique index, row-locking persistence operations and state/result updates. Extend purge selection so only non-current course records can be removed.
4. Rerun schema/purge tests; commit `feat: persist course media file versions`.

### Task 3: Enforce course-domain attachment lifecycle and authorisation

**Files:**

- Modify: `CoursePreparationUseCase.java`, `CoursePreparationRepository.java`
- Add: course media projection/command records and state exception as needed
- Test: `CoursePreparationMediaFileUseCaseTest.java`

1. Write failing use-case tests with fake ports for draft-only material/creative changes, submitted-task creator restrictions, team/P1/T1 read scopes, required replacement/withdrawal reasons and rollback compensation.
2. Run the focused use-case test and confirm attachment commands are absent.
3. Implement upload/list/read/replace/withdraw with host locks, existing course ownership checks, append-only audit and transaction rollback deletion. Do not allow attachment mutation of published materials/works.
4. Rerun the test; commit `feat: add course attachment lifecycle`.

### Task 4: Expose multipart APIs and verify whole behaviour

**Files:**

- Modify: `CoursePreparationController.java`
- Modify: `CoursePreparationIntegrationTest.java` or add `CourseMediaIntegrationTest.java`
- Modify: `docs/traceability/prd-api-acceptance-matrix.md`, `README.md`, media runbook and product design only where status changes

1. Write failing MockMvc tests for each host route, role scopes, published-resource write denial, type rejection with no version, security download headers and video `Range`.
2. Run the focused test and confirm routes do not exist.
3. Add the five multipart/read routes under each host prefix, reuse a single streaming response helper and map errors through the established API error contract.
4. Run the focused tests then `cd apps/backend && ./mvnw test && ./mvnw package`; run `git diff --check` and a `docker compose config` production-media mount check.
5. Update traceability to say exactly which course resources have binary attachments, keep DQ-05/06/07 open, then commit `feat: expose authorised course media attachments`.
