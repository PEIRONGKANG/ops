package com.beverageops.operations.infrastructure.persistence;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.operations.domain.model.EvidenceKind;
import com.beverageops.operations.domain.model.EvidenceFileStatus;
import com.beverageops.operations.domain.model.EvidenceMediaType;
import com.beverageops.operations.domain.model.MilestoneDecision;
import com.beverageops.operations.domain.model.TaskCompletionStatus;
import com.beverageops.operations.domain.port.ShiftExecutionRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class JdbcShiftExecutionRepository implements ShiftExecutionRepository {

    private final JdbcTemplate jdbcTemplate;

    JdbcShiftExecutionRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<TemplateComponent> findTemplateComponents(UUID templateVersionId, String componentType) {
        return jdbcTemplate.query("""
                        select id, code, name, configuration::text
                        from gov_template_components
                        where template_version_id = ? and component_type = ?
                        order by code
                        """, (resultSet, rowNumber) -> new TemplateComponent(resultSet.getObject("id", UUID.class),
                resultSet.getString("code"), resultSet.getString("name"), resultSet.getString("configuration")),
                templateVersionId, componentType);
    }

    @Override
    public List<AssignmentProjection> findActiveAssignments(UUID shiftId) {
        return jdbcTemplate.query("""
                        select id, account_id, role_code from ops_shift_assignments
                        where shift_id = ? and status = 'ASSIGNED' order by created_at
                        """, (resultSet, rowNumber) -> new AssignmentProjection(resultSet.getObject("id", UUID.class),
                resultSet.getObject("account_id", UUID.class), resultSet.getString("role_code")), shiftId);
    }

    @Override
    public void createTaskCompletion(UUID id, UUID shiftId, UUID assignmentId, UUID sourceTemplateComponentId, String code,
                                     String name, String roleCode, String definitionSnapshotJson, boolean evidenceRequired,
                                     boolean p2AcceptanceRequired) {
        jdbcTemplate.update("""
                insert into ops_task_completions
                    (id, shift_id, assignment_id, source_template_component_id, code, name, role_code, definition_snapshot,
                     evidence_required, p2_acceptance_required, status)
                values (?, ?, ?, ?, ?, ?, ?, cast(? as jsonb), ?, ?, 'PENDING')
                """, id, shiftId, assignmentId, sourceTemplateComponentId, code, name, roleCode, definitionSnapshotJson,
                evidenceRequired, p2AcceptanceRequired);
    }

    @Override
    public void createMilestoneSubmission(UUID id, UUID shiftId, UUID sourceTemplateComponentId, String code, String name,
                                          String definitionSnapshotJson, boolean required, boolean evidenceRequired) {
        jdbcTemplate.update("""
                insert into ops_milestone_submissions
                    (id, shift_id, source_template_component_id, code, name, definition_snapshot, required, evidence_required,
                     status)
                values (?, ?, ?, ?, ?, cast(? as jsonb), ?, ?, 'PENDING')
                """, id, shiftId, sourceTemplateComponentId, code, name, definitionSnapshotJson, required, evidenceRequired);
    }

    @Override
    public List<TaskCompletion> findTaskCompletions(UUID shiftId) {
        return jdbcTemplate.query(taskSelect() + " where t.shift_id = ? order by t.code", (resultSet, rowNumber) -> task(resultSet),
                shiftId);
    }

    @Override
    public Optional<TaskCompletion> lockTaskCompletion(UUID taskCompletionId) {
        return jdbcTemplate.query(taskSelect() + " where t.id = ? for update of t",
                resultSet -> resultSet.next() ? Optional.of(task(resultSet)) : Optional.empty(), taskCompletionId);
    }

    @Override
    public TaskCompletion transitionTaskCompletion(UUID taskCompletionId, TaskCompletionStatus expectedStatus,
                                                   TaskCompletionStatus nextStatus, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update ops_task_completions
                        set status = ?, version = version + 1, updated_at = current_timestamp
                        where id = ? and status = ? and version = ?
                        returning id, shift_id, assignment_id, code, name, role_code, evidence_required,
                                  p2_acceptance_required, status, version, updated_at
                        """, (resultSet, rowNumber) -> taskFromTransition(resultSet), nextStatus.name(), taskCompletionId,
                expectedStatus.name(), expectedVersion);
    }

    @Override
    public void appendTaskHistory(UUID taskCompletionId, String eventType, UUID actorId, String reason,
                                  TaskCompletionStatus previousStatus, TaskCompletionStatus nextStatus, long previousVersion,
                                  long newVersion) {
        jdbcTemplate.update("""
                insert into ops_task_completion_history
                    (id, task_completion_id, event_type, actor_account_id, reason, previous_status, next_status,
                     previous_version, new_version)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), taskCompletionId, eventType, actorId, reason, previousStatus.name(), nextStatus.name(),
                previousVersion, newVersion);
    }

    @Override
    public List<MilestoneSubmission> findMilestoneSubmissions(UUID shiftId) {
        return jdbcTemplate.query(milestoneSelect() + " where m.shift_id = ? order by m.code",
                (resultSet, rowNumber) -> milestone(resultSet), shiftId);
    }

    @Override
    public Optional<MilestoneSubmission> lockMilestoneSubmission(UUID milestoneSubmissionId) {
        return jdbcTemplate.query(milestoneSelect() + " where m.id = ? for update of m",
                resultSet -> resultSet.next() ? Optional.of(milestone(resultSet)) : Optional.empty(), milestoneSubmissionId);
    }

    @Override
    public MilestoneSubmission transitionMilestone(UUID milestoneSubmissionId, MilestoneDecision expectedStatus,
                                                   MilestoneDecision nextStatus, UUID submittedByAccountId, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update ops_milestone_submissions
                        set status = ?, submitted_by_account_id = coalesce(?, submitted_by_account_id), version = version + 1,
                            updated_at = current_timestamp
                        where id = ? and status = ? and version = ?
                        returning id, shift_id, code, name, required, evidence_required, status, submitted_by_account_id,
                                  version, updated_at
                        """, (resultSet, rowNumber) -> milestone(resultSet), nextStatus.name(), submittedByAccountId,
                milestoneSubmissionId, expectedStatus.name(), expectedVersion);
    }

    @Override
    public void appendMilestoneDecision(UUID milestoneSubmissionId, MilestoneDecision decision, UUID actorId, String reason,
                                        MilestoneDecision previousStatus, MilestoneDecision nextStatus, long previousVersion,
                                        long newVersion) {
        jdbcTemplate.update("""
                insert into ops_milestone_decisions
                    (id, milestone_submission_id, decision, actor_account_id, reason, previous_status, next_status,
                     previous_version, new_version)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), milestoneSubmissionId, decision.name(), actorId, reason, previousStatus.name(),
                nextStatus.name(), previousVersion, newVersion);
    }

    @Override
    public Evidence createEvidence(UUID id, UUID shiftId, UUID taskCompletionId, UUID milestoneSubmissionId, EvidenceKind kind,
                                   String textContent, String externalUrl, String referenceValue, OffsetDateTime occurredAt,
                                   UUID submittedByAccountId) {
        return jdbcTemplate.queryForObject("""
                        insert into ops_evidence
                            (id, shift_id, task_completion_id, milestone_submission_id, kind, text_content, external_url,
                             reference_value, occurred_at, submitted_by_account_id)
                        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        returning id, shift_id, task_completion_id, milestone_submission_id, kind, occurred_at,
                                  submitted_by_account_id, version, updated_at
                        """, (resultSet, rowNumber) -> evidence(resultSet), id, shiftId, taskCompletionId, milestoneSubmissionId,
                kind.name(), textContent, externalUrl, referenceValue, occurredAt, submittedByAccountId);
    }

    @Override
    public Optional<Evidence> lockEvidence(UUID evidenceId) {
        return evidenceById(evidenceId, " for update");
    }

    @Override
    public Optional<Evidence> findEvidence(UUID evidenceId) {
        return evidenceById(evidenceId, "");
    }

    @Override
    public long nextEvidenceFileVersion(UUID evidenceId) {
        var version = jdbcTemplate.queryForObject("""
                        select coalesce(max(file_version), 0) + 1
                        from ops_evidence_file_versions where evidence_id = ?
                        """, Long.class, evidenceId);
        return version == null ? 1L : version;
    }

    @Override
    public EvidenceFileVersion insertCurrentEvidenceFileVersion(NewEvidenceFileVersion version) {
        return jdbcTemplate.queryForObject("""
                        insert into ops_evidence_file_versions
                            (id, evidence_id, file_version, relative_path, original_filename, safe_extension,
                             declared_mime_type, detected_mime_type, byte_size, sha256, status, uploaded_by_account_id)
                        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CURRENT', ?)
                        returning id, evidence_id, file_version, relative_path, original_filename, safe_extension,
                                  declared_mime_type, detected_mime_type, byte_size, sha256, status, reason,
                                  uploaded_by_account_id, changed_by_account_id, created_at, updated_at, purge_after,
                                  purged_at, purge_result
                        """, (resultSet, rowNumber) -> evidenceFileVersion(resultSet), version.id(), version.evidenceId(),
                version.fileVersion(), version.relativePath(), version.originalFilename(), version.mediaType().extension(),
                version.declaredMimeType(), version.detectedMimeType(), version.byteSize(), version.sha256(),
                version.uploadedByAccountId());
    }

    @Override
    public Optional<EvidenceFileVersion> lockCurrentEvidenceFileVersion(UUID evidenceId) {
        return currentEvidenceFileVersion(evidenceId, " for update");
    }

    @Override
    public Optional<EvidenceFileVersion> findCurrentEvidenceFileVersion(UUID evidenceId) {
        return currentEvidenceFileVersion(evidenceId, "");
    }

    @Override
    public List<EvidenceFileVersion> findEvidenceFileVersions(UUID evidenceId) {
        return jdbcTemplate.query(evidenceFileVersionSelect() + " where evidence_id = ? order by file_version desc",
                (resultSet, rowNumber) -> evidenceFileVersion(resultSet), evidenceId);
    }

    @Override
    public EvidenceFileVersion replaceCurrentEvidenceFileVersion(UUID evidenceId, UUID actorId, String reason,
                                                                  OffsetDateTime purgeAfter) {
        return transitionCurrentEvidenceFileVersion(evidenceId, actorId, reason, purgeAfter, EvidenceFileStatus.REPLACED);
    }

    @Override
    public EvidenceFileVersion withdrawCurrentEvidenceFileVersion(UUID evidenceId, UUID actorId, String reason,
                                                                   OffsetDateTime purgeAfter) {
        return transitionCurrentEvidenceFileVersion(evidenceId, actorId, reason, purgeAfter, EvidenceFileStatus.WITHDRAWN);
    }

    @Override
    public List<EvidenceFileVersion> lockDueEvidenceFileVersions(OffsetDateTime dueBefore, int limit) {
        return jdbcTemplate.query(evidenceFileVersionSelect() + """
                        where status in ('REPLACED', 'WITHDRAWN') and purge_after <= ?
                        order by purge_after, id
                        limit ? for update skip locked
                        """, (resultSet, rowNumber) -> evidenceFileVersion(resultSet), dueBefore, limit);
    }

    @Override
    public EvidenceFileVersion markEvidenceFileVersionPurged(UUID evidenceFileVersionId, OffsetDateTime purgedAt,
                                                              String purgeResult) {
        return jdbcTemplate.queryForObject("""
                        update ops_evidence_file_versions
                        set status = 'PURGED', purged_at = ?, purge_result = ?, updated_at = current_timestamp
                        where id = ? and status in ('REPLACED', 'WITHDRAWN')
                        returning id, evidence_id, file_version, relative_path, original_filename, safe_extension,
                                  declared_mime_type, detected_mime_type, byte_size, sha256, status, reason,
                                  uploaded_by_account_id, changed_by_account_id, created_at, updated_at, purge_after,
                                  purged_at, purge_result
                        """, (resultSet, rowNumber) -> evidenceFileVersion(resultSet), purgedAt, purgeResult,
                evidenceFileVersionId);
    }

    @Override
    public boolean hasEvidenceForTask(UUID taskCompletionId) {
        return exists("select exists (select 1 from ops_evidence where task_completion_id = ?)", taskCompletionId);
    }

    @Override
    public boolean hasEvidenceForMilestone(UUID milestoneSubmissionId) {
        return exists("select exists (select 1 from ops_evidence where milestone_submission_id = ?)", milestoneSubmissionId);
    }

    @Override
    public boolean hasUnapprovedRequiredMilestones(UUID shiftId) {
        return exists("""
                select exists (
                    select 1 from ops_milestone_submissions
                    where shift_id = ? and required and status <> 'APPROVED'
                )
                """, shiftId);
    }

    private boolean exists(String sql, UUID id) {
        return Boolean.TRUE.equals(jdbcTemplate.query(sql, resultSet -> resultSet.next() && resultSet.getBoolean(1), id));
    }

    private String taskSelect() {
        return """
                select t.id, t.shift_id, t.assignment_id, a.account_id, t.code, t.name, t.role_code, t.evidence_required,
                       t.p2_acceptance_required, t.status, t.version, t.updated_at
                from ops_task_completions t join ops_shift_assignments a on a.id = t.assignment_id
                """;
    }

    private String milestoneSelect() {
        return """
                select m.id, m.shift_id, m.code, m.name, m.required, m.evidence_required, m.status, m.submitted_by_account_id,
                       m.version, m.updated_at
                from ops_milestone_submissions m
                """;
    }

    private EvidenceFileVersion transitionCurrentEvidenceFileVersion(UUID evidenceId, UUID actorId, String reason,
                                                                      OffsetDateTime purgeAfter, EvidenceFileStatus status) {
        return jdbcTemplate.queryForObject("""
                        update ops_evidence_file_versions
                        set status = ?, reason = ?, changed_by_account_id = ?, purge_after = ?, updated_at = current_timestamp
                        where evidence_id = ? and status = 'CURRENT'
                        returning id, evidence_id, file_version, relative_path, original_filename, safe_extension,
                                  declared_mime_type, detected_mime_type, byte_size, sha256, status, reason,
                                  uploaded_by_account_id, changed_by_account_id, created_at, updated_at, purge_after,
                                  purged_at, purge_result
                        """, (resultSet, rowNumber) -> evidenceFileVersion(resultSet), status.name(), reason, actorId,
                purgeAfter, evidenceId);
    }

    private Optional<Evidence> evidenceById(UUID evidenceId, String lockingClause) {
        return jdbcTemplate.query("""
                        select id, shift_id, task_completion_id, milestone_submission_id, kind, occurred_at,
                               submitted_by_account_id, version, updated_at
                        from ops_evidence where id = ?
                        """ + lockingClause, resultSet -> resultSet.next() ? Optional.of(evidence(resultSet)) : Optional.empty(),
                evidenceId);
    }

    private Optional<EvidenceFileVersion> currentEvidenceFileVersion(UUID evidenceId, String lockingClause) {
        return jdbcTemplate.query(evidenceFileVersionSelect() + " where evidence_id = ? and status = 'CURRENT'" + lockingClause,
                resultSet -> resultSet.next() ? Optional.of(evidenceFileVersion(resultSet)) : Optional.empty(), evidenceId);
    }

    private String evidenceFileVersionSelect() {
        return """
                select id, evidence_id, file_version, relative_path, original_filename, safe_extension,
                       declared_mime_type, detected_mime_type, byte_size, sha256, status, reason,
                       uploaded_by_account_id, changed_by_account_id, created_at, updated_at, purge_after,
                       purged_at, purge_result
                from ops_evidence_file_versions
                """;
    }

    private TaskCompletion task(ResultSet resultSet) throws java.sql.SQLException {
        return new TaskCompletion(resultSet.getObject("id", UUID.class), resultSet.getObject("shift_id", UUID.class),
                resultSet.getObject("assignment_id", UUID.class), resultSet.getObject("account_id", UUID.class),
                resultSet.getString("code"), resultSet.getString("name"), resultSet.getString("role_code"),
                resultSet.getBoolean("evidence_required"), resultSet.getBoolean("p2_acceptance_required"),
                TaskCompletionStatus.valueOf(resultSet.getString("status")), resultSet.getLong("version"),
                resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private TaskCompletion taskFromTransition(ResultSet resultSet) throws java.sql.SQLException {
        return new TaskCompletion(resultSet.getObject("id", UUID.class), resultSet.getObject("shift_id", UUID.class),
                resultSet.getObject("assignment_id", UUID.class), null, resultSet.getString("code"),
                resultSet.getString("name"), resultSet.getString("role_code"), resultSet.getBoolean("evidence_required"),
                resultSet.getBoolean("p2_acceptance_required"), TaskCompletionStatus.valueOf(resultSet.getString("status")),
                resultSet.getLong("version"), resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private MilestoneSubmission milestone(ResultSet resultSet) throws java.sql.SQLException {
        return new MilestoneSubmission(resultSet.getObject("id", UUID.class), resultSet.getObject("shift_id", UUID.class),
                resultSet.getString("code"), resultSet.getString("name"), resultSet.getBoolean("required"),
                resultSet.getBoolean("evidence_required"), MilestoneDecision.valueOf(resultSet.getString("status")),
                resultSet.getObject("submitted_by_account_id", UUID.class), resultSet.getLong("version"),
                resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private Evidence evidence(ResultSet resultSet) throws java.sql.SQLException {
        return new Evidence(resultSet.getObject("id", UUID.class), resultSet.getObject("shift_id", UUID.class),
                resultSet.getObject("task_completion_id", UUID.class), resultSet.getObject("milestone_submission_id", UUID.class),
                EvidenceKind.valueOf(resultSet.getString("kind")), resultSet.getObject("occurred_at", OffsetDateTime.class),
                resultSet.getObject("submitted_by_account_id", UUID.class), resultSet.getLong("version"),
                resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private EvidenceFileVersion evidenceFileVersion(ResultSet resultSet) throws java.sql.SQLException {
        return new EvidenceFileVersion(resultSet.getObject("id", UUID.class), resultSet.getObject("evidence_id", UUID.class),
                resultSet.getLong("file_version"), resultSet.getString("relative_path"),
                resultSet.getString("original_filename"), EvidenceMediaType.fromFilename(
                        "file." + resultSet.getString("safe_extension")), resultSet.getString("declared_mime_type"),
                resultSet.getString("detected_mime_type"), resultSet.getLong("byte_size"), resultSet.getString("sha256"),
                EvidenceFileStatus.valueOf(resultSet.getString("status")), resultSet.getString("reason"),
                resultSet.getObject("uploaded_by_account_id", UUID.class), resultSet.getObject("changed_by_account_id", UUID.class),
                resultSet.getObject("created_at", OffsetDateTime.class), resultSet.getObject("updated_at", OffsetDateTime.class),
                resultSet.getObject("purge_after", OffsetDateTime.class), resultSet.getObject("purged_at", OffsetDateTime.class),
                resultSet.getString("purge_result"));
    }
}
