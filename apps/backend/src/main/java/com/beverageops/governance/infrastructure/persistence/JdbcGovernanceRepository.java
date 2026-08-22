package com.beverageops.governance.infrastructure.persistence;

import java.sql.ResultSet;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.governance.domain.model.TemplateStatus;
import com.beverageops.governance.domain.port.GovernanceRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class JdbcGovernanceRepository implements GovernanceRepository {

    private final JdbcTemplate jdbcTemplate;

    JdbcGovernanceRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Term createTerm(UUID id, String code, String name, LocalDate startDate, LocalDate endDate, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        insert into gov_terms (id, code, name, start_date, end_date, status, created_by_account_id)
                        values (?, ?, ?, ?, ?, 'DRAFT', ?)
                        returning id, code, name, start_date, end_date, status, version, updated_at
                        """, (resultSet, rowNumber) -> term(resultSet), id, code, name, startDate, endDate, actorId);
    }

    @Override
    public Optional<Term> findTerm(UUID termId) {
        return jdbcTemplate.query("""
                        select id, code, name, start_date, end_date, status, version, updated_at
                        from gov_terms where id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(term(resultSet)) : Optional.empty(), termId);
    }

    @Override
    public List<Term> findTerms() {
        return jdbcTemplate.query("""
                        select id, code, name, start_date, end_date, status, version, updated_at
                        from gov_terms order by start_date desc, code
                        """, (resultSet, rowNumber) -> term(resultSet));
    }

    @Override
    public Term updateTerm(UUID termId, String name, LocalDate startDate, LocalDate endDate, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update gov_terms set name = ?, start_date = ?, end_date = ?, version = version + 1,
                            updated_at = current_timestamp
                        where id = ? and status = 'DRAFT' and version = ?
                        returning id, code, name, start_date, end_date, status, version, updated_at
                        """, (resultSet, rowNumber) -> term(resultSet), name, startDate, endDate, termId, expectedVersion);
    }

    @Override
    public Term publishTerm(UUID termId, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update gov_terms set status = 'PUBLISHED', version = version + 1, updated_at = current_timestamp
                        where id = ? and status = 'DRAFT' and version = ?
                        returning id, code, name, start_date, end_date, status, version, updated_at
                        """, (resultSet, rowNumber) -> term(resultSet), termId, expectedVersion);
    }

    @Override
    public Term archiveTerm(UUID termId, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update gov_terms set status = 'ARCHIVED', version = version + 1, updated_at = current_timestamp
                        where id = ? and status in ('DRAFT', 'PUBLISHED') and version = ?
                        returning id, code, name, start_date, end_date, status, version, updated_at
                        """, (resultSet, rowNumber) -> term(resultSet), termId, expectedVersion);
    }

    @Override
    public Store createStore(UUID id, String code, String name, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        insert into gov_stores (id, code, name, status, created_by_account_id)
                        values (?, ?, ?, 'ACTIVE', ?)
                        returning id, code, name, status, version, updated_at
                        """, (resultSet, rowNumber) -> store(resultSet), id, code, name, actorId);
    }

    @Override
    public Optional<Store> findStore(UUID storeId) {
        return jdbcTemplate.query("""
                        select id, code, name, status, version, updated_at from gov_stores where id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(store(resultSet)) : Optional.empty(), storeId);
    }

    @Override
    public List<Store> findStores() {
        return jdbcTemplate.query("""
                        select id, code, name, status, version, updated_at from gov_stores order by code
                        """, (resultSet, rowNumber) -> store(resultSet));
    }

    @Override
    public Store updateStore(UUID storeId, String name, String status, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update gov_stores set name = ?, status = ?, version = version + 1, updated_at = current_timestamp
                        where id = ? and version = ?
                        returning id, code, name, status, version, updated_at
                        """, (resultSet, rowNumber) -> store(resultSet), name, status, storeId, expectedVersion);
    }

    @Override
    public Team createTeam(UUID id, UUID termId, String code, String name, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        insert into gov_teams (id, term_id, code, name, status, created_by_account_id)
                        values (?, ?, ?, ?, 'ACTIVE', ?)
                        returning id, term_id, code, name, status, version, updated_at
                        """, (resultSet, rowNumber) -> team(resultSet), id, termId, code, name, actorId);
    }

    @Override
    public Optional<Team> findTeam(UUID teamId) {
        return jdbcTemplate.query("""
                        select id, term_id, code, name, status, version, updated_at from gov_teams where id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(team(resultSet)) : Optional.empty(), teamId);
    }

    @Override
    public List<Team> findTeams(UUID termId) {
        return jdbcTemplate.query("""
                        select id, term_id, code, name, status, version, updated_at
                        from gov_teams where term_id = ? order by code
                        """, (resultSet, rowNumber) -> team(resultSet), termId);
    }

    @Override
    public Team updateTeam(UUID teamId, String name, String status, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update gov_teams set name = ?, status = ?, version = version + 1, updated_at = current_timestamp
                        where id = ? and version = ?
                        returning id, term_id, code, name, status, version, updated_at
                        """, (resultSet, rowNumber) -> team(resultSet), name, status, teamId, expectedVersion);
    }

    @Override
    public TeachingWeek createTeachingWeek(UUID id, UUID termId, int weekNumber, String name, LocalDate startDate,
                                           LocalDate endDate, String phaseCode, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        insert into gov_teaching_weeks
                            (id, term_id, week_number, name, start_date, end_date, phase_code, created_by_account_id)
                        values (?, ?, ?, ?, ?, ?, ?, ?)
                        returning id, term_id, week_number, name, start_date, end_date, phase_code, version, updated_at
                        """, (resultSet, rowNumber) -> teachingWeek(resultSet), id, termId, weekNumber, name,
                startDate, endDate, phaseCode, actorId);
    }

    @Override
    public List<TeachingWeek> findTeachingWeeks(UUID termId) {
        return jdbcTemplate.query("""
                        select id, term_id, week_number, name, start_date, end_date, phase_code, version, updated_at
                        from gov_teaching_weeks where term_id = ? order by week_number
                        """, (resultSet, rowNumber) -> teachingWeek(resultSet), termId);
    }

    @Override
    public Optional<TeachingWeek> findTeachingWeek(UUID teachingWeekId) {
        return jdbcTemplate.query("""
                        select id, term_id, week_number, name, start_date, end_date, phase_code, version, updated_at
                        from gov_teaching_weeks where id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(teachingWeek(resultSet)) : Optional.empty(), teachingWeekId);
    }

    @Override
    public TeachingWeek updateTeachingWeek(UUID teachingWeekId, String name, LocalDate startDate, LocalDate endDate,
                                           String phaseCode, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update gov_teaching_weeks
                        set name = ?, start_date = ?, end_date = ?, phase_code = ?, version = version + 1,
                            updated_at = current_timestamp
                        where id = ? and version = ?
                        returning id, term_id, week_number, name, start_date, end_date, phase_code, version, updated_at
                        """, (resultSet, rowNumber) -> teachingWeek(resultSet), name, startDate, endDate, phaseCode,
                teachingWeekId, expectedVersion);
    }

    @Override
    public Membership createMembership(UUID id, UUID termId, UUID accountId, UUID teamId, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        insert into gov_term_memberships (id, term_id, account_id, team_id, status, created_by_account_id)
                        values (?, ?, ?, ?, 'ACTIVE', ?)
                        returning id, term_id, account_id, team_id, status, version, updated_at
                        """, (resultSet, rowNumber) -> membership(resultSet), id, termId, accountId, teamId, actorId);
    }

    @Override
    public List<Membership> findMemberships(UUID termId) {
        return jdbcTemplate.query("""
                        select id, term_id, account_id, team_id, status, version, updated_at
                        from gov_term_memberships where term_id = ? order by created_at
                        """, (resultSet, rowNumber) -> membership(resultSet), termId);
    }

    @Override
    public boolean hasActiveTeamMembership(UUID termId) {
        Boolean found = jdbcTemplate.queryForObject("""
                        select exists (
                            select 1
                            from gov_term_memberships membership
                            join gov_teams team on team.id = membership.team_id
                            where membership.term_id = ? and membership.status = 'ACTIVE' and team.status = 'ACTIVE'
                        )
                        """, Boolean.class, termId);
        return Boolean.TRUE.equals(found);
    }

    @Override
    public Optional<Membership> findMembership(UUID membershipId) {
        return jdbcTemplate.query("""
                        select id, term_id, account_id, team_id, status, version, updated_at
                        from gov_term_memberships where id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(membership(resultSet)) : Optional.empty(), membershipId);
    }

    @Override
    public Membership deactivateMembership(UUID membershipId, long expectedVersion, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        update gov_term_memberships set status = 'INACTIVE', effective_until = current_timestamp,
                            deactivated_by_account_id = ?, deactivated_at = current_timestamp, version = version + 1,
                            updated_at = current_timestamp
                        where id = ? and status = 'ACTIVE' and version = ?
                        returning id, term_id, account_id, team_id, status, version, updated_at
                        """, (resultSet, rowNumber) -> membership(resultSet), actorId, membershipId, expectedVersion);
    }

    @Override
    public TemplateVersion createTemplateVersion(UUID id, UUID termId, UUID storeId, String templateCode,
                                                 int templateRevision, String name, LocalDate effectiveFrom,
                                                 String configurationJson, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        insert into gov_template_versions
                            (id, term_id, store_id, template_code, template_revision, name, status, effective_from,
                             configuration, created_by_account_id)
                        values (?, ?, ?, ?, ?, ?, 'DRAFT', ?, cast(? as jsonb), ?)
                        returning id, term_id, store_id, template_code, template_revision, name, status,
                                  effective_from, effective_until, configuration::text, version, updated_at
                        """, (resultSet, rowNumber) -> template(resultSet), id, termId, storeId, templateCode,
                templateRevision, name, effectiveFrom, configurationJson, actorId);
    }

    @Override
    public int nextTemplateRevision(UUID termId, UUID storeId, String templateCode) {
        return jdbcTemplate.queryForObject("""
                        insert into gov_template_revision_sequences (term_id, store_id, template_code, last_revision)
                        values (?, ?, ?, 1)
                        on conflict (term_id, store_id, template_code)
                        do update set last_revision = gov_template_revision_sequences.last_revision + 1
                        returning last_revision
                        """, Integer.class, termId, storeId, templateCode);
    }

    @Override
    public Optional<TemplateVersion> findTemplateVersion(UUID templateVersionId) {
        return jdbcTemplate.query("""
                        select id, term_id, store_id, template_code, template_revision, name, status,
                               effective_from, effective_until, configuration::text, version, updated_at
                        from gov_template_versions where id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(template(resultSet)) : Optional.empty(), templateVersionId);
    }

    @Override
    public List<TemplateVersion> findTemplateVersions(UUID termId, UUID storeId) {
        return jdbcTemplate.query("""
                        select id, term_id, store_id, template_code, template_revision, name, status,
                               effective_from, effective_until, configuration::text, version, updated_at
                        from gov_template_versions
                        where (cast(? as uuid) is null or term_id = cast(? as uuid))
                          and (cast(? as uuid) is null or store_id = cast(? as uuid))
                        order by template_code, template_revision
                        """, (resultSet, rowNumber) -> template(resultSet), termId, termId, storeId, storeId);
    }

    @Override
    public Optional<TemplateVersion> lockTemplateVersion(UUID templateVersionId) {
        return jdbcTemplate.query("""
                        select id, term_id, store_id, template_code, template_revision, name, status,
                               effective_from, effective_until, configuration::text, version, updated_at
                        from gov_template_versions where id = ? for update
                        """, resultSet -> resultSet.next() ? Optional.of(template(resultSet)) : Optional.empty(), templateVersionId);
    }

    @Override
    public TemplateVersion updateTemplateVersion(UUID templateVersionId, String name, LocalDate effectiveFrom,
                                                 LocalDate effectiveUntil, String configurationJson, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update gov_template_versions
                        set name = ?, effective_from = ?, effective_until = ?, configuration = cast(? as jsonb),
                            version = version + 1, updated_at = current_timestamp
                        where id = ? and status = 'DRAFT' and version = ?
                        returning id, term_id, store_id, template_code, template_revision, name, status,
                                  effective_from, effective_until, configuration::text, version, updated_at
                        """, (resultSet, rowNumber) -> template(resultSet), name, effectiveFrom, effectiveUntil,
                configurationJson, templateVersionId, expectedVersion);
    }

    @Override
    public TemplateVersion publishTemplateVersion(UUID templateVersionId, long expectedVersion, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        update gov_template_versions
                        set status = 'PUBLISHED', published_by_account_id = ?, published_at = current_timestamp,
                            version = version + 1, updated_at = current_timestamp
                        where id = ? and status = 'DRAFT' and version = ?
                        returning id, term_id, store_id, template_code, template_revision, name, status,
                                  effective_from, effective_until, configuration::text, version, updated_at
                        """, (resultSet, rowNumber) -> template(resultSet), actorId, templateVersionId, expectedVersion);
    }

    @Override
    public TemplateComponent createTemplateComponent(UUID id, UUID templateVersionId, String componentType, String code,
                                                     String name, String configurationJson, UUID actorId) {
        return jdbcTemplate.queryForObject("""
                        insert into gov_template_components
                            (id, template_version_id, component_type, code, name, configuration, created_by_account_id)
                        values (?, ?, ?, ?, ?, cast(? as jsonb), ?)
                        returning id, template_version_id, component_type, code, name, configuration::text, version, updated_at
                        """, (resultSet, rowNumber) -> templateComponent(resultSet), id, templateVersionId, componentType,
                code, name, configurationJson, actorId);
    }

    @Override
    public List<TemplateComponent> findTemplateComponents(UUID templateVersionId, String componentType) {
        return jdbcTemplate.query("""
                        select id, template_version_id, component_type, code, name, configuration::text, version, updated_at
                        from gov_template_components where template_version_id = ? and component_type = ? order by code
                        """, (resultSet, rowNumber) -> templateComponent(resultSet), templateVersionId, componentType);
    }

    @Override
    public Optional<TemplateComponent> findTemplateComponent(UUID templateComponentId) {
        return jdbcTemplate.query("""
                        select id, template_version_id, component_type, code, name, configuration::text, version, updated_at
                        from gov_template_components where id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(templateComponent(resultSet)) : Optional.empty(),
                templateComponentId);
    }

    @Override
    public TemplateComponent updateTemplateComponent(UUID templateComponentId, String name, String configurationJson,
                                                     long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update gov_template_components
                        set name = ?, configuration = cast(? as jsonb), version = version + 1, updated_at = current_timestamp
                        where id = ? and version = ?
                        returning id, template_version_id, component_type, code, name, configuration::text, version, updated_at
                        """, (resultSet, rowNumber) -> templateComponent(resultSet), name, configurationJson,
                templateComponentId, expectedVersion);
    }

    @Override
    public void appendAudit(AuditEvent event) {
        jdbcTemplate.update("""
                insert into audit_events
                    (id, event_type, resource_type, resource_id, actor_account_id, reason, previous_version, new_version, metadata)
                values (?, ?, ?, ?, ?, ?, ?, ?, cast(? as jsonb))
                """, UUID.randomUUID(), event.eventType(), event.resourceType(), event.resourceId(), event.actorId(),
                event.reason(), event.previousVersion(), event.newVersion(), event.metadataJson());
    }

    @Override
    public List<AuditEventView> findAuditEvents(String resourceType, UUID resourceId, OffsetDateTime from, OffsetDateTime to) {
        return jdbcTemplate.query("""
                        select id, event_type, resource_type, resource_id, actor_account_id, reason, previous_version,
                               new_version, metadata::text, occurred_at
                        from audit_events
                        where (cast(? as varchar) is null or resource_type = cast(? as varchar))
                          and (cast(? as uuid) is null or resource_id = cast(? as uuid))
                          and (cast(? as timestamptz) is null or occurred_at >= cast(? as timestamptz))
                          and (cast(? as timestamptz) is null or occurred_at <= cast(? as timestamptz))
                        order by occurred_at desc, id desc
                        """, (resultSet, rowNumber) -> auditEvent(resultSet), resourceType, resourceType,
                resourceId, resourceId, from, from, to, to);
    }

    private Term term(ResultSet resultSet) throws java.sql.SQLException {
        return new Term(resultSet.getObject("id", UUID.class), resultSet.getString("code"), resultSet.getString("name"),
                resultSet.getObject("start_date", LocalDate.class), resultSet.getObject("end_date", LocalDate.class),
                resultSet.getString("status"), resultSet.getLong("version"), resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private Store store(ResultSet resultSet) throws java.sql.SQLException {
        return new Store(resultSet.getObject("id", UUID.class), resultSet.getString("code"), resultSet.getString("name"),
                resultSet.getString("status"), resultSet.getLong("version"), resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private Team team(ResultSet resultSet) throws java.sql.SQLException {
        return new Team(resultSet.getObject("id", UUID.class), resultSet.getObject("term_id", UUID.class),
                resultSet.getString("code"), resultSet.getString("name"), resultSet.getString("status"),
                resultSet.getLong("version"), resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private Membership membership(ResultSet resultSet) throws java.sql.SQLException {
        return new Membership(resultSet.getObject("id", UUID.class), resultSet.getObject("term_id", UUID.class),
                resultSet.getObject("account_id", UUID.class), resultSet.getObject("team_id", UUID.class),
                resultSet.getString("status"), resultSet.getLong("version"),
                resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private TeachingWeek teachingWeek(ResultSet resultSet) throws java.sql.SQLException {
        return new TeachingWeek(resultSet.getObject("id", UUID.class), resultSet.getObject("term_id", UUID.class),
                resultSet.getInt("week_number"), resultSet.getString("name"),
                resultSet.getObject("start_date", LocalDate.class), resultSet.getObject("end_date", LocalDate.class),
                resultSet.getString("phase_code"), resultSet.getLong("version"),
                resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private TemplateVersion template(ResultSet resultSet) throws java.sql.SQLException {
        return new TemplateVersion(resultSet.getObject("id", UUID.class), resultSet.getObject("term_id", UUID.class),
                resultSet.getObject("store_id", UUID.class), resultSet.getString("template_code"),
                resultSet.getInt("template_revision"), resultSet.getString("name"),
                TemplateStatus.valueOf(resultSet.getString("status")), resultSet.getObject("effective_from", LocalDate.class),
                resultSet.getObject("effective_until", LocalDate.class), resultSet.getString("configuration"),
                resultSet.getLong("version"),
                resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private TemplateComponent templateComponent(ResultSet resultSet) throws java.sql.SQLException {
        return new TemplateComponent(resultSet.getObject("id", UUID.class),
                resultSet.getObject("template_version_id", UUID.class), resultSet.getString("component_type"),
                resultSet.getString("code"), resultSet.getString("name"), resultSet.getString("configuration"),
                resultSet.getLong("version"), resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private AuditEventView auditEvent(ResultSet resultSet) throws java.sql.SQLException {
        return new AuditEventView(resultSet.getObject("id", UUID.class), resultSet.getString("event_type"),
                resultSet.getString("resource_type"), resultSet.getObject("resource_id", UUID.class),
                resultSet.getObject("actor_account_id", UUID.class), resultSet.getString("reason"),
                resultSet.getObject("previous_version", Long.class), resultSet.getObject("new_version", Long.class),
                resultSet.getString("metadata"), resultSet.getObject("occurred_at", OffsetDateTime.class));
    }
}
