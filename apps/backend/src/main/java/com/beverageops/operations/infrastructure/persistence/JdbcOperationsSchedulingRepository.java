package com.beverageops.operations.infrastructure.persistence;

import java.sql.ResultSet;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.operations.domain.model.AssignmentStatus;
import com.beverageops.operations.domain.model.ShiftStatus;
import com.beverageops.operations.domain.port.OperationsSchedulingRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class JdbcOperationsSchedulingRepository implements OperationsSchedulingRepository {

    private final JdbcTemplate jdbcTemplate;

    JdbcOperationsSchedulingRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Optional<PublishedTemplate> findPublishedTemplate(UUID templateVersionId) {
        return jdbcTemplate.query("""
                        select id, term_id, store_id, template_revision, configuration::text, effective_from, effective_until
                        from gov_template_versions
                        where id = ? and status = 'PUBLISHED'
                        """, resultSet -> resultSet.next() ? Optional.of(publishedTemplate(resultSet)) : Optional.empty(),
                templateVersionId);
    }

    @Override
    public boolean hasScope(UUID accountId, String roleCode, UUID termId, UUID storeId) {
        return Boolean.TRUE.equals(jdbcTemplate.query("""
                        select exists (
                            select 1 from ops_scope_grants
                            where account_id = ? and role_code = ? and term_id = ? and store_id = ? and revoked_at is null
                              and effective_from <= current_timestamp
                              and (effective_until is null or effective_until > current_timestamp)
                        )
                        """, resultSet -> resultSet.next() && resultSet.getBoolean(1), accountId, roleCode, termId, storeId));
    }

    @Override
    public ScopeGrant createScopeGrant(UUID id, UUID termId, UUID storeId, UUID accountId, String roleCode, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        insert into ops_scope_grants (id, term_id, store_id, account_id, role_code, granted_by_account_id)
                        values (?, ?, ?, ?, ?, ?)
                        returning id, term_id, store_id, account_id, role_code, created_at
                        """, (resultSet, rowNumber) -> scopeGrant(resultSet), id, termId, storeId, accountId, roleCode, actorId);
    }

    @Override
    public OperatingDay createOperatingDay(UUID id, UUID termId, UUID storeId, LocalDate operatingDate,
                                           UUID templateVersionId, int templateRevision, String templateSnapshotJson,
                                           UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        insert into ops_operating_days
                            (id, term_id, store_id, operating_date, template_version_id, template_revision, template_snapshot,
                             status, created_by_account_id)
                        values (?, ?, ?, ?, ?, ?, cast(? as jsonb), 'DRAFT', ?)
                        returning id, term_id, store_id, operating_date, template_version_id, template_revision,
                                  template_snapshot::text, status, version, updated_at
                        """, (resultSet, rowNumber) -> operatingDay(resultSet), id, termId, storeId, operatingDate,
                templateVersionId, templateRevision, templateSnapshotJson, actorId);
    }

    @Override
    public Optional<OperatingDay> findOperatingDay(UUID operatingDayId) {
        return jdbcTemplate.query("""
                        select id, term_id, store_id, operating_date, template_version_id, template_revision,
                               template_snapshot::text, status, version, updated_at
                        from ops_operating_days where id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(operatingDay(resultSet)) : Optional.empty(), operatingDayId);
    }

    @Override
    public Optional<OperatingDay> lockOperatingDay(UUID operatingDayId) {
        return jdbcTemplate.query("""
                        select id, term_id, store_id, operating_date, template_version_id, template_revision,
                               template_snapshot::text, status, version, updated_at
                        from ops_operating_days where id = ? for update
                        """, resultSet -> resultSet.next() ? Optional.of(operatingDay(resultSet)) : Optional.empty(), operatingDayId);
    }

    @Override
    public OperatingDay updateOperatingDay(UUID operatingDayId, LocalDate operatingDate, UUID templateVersionId,
                                           int templateRevision, String templateSnapshotJson, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update ops_operating_days
                        set operating_date = ?, template_version_id = ?, template_revision = ?,
                            template_snapshot = cast(? as jsonb), version = version + 1, updated_at = current_timestamp
                        where id = ? and version = ?
                        returning id, term_id, store_id, operating_date, template_version_id, template_revision,
                                  template_snapshot::text, status, version, updated_at
                        """, (resultSet, rowNumber) -> operatingDay(resultSet), operatingDate, templateVersionId,
                templateRevision, templateSnapshotJson, operatingDayId, expectedVersion);
    }

    @Override
    public List<OperatingDay> findOperatingDays(UUID termId, UUID storeId, LocalDate operatingDate) {
        return jdbcTemplate.query("""
                        select id, term_id, store_id, operating_date, template_version_id, template_revision,
                               template_snapshot::text, status, version, updated_at
                        from ops_operating_days
                        where (cast(? as uuid) is null or term_id = cast(? as uuid))
                          and (cast(? as uuid) is null or store_id = cast(? as uuid))
                          and (cast(? as date) is null or operating_date = cast(? as date))
                        order by operating_date desc
                        """, (resultSet, rowNumber) -> operatingDay(resultSet), termId, termId, storeId, storeId,
                operatingDate, operatingDate);
    }

    @Override
    public Shift createShift(UUID id, UUID operatingDayId, String code, String name, OffsetDateTime startsAt,
                             OffsetDateTime endsAt, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        insert into ops_shifts
                            (id, operating_day_id, code, name, starts_at, ends_at, status, created_by_account_id)
                        values (?, ?, ?, ?, ?, ?, 'DRAFT', ?)
                        returning id, operating_day_id, code, name, starts_at, ends_at, status, cancellation_reason, version, updated_at
                        """, (resultSet, rowNumber) -> bareShift(resultSet, operatingDayId), id, operatingDayId, code, name,
                startsAt, endsAt, actorId);
    }

    @Override
    public boolean hasShiftConflict(UUID operatingDayId, OffsetDateTime startsAt, OffsetDateTime endsAt) {
        return Boolean.TRUE.equals(jdbcTemplate.query("""
                        select exists (
                            select 1 from ops_shifts
                            where operating_day_id = ? and status <> 'CANCELLED'
                              and starts_at < ? and ends_at > ?
                        )
                        """, resultSet -> resultSet.next() && resultSet.getBoolean(1), operatingDayId, endsAt, startsAt));
    }

    @Override
    public boolean hasShifts(UUID operatingDayId) {
        return Boolean.TRUE.equals(jdbcTemplate.query("""
                        select exists (select 1 from ops_shifts where operating_day_id = ?)
                        """, resultSet -> resultSet.next() && resultSet.getBoolean(1), operatingDayId));
    }

    @Override
    public Optional<Shift> findShift(UUID shiftId) {
        return jdbcTemplate.query(shiftSelect() + " where s.id = ?",
                resultSet -> resultSet.next() ? Optional.of(shift(resultSet)) : Optional.empty(), shiftId);
    }

    @Override
    public Optional<Shift> lockShift(UUID shiftId) {
        return jdbcTemplate.query(shiftSelect() + " where s.id = ? for update of s",
                resultSet -> resultSet.next() ? Optional.of(shift(resultSet)) : Optional.empty(), shiftId);
    }

    @Override
    public List<Shift> findShifts(UUID operatingDayId) {
        return jdbcTemplate.query(shiftSelect() + " where s.operating_day_id = ? order by s.starts_at",
                (resultSet, rowNumber) -> shift(resultSet), operatingDayId);
    }

    @Override
    public Shift transitionShift(UUID shiftId, ShiftStatus expectedStatus, ShiftStatus nextStatus, long expectedVersion,
                                 UUID actorId, String cancellationReason) {
        String actorColumn = switch (nextStatus) {
            case SCHEDULED -> "scheduled_by_account_id";
            case IN_PROGRESS -> "started_by_account_id";
            case CLOSED -> "closed_by_account_id";
            default -> null;
        };
        var update = """
                update ops_shifts
                set status = ?, cancellation_reason = ?, version = version + 1, updated_at = current_timestamp
                """ + (actorColumn == null ? "" : ", " + actorColumn + " = ?") + """

                where id = ? and status = ? and version = ?
                returning id, operating_day_id, code, name, starts_at, ends_at, status, cancellation_reason, version, updated_at
                """;
        Object[] parameters = actorColumn == null
                ? new Object[]{nextStatus.name(), cancellationReason, shiftId, expectedStatus.name(), expectedVersion}
                : new Object[]{nextStatus.name(), cancellationReason, actorId, shiftId, expectedStatus.name(), expectedVersion};
        return jdbcTemplate.queryForObject(update, (resultSet, rowNumber) -> bareShift(resultSet, null), parameters);
    }

    @Override
    public Assignment createAssignment(UUID id, UUID shiftId, UUID accountId, String roleCode, String reason, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        insert into ops_shift_assignments
                            (id, shift_id, account_id, role_code, status, assignment_reason, assigned_by_account_id)
                        values (?, ?, ?, ?, 'ASSIGNED', ?, ?)
                        returning id, shift_id, account_id, role_code, status, version, updated_at
                """, (resultSet, rowNumber) -> assignment(resultSet), id, shiftId, accountId, roleCode, reason, actorId);
    }

    @Override
    public Optional<Assignment> lockAssignment(UUID assignmentId) {
        return jdbcTemplate.query("""
                        select id, shift_id, account_id, role_code, status, version, updated_at
                        from ops_shift_assignments where id = ? for update
                        """, resultSet -> resultSet.next() ? Optional.of(assignment(resultSet)) : Optional.empty(), assignmentId);
    }

    @Override
    public boolean hasActiveAssignment(UUID shiftId, UUID accountId, String roleCode, UUID excludedAssignmentId) {
        return Boolean.TRUE.equals(jdbcTemplate.query("""
                        select exists (
                            select 1 from ops_shift_assignments
                            where shift_id = ? and account_id = ? and role_code = ? and status = 'ASSIGNED'
                              and id <> ?
                        )
                        """, resultSet -> resultSet.next() && resultSet.getBoolean(1), shiftId, accountId, roleCode,
                excludedAssignmentId));
    }

    @Override
    public Assignment updateAssignment(UUID assignmentId, String roleCode, AssignmentStatus status, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update ops_shift_assignments
                        set role_code = ?, status = ?, version = version + 1, updated_at = current_timestamp
                        where id = ? and version = ?
                        returning id, shift_id, account_id, role_code, status, version, updated_at
                        """, (resultSet, rowNumber) -> assignment(resultSet), roleCode, status.name(), assignmentId,
                expectedVersion);
    }

    @Override
    public List<Assignment> findAssignments(UUID shiftId) {
        return jdbcTemplate.query("""
                        select id, shift_id, account_id, role_code, status, version, updated_at
                        from ops_shift_assignments where shift_id = ? order by created_at
                        """, (resultSet, rowNumber) -> assignment(resultSet), shiftId);
    }

    @Override
    public boolean hasAssignments(UUID shiftId) {
        return Boolean.TRUE.equals(jdbcTemplate.query("""
                        select exists (select 1 from ops_shift_assignments where shift_id = ? and status = 'ASSIGNED')
                        """, resultSet -> resultSet.next() && resultSet.getBoolean(1), shiftId));
    }

    @Override
    public boolean hasAssignmentConflict(UUID accountId, OffsetDateTime startsAt, OffsetDateTime endsAt) {
        return Boolean.TRUE.equals(jdbcTemplate.query("""
                        select exists (
                            select 1 from ops_shift_assignments a
                            join ops_shifts s on s.id = a.shift_id
                            where a.account_id = ? and a.status = 'ASSIGNED' and s.status <> 'CANCELLED'
                              and s.starts_at < ? and s.ends_at > ?
                        )
                        """, resultSet -> resultSet.next() && resultSet.getBoolean(1), accountId, endsAt, startsAt));
    }

    @Override
    public boolean isAssignedToShift(UUID accountId, UUID shiftId) {
        return Boolean.TRUE.equals(jdbcTemplate.query("""
                        select exists (
                            select 1 from ops_shift_assignments
                            where account_id = ? and shift_id = ? and status = 'ASSIGNED'
                        )
                        """, resultSet -> resultSet.next() && resultSet.getBoolean(1), accountId, shiftId));
    }

    @Override
    public List<PersonalShift> findPersonalShifts(UUID accountId) {
        return jdbcTemplate.query("""
                        select s.id shift_id, d.id operating_day_id, d.term_id, d.store_id, d.operating_date,
                               s.code shift_code, s.name shift_name, s.starts_at, s.ends_at, s.status shift_status,
                               a.role_code, a.status assignment_status, s.version shift_version
                        from ops_shift_assignments a
                        join ops_shifts s on s.id = a.shift_id
                        join ops_operating_days d on d.id = s.operating_day_id
                        where a.account_id = ? and a.status = 'ASSIGNED' and s.status <> 'CANCELLED'
                        order by s.starts_at
                        """, (resultSet, rowNumber) -> personalShift(resultSet), accountId);
    }

    @Override
    public List<Shift> findScopedShifts(UUID accountId, LocalDate operatingDate) {
        return jdbcTemplate.query(shiftSelect() + """
                join ops_scope_grants g on g.term_id = d.term_id and g.store_id = d.store_id
                where g.account_id = ? and g.role_code = 'P2' and g.revoked_at is null
                  and g.effective_from <= current_timestamp
                  and (g.effective_until is null or g.effective_until > current_timestamp)
                  and d.operating_date = ? and s.status <> 'CANCELLED'
                order by s.starts_at, s.id
                """, (resultSet, rowNumber) -> shift(resultSet), accountId, operatingDate);
    }

    @Override
    public List<Shift> findAllShifts(LocalDate operatingDate) {
        return jdbcTemplate.query(shiftSelect() + " where s.operating_date = ? and s.status <> 'CANCELLED' order by s.starts_at, s.id",
                (resultSet, rowNumber) -> shift(resultSet), operatingDate);
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

    @Override
    public void appendAssignmentHistory(UUID assignmentId, String eventType, UUID actorId, String reason,
                                        Long previousVersion, Long newVersion) {
        jdbcTemplate.update("""
                insert into ops_assignment_change_history
                    (id, assignment_id, event_type, actor_account_id, reason, previous_version, new_version)
                values (?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), assignmentId, eventType, actorId, reason, previousVersion, newVersion);
    }

    @Override
    public void appendShiftStateHistory(UUID shiftId, ShiftStatus fromStatus, ShiftStatus toStatus, UUID actorId,
                                        String reason, long previousVersion, long newVersion) {
        jdbcTemplate.update("""
                insert into ops_shift_state_history
                    (id, shift_id, from_status, to_status, actor_account_id, reason, previous_version, new_version)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), shiftId, fromStatus == null ? null : fromStatus.name(), toStatus.name(), actorId,
                reason, previousVersion, newVersion);
    }

    private String shiftSelect() {
        return """
                select s.id, s.operating_day_id, d.term_id, d.store_id, d.operating_date, s.code, s.name,
                       s.starts_at, s.ends_at, s.status, s.cancellation_reason, s.version, s.updated_at
                from ops_shifts s join ops_operating_days d on d.id = s.operating_day_id
                """;
    }

    private PublishedTemplate publishedTemplate(ResultSet resultSet) throws java.sql.SQLException {
        return new PublishedTemplate(resultSet.getObject("id", UUID.class), resultSet.getObject("term_id", UUID.class),
                resultSet.getObject("store_id", UUID.class), resultSet.getInt("template_revision"),
                resultSet.getString("configuration"), resultSet.getObject("effective_from", LocalDate.class),
                resultSet.getObject("effective_until", LocalDate.class));
    }

    private ScopeGrant scopeGrant(ResultSet resultSet) throws java.sql.SQLException {
        return new ScopeGrant(resultSet.getObject("id", UUID.class), resultSet.getObject("term_id", UUID.class),
                resultSet.getObject("store_id", UUID.class), resultSet.getObject("account_id", UUID.class),
                resultSet.getString("role_code"), resultSet.getObject("created_at", OffsetDateTime.class));
    }

    private OperatingDay operatingDay(ResultSet resultSet) throws java.sql.SQLException {
        return new OperatingDay(resultSet.getObject("id", UUID.class), resultSet.getObject("term_id", UUID.class),
                resultSet.getObject("store_id", UUID.class), resultSet.getObject("operating_date", LocalDate.class),
                resultSet.getObject("template_version_id", UUID.class), resultSet.getInt("template_revision"),
                resultSet.getString("template_snapshot"), ShiftStatus.valueOf(resultSet.getString("status")),
                resultSet.getLong("version"), resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private Shift bareShift(ResultSet resultSet, UUID knownOperatingDayId) throws java.sql.SQLException {
        return new Shift(resultSet.getObject("id", UUID.class), knownOperatingDayId == null
                ? resultSet.getObject("operating_day_id", UUID.class) : knownOperatingDayId, null, null, null,
                resultSet.getString("code"), resultSet.getString("name"), resultSet.getObject("starts_at", OffsetDateTime.class),
                resultSet.getObject("ends_at", OffsetDateTime.class), ShiftStatus.valueOf(resultSet.getString("status")),
                resultSet.getString("cancellation_reason"), resultSet.getLong("version"),
                resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private Shift shift(ResultSet resultSet) throws java.sql.SQLException {
        return new Shift(resultSet.getObject("id", UUID.class), resultSet.getObject("operating_day_id", UUID.class),
                resultSet.getObject("term_id", UUID.class), resultSet.getObject("store_id", UUID.class),
                resultSet.getObject("operating_date", LocalDate.class), resultSet.getString("code"),
                resultSet.getString("name"), resultSet.getObject("starts_at", OffsetDateTime.class),
                resultSet.getObject("ends_at", OffsetDateTime.class), ShiftStatus.valueOf(resultSet.getString("status")),
                resultSet.getString("cancellation_reason"), resultSet.getLong("version"),
                resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private Assignment assignment(ResultSet resultSet) throws java.sql.SQLException {
        return new Assignment(resultSet.getObject("id", UUID.class), resultSet.getObject("shift_id", UUID.class),
                resultSet.getObject("account_id", UUID.class), resultSet.getString("role_code"),
                AssignmentStatus.valueOf(resultSet.getString("status")), resultSet.getLong("version"),
                resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private PersonalShift personalShift(ResultSet resultSet) throws java.sql.SQLException {
        return new PersonalShift(resultSet.getObject("shift_id", UUID.class), resultSet.getObject("operating_day_id", UUID.class),
                resultSet.getObject("term_id", UUID.class), resultSet.getObject("store_id", UUID.class),
                resultSet.getObject("operating_date", LocalDate.class), resultSet.getString("shift_code"),
                resultSet.getString("shift_name"), resultSet.getObject("starts_at", OffsetDateTime.class),
                resultSet.getObject("ends_at", OffsetDateTime.class), ShiftStatus.valueOf(resultSet.getString("shift_status")),
                resultSet.getString("role_code"), AssignmentStatus.valueOf(resultSet.getString("assignment_status")),
                resultSet.getLong("shift_version"));
    }
}
