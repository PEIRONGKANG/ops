package com.beverageops.operations.infrastructure.persistence;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.List;
import java.util.UUID;

import com.beverageops.operations.domain.model.HandoverStatus;
import com.beverageops.operations.domain.model.IncidentStatus;
import com.beverageops.operations.domain.model.OperatingSummaryStatus;
import com.beverageops.operations.domain.port.OperationalRiskRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class JdbcOperationalRiskRepository implements OperationalRiskRepository {

    private final JdbcTemplate jdbcTemplate;

    JdbcOperationalRiskRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public OperatingSummary createSummary(UUID id, UUID shiftId, String sourceSystem, String collectionMethod,
                                          String sourceReference, OffsetDateTime collectedAt, String summaryDataJson,
                                          boolean pendingSupplement, String note, UUID collectedByAccountId) {
        var status = pendingSupplement ? OperatingSummaryStatus.PENDING_SUPPLEMENT : OperatingSummaryStatus.RECORDED;
        return jdbcTemplate.queryForObject("""
                        insert into ops_operating_summaries
                            (id, shift_id, source_system, collection_method, source_reference, collected_at, summary_data,
                             pending_supplement, status, note, collected_by_account_id)
                        values (?, ?, ?, ?, ?, ?, cast(? as jsonb), ?, ?, ?, ?)
                        returning id, shift_id, source_system, collection_method, source_reference, collected_at, summary_data::text,
                                  pending_supplement, note, collected_by_account_id, status, version, updated_at
                        """, (resultSet, rowNumber) -> summary(resultSet), id, shiftId, sourceSystem, collectionMethod,
                sourceReference, collectedAt, summaryDataJson, pendingSupplement, status.name(), note, collectedByAccountId);
    }

    @Override
    public Optional<OperatingSummary> lockSummary(UUID summaryId) {
        return jdbcTemplate.query(summarySelect() + " where id = ? for update",
                resultSet -> resultSet.next() ? Optional.of(summary(resultSet)) : Optional.empty(), summaryId);
    }

    @Override
    public OperatingSummary updateSummary(UUID summaryId, String summaryDataJson, boolean pendingSupplement, String note,
                                          OperatingSummaryStatus nextStatus, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update ops_operating_summaries
                        set summary_data = cast(? as jsonb), pending_supplement = ?, note = ?, status = ?, version = version + 1,
                            updated_at = current_timestamp
                        where id = ? and version = ?
                        returning id, shift_id, source_system, collection_method, source_reference, collected_at, summary_data::text,
                                  pending_supplement, note, collected_by_account_id, status, version, updated_at
                        """, (resultSet, rowNumber) -> summary(resultSet), summaryDataJson, pendingSupplement, note,
                nextStatus.name(), summaryId, expectedVersion);
    }

    @Override
    public OperatingSummary confirmSummary(UUID summaryId, UUID actorId, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update ops_operating_summaries
                        set status = 'CONFIRMED', confirmed_by_account_id = ?, version = version + 1,
                            updated_at = current_timestamp
                        where id = ? and version = ? and status = 'RECORDED'
                        returning id, shift_id, source_system, collection_method, source_reference, collected_at, summary_data::text,
                                  pending_supplement, note, collected_by_account_id, status, version, updated_at
                        """, (resultSet, rowNumber) -> summary(resultSet), actorId, summaryId, expectedVersion);
    }

    @Override
    public List<OperatingSummary> findSummaries(UUID shiftId) {
        return jdbcTemplate.query(summarySelect() + " where shift_id = ? order by created_at", (resultSet, rowNumber) -> summary(resultSet),
                shiftId);
    }

    @Override
    public Incident createIncident(UUID id, UUID shiftId, String categoryCode, String severity, boolean blocking,
                                   String description, UUID reportedByAccountId) {
        return jdbcTemplate.queryForObject("""
                        insert into ops_incidents
                            (id, shift_id, category_code, severity, blocking, description, status, reported_by_account_id)
                        values (?, ?, ?, ?, ?, ?, 'REPORTED', ?)
                        returning id, shift_id, category_code, severity, blocking, description, status, reported_by_account_id,
                                  assignee_account_id, due_at, control_measure, verification_evidence_reference, version, updated_at
                        """, (resultSet, rowNumber) -> incident(resultSet), id, shiftId, categoryCode, severity, blocking, description,
                reportedByAccountId);
    }

    @Override
    public Optional<Incident> lockIncident(UUID incidentId) {
        return jdbcTemplate.query(incidentSelect() + " where id = ? for update",
                resultSet -> resultSet.next() ? Optional.of(incident(resultSet)) : Optional.empty(), incidentId);
    }

    @Override
    public Incident updateIncident(UUID incidentId, String categoryCode, String severity, boolean blocking, String description,
                                   long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update ops_incidents
                        set category_code = ?, severity = ?, blocking = ?, description = ?, version = version + 1,
                            updated_at = current_timestamp
                        where id = ? and version = ? and status = 'REPORTED'
                        returning id, shift_id, category_code, severity, blocking, description, status, reported_by_account_id,
                                  assignee_account_id, due_at, control_measure, verification_evidence_reference, version, updated_at
                        """, (resultSet, rowNumber) -> incident(resultSet), categoryCode, severity, blocking, description,
                incidentId, expectedVersion);
    }

    @Override
    public Incident transitionIncident(UUID incidentId, IncidentStatus expectedStatus, IncidentStatus nextStatus,
                                       UUID assigneeAccountId, OffsetDateTime dueAt, String controlMeasure,
                                       String verificationEvidenceReference, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update ops_incidents
                        set status = ?, assignee_account_id = coalesce(?, assignee_account_id), due_at = coalesce(?, due_at),
                            control_measure = coalesce(?, control_measure),
                            verification_evidence_reference = coalesce(?, verification_evidence_reference), version = version + 1,
                            updated_at = current_timestamp
                        where id = ? and status = ? and version = ?
                        returning id, shift_id, category_code, severity, blocking, description, status, reported_by_account_id,
                                  assignee_account_id, due_at, control_measure, verification_evidence_reference, version, updated_at
                        """, (resultSet, rowNumber) -> incident(resultSet), nextStatus.name(), assigneeAccountId, dueAt, controlMeasure,
                verificationEvidenceReference, incidentId, expectedStatus.name(), expectedVersion);
    }

    @Override
    public void appendIncidentHistory(UUID incidentId, String eventType, UUID actorId, String reason,
                                      IncidentStatus previousStatus, IncidentStatus nextStatus, long previousVersion,
                                      long newVersion) {
        jdbcTemplate.update("""
                insert into ops_incident_history
                    (id, incident_id, event_type, actor_account_id, reason, previous_status, next_status,
                     previous_version, new_version)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), incidentId, eventType, actorId, reason, previousStatus.name(), nextStatus.name(),
                previousVersion, newVersion);
    }

    @Override
    public void appendIncidentAction(UUID incidentId, String actionType, String content, UUID assigneeAccountId,
                                     OffsetDateTime dueAt, UUID actorId) {
        jdbcTemplate.update("""
                insert into ops_incident_actions
                    (id, incident_id, action_type, content, assignee_account_id, due_at, recorded_by_account_id)
                values (?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), incidentId, actionType, content, assigneeAccountId, dueAt, actorId);
    }

    @Override
    public void linkIncidentEvidence(UUID incidentId, String relationType, String evidenceReference, UUID actorId) {
        jdbcTemplate.update("""
                insert into ops_incident_evidence_relations
                    (id, incident_id, relation_type, evidence_reference, linked_by_account_id)
                values (?, ?, ?, ?, ?)
                """, UUID.randomUUID(), incidentId, relationType, evidenceReference, actorId);
    }

    @Override
    public boolean hasOpenBlockingIncident(UUID shiftId) {
        return exists("""
                select exists (
                    select 1 from ops_incidents
                    where shift_id = ? and blocking and status <> 'CLOSED'
                )
                """, shiftId);
    }

    @Override
    public List<Incident> findIncidents(UUID shiftId) {
        return jdbcTemplate.query(incidentSelect() + " where shift_id = ? order by created_at", (resultSet, rowNumber) -> incident(resultSet),
                shiftId);
    }

    @Override
    public Incident waiveBlocking(UUID incidentId, UUID actorId, String reason, long expectedVersion) {
        var updated = jdbcTemplate.queryForObject("""
                        update ops_incidents
                        set blocking = false, version = version + 1, updated_at = current_timestamp
                        where id = ? and blocking and version = ?
                        returning id, shift_id, category_code, severity, blocking, description, status, reported_by_account_id,
                                  assignee_account_id, due_at, control_measure, verification_evidence_reference, version, updated_at
                        """, (resultSet, rowNumber) -> incident(resultSet), incidentId, expectedVersion);
        jdbcTemplate.update("""
                insert into ops_incident_blocking_waivers
                    (id, incident_id, reason, waived_by_account_id, previous_version, new_version)
                values (?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), incidentId, reason, actorId, expectedVersion, updated.version());
        return updated;
    }

    @Override
    public Handover createHandover(UUID id, UUID shiftId, UUID receivingShiftId, UUID receivingAccountId,
                                   boolean requiredForClose, String contentJson) {
        return jdbcTemplate.queryForObject("""
                        insert into ops_handovers
                            (id, shift_id, receiving_shift_id, receiving_account_id, required_for_close, content, status)
                        values (?, ?, ?, ?, ?, cast(? as jsonb), 'DRAFT')
                        returning id, shift_id, receiving_shift_id, receiving_account_id, required_for_close, content::text,
                                  status, version, updated_at
                        """, (resultSet, rowNumber) -> handover(resultSet), id, shiftId, receivingShiftId, receivingAccountId,
                requiredForClose, contentJson);
    }

    @Override
    public Optional<Handover> lockHandover(UUID handoverId) {
        return jdbcTemplate.query(handoverSelect() + " where id = ? for update",
                resultSet -> resultSet.next() ? Optional.of(handover(resultSet)) : Optional.empty(), handoverId);
    }

    @Override
    public Optional<UUID> handoverInitiator(UUID handoverId) {
        return jdbcTemplate.query("""
                        select actor_account_id
                        from ops_handover_history
                        where handover_id = ? and event_type = 'HANDOVER_CREATED'
                        order by occurred_at
                        limit 1
                        """, resultSet -> resultSet.next()
                ? Optional.of(resultSet.getObject("actor_account_id", UUID.class)) : Optional.empty(), handoverId);
    }

    @Override
    public Handover transitionHandover(UUID handoverId, HandoverStatus expectedStatus, HandoverStatus nextStatus,
                                       UUID actorId, long expectedVersion) {
        String actorColumn = switch (nextStatus) {
            case SUBMITTED -> "submitted_by_account_id";
            case ACCEPTED -> "accepted_by_account_id";
            case APPROVED -> "approved_by_account_id";
            default -> null;
        };
        var sql = """
                update ops_handovers set status = ?, version = version + 1, updated_at = current_timestamp
                """ + (actorColumn == null ? "" : ", " + actorColumn + " = ?") + """

                where id = ? and status = ? and version = ?
                returning id, shift_id, receiving_shift_id, receiving_account_id, required_for_close, content::text,
                          status, version, updated_at
                """;
        Object[] parameters = actorColumn == null
                ? new Object[]{nextStatus.name(), handoverId, expectedStatus.name(), expectedVersion}
                : new Object[]{nextStatus.name(), actorId, handoverId, expectedStatus.name(), expectedVersion};
        return jdbcTemplate.queryForObject(sql, (resultSet, rowNumber) -> handover(resultSet), parameters);
    }

    @Override
    public void appendHandoverHistory(UUID handoverId, String eventType, UUID actorId, String reason,
                                      HandoverStatus previousStatus, HandoverStatus nextStatus, long previousVersion,
                                      long newVersion) {
        jdbcTemplate.update("""
                insert into ops_handover_history
                    (id, handover_id, event_type, actor_account_id, reason, previous_status, next_status,
                     previous_version, new_version)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), handoverId, eventType, actorId, reason, previousStatus.name(), nextStatus.name(),
                previousVersion, newVersion);
    }

    @Override
    public void appendHandoverVersion(UUID handoverId, String contentJson, HandoverStatus status, long resourceVersion,
                                      String eventType, UUID actorId) {
        jdbcTemplate.update("""
                insert into ops_handover_versions
                    (id, handover_id, content, status, resource_version, event_type, recorded_by_account_id)
                values (?, ?, cast(? as jsonb), ?, ?, ?, ?)
                """, UUID.randomUUID(), handoverId, contentJson, status.name(), resourceVersion, eventType, actorId);
    }

    @Override
    public boolean hasUnacceptedRequiredHandover(UUID shiftId) {
        return exists("""
                select exists (
                    select 1 from ops_handovers
                    where shift_id = ? and required_for_close and status not in ('ACCEPTED', 'APPROVED')
                )
                """, shiftId);
    }

    @Override
    public List<Handover> findHandovers(UUID shiftId) {
        return jdbcTemplate.query(handoverSelect() + " where shift_id = ? order by created_at", (resultSet, rowNumber) -> handover(resultSet),
                shiftId);
    }

    @Override
    public Handover updateHandover(UUID handoverId, String contentJson, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update ops_handovers
                        set content = cast(? as jsonb), version = version + 1, updated_at = current_timestamp
                        where id = ? and version = ? and status in ('DRAFT', 'RETURNED')
                        returning id, shift_id, receiving_shift_id, receiving_account_id, required_for_close, content::text,
                                  status, version, updated_at
                        """, (resultSet, rowNumber) -> handover(resultSet), contentJson, handoverId, expectedVersion);
    }

    private boolean exists(String sql, UUID id) {
        return Boolean.TRUE.equals(jdbcTemplate.query(sql, resultSet -> resultSet.next() && resultSet.getBoolean(1), id));
    }

    private String summarySelect() {
        return """
                select id, shift_id, source_system, collection_method, source_reference, collected_at, summary_data::text,
                       pending_supplement, note, collected_by_account_id, status, version, updated_at
                from ops_operating_summaries
                """;
    }

    private String incidentSelect() {
        return """
                select id, shift_id, category_code, severity, blocking, description, status, reported_by_account_id,
                       assignee_account_id, due_at, control_measure, verification_evidence_reference, version, updated_at
                from ops_incidents
                """;
    }

    private String handoverSelect() {
        return """
                select id, shift_id, receiving_shift_id, receiving_account_id, required_for_close, content::text, status, version, updated_at
                from ops_handovers
                """;
    }

    private OperatingSummary summary(ResultSet resultSet) throws java.sql.SQLException {
        return new OperatingSummary(resultSet.getObject("id", UUID.class), resultSet.getObject("shift_id", UUID.class),
                resultSet.getString("source_system"), resultSet.getString("collection_method"),
                resultSet.getString("source_reference"), resultSet.getObject("collected_at", OffsetDateTime.class),
                resultSet.getString("summary_data"), resultSet.getBoolean("pending_supplement"), resultSet.getString("note"),
                resultSet.getObject("collected_by_account_id", UUID.class),
                OperatingSummaryStatus.valueOf(resultSet.getString("status")), resultSet.getLong("version"),
                resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private Incident incident(ResultSet resultSet) throws java.sql.SQLException {
        return new Incident(resultSet.getObject("id", UUID.class), resultSet.getObject("shift_id", UUID.class),
                resultSet.getString("category_code"), resultSet.getString("severity"), resultSet.getBoolean("blocking"),
                resultSet.getString("description"), IncidentStatus.valueOf(resultSet.getString("status")),
                resultSet.getObject("reported_by_account_id", UUID.class), resultSet.getObject("assignee_account_id", UUID.class),
                resultSet.getObject("due_at", OffsetDateTime.class), resultSet.getString("control_measure"),
                resultSet.getString("verification_evidence_reference"),
                resultSet.getLong("version"), resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private Handover handover(ResultSet resultSet) throws java.sql.SQLException {
        return new Handover(resultSet.getObject("id", UUID.class), resultSet.getObject("shift_id", UUID.class),
                resultSet.getObject("receiving_shift_id", UUID.class), resultSet.getObject("receiving_account_id", UUID.class),
                resultSet.getBoolean("required_for_close"), resultSet.getString("content"),
                HandoverStatus.valueOf(resultSet.getString("status")),
                resultSet.getLong("version"), resultSet.getObject("updated_at", OffsetDateTime.class));
    }
}
