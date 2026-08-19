package com.beverageops.learning.infrastructure.persistence;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.learning.domain.model.CertificationStatus;
import com.beverageops.learning.domain.model.RetrainingStatus;
import com.beverageops.learning.domain.port.LearningProgressRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class JdbcLearningProgressRepository implements LearningProgressRepository {

    private final JdbcTemplate jdbcTemplate;

    JdbcLearningProgressRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Optional<ShiftScope> findShiftScope(UUID shiftId) {
        return jdbcTemplate.query("""
                        select s.id shift_id, d.term_id, d.store_id
                        from ops_shifts s join ops_operating_days d on d.id = s.operating_day_id
                        where s.id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(new ShiftScope(
                resultSet.getObject("shift_id", UUID.class), resultSet.getObject("term_id", UUID.class),
                resultSet.getObject("store_id", UUID.class))) : Optional.empty(), shiftId);
    }

    @Override
    public Optional<TaskReference> findTaskReference(UUID taskCompletionId) {
        return jdbcTemplate.query("""
                        select t.id task_completion_id, t.shift_id, a.account_id student_account_id
                        from ops_task_completions t
                        join ops_shift_assignments a on a.id = t.assignment_id
                        where t.id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(new TaskReference(
                resultSet.getObject("task_completion_id", UUID.class), resultSet.getObject("shift_id", UUID.class),
                resultSet.getObject("student_account_id", UUID.class))) : Optional.empty(), taskCompletionId);
    }

    @Override
    public Optional<IncidentReference> findIncidentReference(UUID incidentId) {
        return jdbcTemplate.query("""
                        select id incident_id, shift_id, reported_by_account_id, assignee_account_id
                        from ops_incidents where id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(new IncidentReference(
                resultSet.getObject("incident_id", UUID.class), resultSet.getObject("shift_id", UUID.class),
                resultSet.getObject("reported_by_account_id", UUID.class), resultSet.getObject("assignee_account_id", UUID.class)))
                : Optional.empty(), incidentId);
    }

    @Override
    public Optional<EvidenceReference> findEvidenceReference(UUID evidenceId) {
        return jdbcTemplate.query("""
                        select e.id evidence_id, e.shift_id, e.submitted_by_account_id,
                               case when e.task_completion_id is null then null else a.account_id end task_student_account_id
                        from ops_evidence e
                        left join ops_task_completions t on t.id = e.task_completion_id
                        left join ops_shift_assignments a on a.id = t.assignment_id
                        where e.id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(new EvidenceReference(
                resultSet.getObject("evidence_id", UUID.class), resultSet.getObject("shift_id", UUID.class),
                resultSet.getObject("submitted_by_account_id", UUID.class),
                resultSet.getObject("task_student_account_id", UUID.class))) : Optional.empty(), evidenceId);
    }

    @Override
    public Optional<TemplateScope> findPublishedTemplateScope(UUID templateVersionId) {
        return jdbcTemplate.query("""
                        select id, term_id, store_id, status from gov_template_versions
                        where id = ? and status = 'PUBLISHED'
                        """, resultSet -> resultSet.next() ? Optional.of(new TemplateScope(
                resultSet.getObject("id", UUID.class), resultSet.getObject("term_id", UUID.class),
                resultSet.getObject("store_id", UUID.class), resultSet.getString("status"))) : Optional.empty(), templateVersionId);
    }

    @Override
    public Optional<CertificationRule> findCertificationRule(UUID certificationRuleId) {
        return jdbcTemplate.query("""
                        select id, template_version_id, code, name, configuration::text
                        from gov_template_components
                        where id = ? and component_type = 'CERTIFICATION_RULE'
                        """, resultSet -> resultSet.next() ? Optional.of(new CertificationRule(
                resultSet.getObject("id", UUID.class), resultSet.getObject("template_version_id", UUID.class),
                resultSet.getString("code"), resultSet.getString("name"), resultSet.getString("configuration"))) : Optional.empty(),
                certificationRuleId);
    }

    @Override
    public boolean isActiveStudent(UUID termId, UUID accountId) {
        return exists("""
                select exists (
                    select 1
                    from gov_term_memberships m
                    join iam_accounts a on a.id = m.account_id and a.status = 'ACTIVE'
                    where m.term_id = ? and m.account_id = ? and m.status = 'ACTIVE'
                      and m.effective_from <= current_timestamp
                      and (m.effective_until is null or m.effective_until > current_timestamp)
                      and exists (
                          select 1 from iam_role_assignments r
                          where r.account_id = m.account_id and r.role_code = 'P3' and r.revoked_at is null
                            and r.effective_from <= current_timestamp
                            and (r.effective_until is null or r.effective_until > current_timestamp)
                      )
                )
                """, termId, accountId);
    }

    @Override
    public boolean hasScope(UUID accountId, String roleCode, UUID termId, UUID storeId) {
        return exists("""
                select exists (
                    select 1 from ops_scope_grants
                    where account_id = ? and role_code = ? and term_id = ? and store_id = ? and revoked_at is null
                      and effective_from <= current_timestamp
                      and (effective_until is null or effective_until > current_timestamp)
                )
                """, accountId, roleCode, termId, storeId);
    }

    @Override
    public boolean isStudentAssignedToShift(UUID shiftId, UUID accountId) {
        return exists("""
                select exists (
                    select 1 from ops_shift_assignments
                    where shift_id = ? and account_id = ? and status = 'ASSIGNED'
                )
                """, shiftId, accountId);
    }

    @Override
    public boolean isEvidenceOwnedBy(UUID evidenceId, UUID accountId) {
        return exists("select exists (select 1 from ops_evidence where id = ? and submitted_by_account_id = ?)", evidenceId, accountId);
    }

    @Override
    public int countCertificationEvidence(UUID certificationId) {
        return jdbcTemplate.queryForObject("""
                select count(*) from learning_certification_evidence_relations where certification_id = ?
                """, Integer.class, certificationId);
    }

    @Override
    public Feedback createFeedback(UUID id, UUID termId, UUID storeId, UUID studentAccountId, UUID shiftId,
                                   UUID taskCompletionId, UUID incidentId, UUID evidenceId, String observation,
                                   String recommendation, boolean requiresRetraining, OffsetDateTime retrainingDueAt, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        insert into learning_feedback
                            (id, term_id, store_id, student_account_id, shift_id, task_completion_id, incident_id, evidence_id,
                             observation, recommendation, requires_retraining, retraining_due_at, status, created_by_account_id)
                        values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'OPEN', ?)
                        returning id, term_id, store_id, student_account_id, shift_id, task_completion_id, incident_id, evidence_id,
                                  observation, recommendation, requires_retraining, retraining_due_at, status, version,
                                  created_by_account_id, created_at, updated_at
                        """, (resultSet, rowNumber) -> feedback(resultSet), id, termId, storeId, studentAccountId, shiftId,
                taskCompletionId, incidentId, evidenceId, observation, recommendation, requiresRetraining, retrainingDueAt, actorId);
    }

    @Override
    public Optional<Feedback> lockFeedback(UUID feedbackId) {
        return jdbcTemplate.query(feedbackSelect() + " where id = ? for update", resultSet -> resultSet.next()
                ? Optional.of(feedback(resultSet)) : Optional.empty(), feedbackId);
    }

    @Override
    public Feedback updateFeedback(UUID feedbackId, String observation, String recommendation, boolean requiresRetraining,
                                   OffsetDateTime retrainingDueAt, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update learning_feedback
                        set observation = ?, recommendation = ?, requires_retraining = ?, retraining_due_at = ?,
                            version = version + 1, updated_at = current_timestamp
                        where id = ? and status = 'OPEN' and version = ?
                        returning id, term_id, store_id, student_account_id, shift_id, task_completion_id, incident_id, evidence_id,
                                  observation, recommendation, requires_retraining, retraining_due_at, status, version,
                                  created_by_account_id, created_at, updated_at
                        """, (resultSet, rowNumber) -> feedback(resultSet), observation, recommendation, requiresRetraining,
                retrainingDueAt, feedbackId, expectedVersion);
    }

    @Override
    public List<Feedback> findFeedback(UUID termId, UUID storeId) {
        return jdbcTemplate.query(feedbackSelect() + " where term_id = ? and store_id = ? order by created_at desc",
                (resultSet, rowNumber) -> feedback(resultSet), termId, storeId);
    }

    @Override
    public List<Feedback> findFeedbackForStudent(UUID studentAccountId) {
        return jdbcTemplate.query(feedbackSelect() + " where student_account_id = ? order by created_at desc",
                (resultSet, rowNumber) -> feedback(resultSet), studentAccountId);
    }

    @Override
    public void appendFeedbackHistory(UUID feedbackId, String eventType, UUID actorId, String reason,
                                      Long previousVersion, long newVersion) {
        jdbcTemplate.update("""
                insert into learning_feedback_history
                    (id, feedback_id, event_type, actor_account_id, reason, previous_version, new_version)
                values (?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), feedbackId, eventType, actorId, reason, previousVersion, newVersion);
    }

    @Override
    public Retraining createRetraining(UUID id, UUID feedbackId, UUID termId, UUID storeId, UUID studentAccountId,
                                       OffsetDateTime dueAt, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        insert into learning_retraining
                            (id, feedback_id, term_id, store_id, student_account_id, status, due_at, created_by_account_id)
                        values (?, ?, ?, ?, ?, 'PENDING', ?, ?)
                        returning id, feedback_id, term_id, store_id, student_account_id, status, due_at, version,
                                  created_by_account_id, created_at, updated_at
                        """, (resultSet, rowNumber) -> retraining(resultSet), id, feedbackId, termId, storeId,
                studentAccountId, dueAt, actorId);
    }

    @Override
    public Retraining updateRetrainingDueAt(UUID retrainingId, OffsetDateTime dueAt, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update learning_retraining
                        set due_at = ?, version = version + 1, updated_at = current_timestamp
                        where id = ? and status in ('PENDING', 'RETRAIN_REQUIRED') and version = ?
                        returning id, feedback_id, term_id, store_id, student_account_id, status, due_at, version,
                                  created_by_account_id, created_at, updated_at
                        """, (resultSet, rowNumber) -> retraining(resultSet), dueAt, retrainingId, expectedVersion);
    }

    @Override
    public Optional<Retraining> lockRetraining(UUID retrainingId) {
        return jdbcTemplate.query(retrainingSelect() + " where id = ? for update", resultSet -> resultSet.next()
                ? Optional.of(retraining(resultSet)) : Optional.empty(), retrainingId);
    }

    @Override
    public Optional<Retraining> findRetrainingByFeedback(UUID feedbackId) {
        return jdbcTemplate.query(retrainingSelect() + " where feedback_id = ?", resultSet -> resultSet.next()
                ? Optional.of(retraining(resultSet)) : Optional.empty(), feedbackId);
    }

    @Override
    public Retraining transitionRetraining(UUID retrainingId, RetrainingStatus expectedStatus, RetrainingStatus nextStatus,
                                           long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update learning_retraining
                        set status = ?, version = version + 1, updated_at = current_timestamp
                        where id = ? and status = ? and version = ?
                        returning id, feedback_id, term_id, store_id, student_account_id, status, due_at, version,
                                  created_by_account_id, created_at, updated_at
                        """, (resultSet, rowNumber) -> retraining(resultSet), nextStatus.name(), retrainingId,
                expectedStatus.name(), expectedVersion);
    }

    @Override
    public void linkRetrainingEvidence(UUID retrainingId, UUID evidenceId, UUID actorId) {
        jdbcTemplate.update("""
                insert into learning_retraining_evidence_relations (id, retraining_id, evidence_id, linked_by_account_id)
                values (?, ?, ?, ?)
                on conflict (retraining_id, evidence_id) do nothing
                """, UUID.randomUUID(), retrainingId, evidenceId, actorId);
    }

    @Override
    public void appendRetrainingAction(UUID retrainingId, String eventType, UUID actorId, String reason,
                                       RetrainingStatus previousStatus, RetrainingStatus nextStatus,
                                       Long previousVersion, long newVersion) {
        jdbcTemplate.update("""
                insert into learning_retraining_actions
                    (id, retraining_id, event_type, actor_account_id, reason, previous_status, next_status, previous_version, new_version)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), retrainingId, eventType, actorId, reason,
                previousStatus == null ? null : previousStatus.name(), nextStatus.name(), previousVersion, newVersion);
    }

    @Override
    public void appendRetrainingRetest(UUID retrainingId, boolean passed, String result, UUID actorId) {
        jdbcTemplate.update("""
                insert into learning_retraining_retests (id, retraining_id, passed, result, recorded_by_account_id)
                values (?, ?, ?, ?, ?)
                """, UUID.randomUUID(), retrainingId, passed, result, actorId);
    }

    @Override
    public List<Retraining> findRetrainingForStudent(UUID studentAccountId) {
        return jdbcTemplate.query(retrainingSelect() + " where student_account_id = ? order by created_at desc",
                (resultSet, rowNumber) -> retraining(resultSet), studentAccountId);
    }

    @Override
    public List<Retraining> findRetraining(UUID termId, UUID storeId) {
        return jdbcTemplate.query(retrainingSelect() + " where term_id = ? and store_id = ? order by created_at desc",
                (resultSet, rowNumber) -> retraining(resultSet), termId, storeId);
    }

    @Override
    public Certification createCertification(UUID id, UUID termId, UUID storeId, UUID studentAccountId,
                                             UUID templateVersionId, UUID certificationRuleId, String ruleSnapshotJson,
                                             String note, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        insert into learning_certifications
                            (id, term_id, store_id, student_account_id, template_version_id, certification_rule_id,
                             rule_snapshot, note, status, created_by_account_id)
                        values (?, ?, ?, ?, ?, ?, cast(? as jsonb), ?, 'PENDING', ?)
                        returning id, term_id, store_id, student_account_id, template_version_id, certification_rule_id,
                                  rule_snapshot::text, note, status, version, created_by_account_id, created_at, updated_at
                        """, (resultSet, rowNumber) -> certification(resultSet), id, termId, storeId, studentAccountId,
                templateVersionId, certificationRuleId, ruleSnapshotJson, note, actorId);
    }

    @Override
    public Certification updateCertificationNote(UUID certificationId, String note, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update learning_certifications
                        set note = ?, version = version + 1, updated_at = current_timestamp
                        where id = ? and status = 'PENDING' and version = ?
                        returning id, term_id, store_id, student_account_id, template_version_id, certification_rule_id,
                                  rule_snapshot::text, note, status, version, created_by_account_id, created_at, updated_at
                        """, (resultSet, rowNumber) -> certification(resultSet), note, certificationId, expectedVersion);
    }

    @Override
    public Optional<Certification> lockCertification(UUID certificationId) {
        return jdbcTemplate.query(certificationSelect() + " where id = ? for update", resultSet -> resultSet.next()
                ? Optional.of(certification(resultSet)) : Optional.empty(), certificationId);
    }

    @Override
    public Certification decideCertification(UUID certificationId, CertificationStatus nextStatus, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update learning_certifications
                        set status = ?, version = version + 1, updated_at = current_timestamp
                        where id = ? and status = 'PENDING' and version = ?
                        returning id, term_id, store_id, student_account_id, template_version_id, certification_rule_id,
                                  rule_snapshot::text, note, status, version, created_by_account_id, created_at, updated_at
                        """, (resultSet, rowNumber) -> certification(resultSet), nextStatus.name(), certificationId, expectedVersion);
    }

    @Override
    public void linkCertificationEvidence(UUID certificationId, UUID evidenceId, UUID actorId) {
        jdbcTemplate.update("""
                insert into learning_certification_evidence_relations
                    (id, certification_id, evidence_id, linked_by_account_id)
                values (?, ?, ?, ?)
                on conflict (certification_id, evidence_id) do nothing
                """, UUID.randomUUID(), certificationId, evidenceId, actorId);
    }

    @Override
    public void appendCertificationDecision(UUID certificationId, boolean approved, String reason, UUID actorId,
                                            UUID retrainingId, long previousVersion, long newVersion) {
        jdbcTemplate.update("""
                insert into learning_certification_decisions
                    (id, certification_id, approved, reason, decided_by_account_id, retraining_id, previous_version, new_version)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), certificationId, approved, reason, actorId, retrainingId, previousVersion, newVersion);
    }

    @Override
    public void appendCertificationHistory(UUID certificationId, String eventType, UUID actorId, String reason,
                                           CertificationStatus previousStatus, CertificationStatus nextStatus,
                                           Long previousVersion, long newVersion) {
        jdbcTemplate.update("""
                insert into learning_certification_history
                    (id, certification_id, event_type, actor_account_id, reason, previous_status, next_status,
                     previous_version, new_version)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), certificationId, eventType, actorId, reason,
                previousStatus == null ? null : previousStatus.name(), nextStatus.name(), previousVersion, newVersion);
    }

    @Override
    public List<Certification> findCertificationsForStudent(UUID studentAccountId) {
        return jdbcTemplate.query(certificationSelect() + " where student_account_id = ? order by created_at desc",
                (resultSet, rowNumber) -> certification(resultSet), studentAccountId);
    }

    @Override
    public List<Certification> findCertifications(UUID termId, UUID storeId) {
        return jdbcTemplate.query(certificationSelect() + " where term_id = ? and store_id = ? order by created_at desc",
                (resultSet, rowNumber) -> certification(resultSet), termId, storeId);
    }

    @Override
    public void appendAudit(String eventType, String resourceType, UUID resourceId, UUID actorId, String reason,
                            Long previousVersion, Long newVersion) {
        jdbcTemplate.update("""
                insert into audit_events
                    (id, event_type, resource_type, resource_id, actor_account_id, reason, previous_version, new_version, metadata)
                values (?, ?, ?, ?, ?, ?, ?, ?, '{}'::jsonb)
                """, UUID.randomUUID(), eventType, resourceType, resourceId, actorId, reason, previousVersion, newVersion);
    }

    private boolean exists(String sql, Object... parameters) {
        return Boolean.TRUE.equals(jdbcTemplate.query(sql,
                resultSet -> resultSet.next() && resultSet.getBoolean(1), parameters));
    }

    private String feedbackSelect() {
        return """
                select id, term_id, store_id, student_account_id, shift_id, task_completion_id, incident_id, evidence_id,
                       observation, recommendation, requires_retraining, retraining_due_at, status, version,
                       created_by_account_id, created_at, updated_at
                from learning_feedback
                """;
    }

    private String retrainingSelect() {
        return """
                select id, feedback_id, term_id, store_id, student_account_id, status, due_at, version,
                       created_by_account_id, created_at, updated_at
                from learning_retraining
                """;
    }

    private String certificationSelect() {
        return """
                select id, term_id, store_id, student_account_id, template_version_id, certification_rule_id,
                       rule_snapshot::text, note, status, version, created_by_account_id, created_at, updated_at
                from learning_certifications
                """;
    }

    private Feedback feedback(ResultSet resultSet) throws java.sql.SQLException {
        return new Feedback(resultSet.getObject("id", UUID.class), resultSet.getObject("term_id", UUID.class),
                resultSet.getObject("store_id", UUID.class), resultSet.getObject("student_account_id", UUID.class),
                resultSet.getObject("shift_id", UUID.class), resultSet.getObject("task_completion_id", UUID.class),
                resultSet.getObject("incident_id", UUID.class), resultSet.getObject("evidence_id", UUID.class),
                resultSet.getString("observation"), resultSet.getString("recommendation"),
                resultSet.getBoolean("requires_retraining"), resultSet.getObject("retraining_due_at", OffsetDateTime.class),
                resultSet.getString("status"), resultSet.getLong("version"),
                resultSet.getObject("created_by_account_id", UUID.class), resultSet.getObject("created_at", OffsetDateTime.class),
                resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private Retraining retraining(ResultSet resultSet) throws java.sql.SQLException {
        return new Retraining(resultSet.getObject("id", UUID.class), resultSet.getObject("feedback_id", UUID.class),
                resultSet.getObject("term_id", UUID.class), resultSet.getObject("store_id", UUID.class),
                resultSet.getObject("student_account_id", UUID.class),
                RetrainingStatus.valueOf(resultSet.getString("status")), resultSet.getObject("due_at", OffsetDateTime.class),
                resultSet.getLong("version"), resultSet.getObject("created_by_account_id", UUID.class),
                resultSet.getObject("created_at", OffsetDateTime.class), resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private Certification certification(ResultSet resultSet) throws java.sql.SQLException {
        return new Certification(resultSet.getObject("id", UUID.class), resultSet.getObject("term_id", UUID.class),
                resultSet.getObject("store_id", UUID.class), resultSet.getObject("student_account_id", UUID.class),
                resultSet.getObject("template_version_id", UUID.class), resultSet.getObject("certification_rule_id", UUID.class),
                resultSet.getString("rule_snapshot"), resultSet.getString("note"),
                CertificationStatus.valueOf(resultSet.getString("status")), resultSet.getLong("version"),
                resultSet.getObject("created_by_account_id", UUID.class), resultSet.getObject("created_at", OffsetDateTime.class),
                resultSet.getObject("updated_at", OffsetDateTime.class));
    }
}
