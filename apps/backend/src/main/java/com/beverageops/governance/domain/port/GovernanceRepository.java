package com.beverageops.governance.domain.port;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.governance.domain.model.TemplateStatus;

public interface GovernanceRepository {

    Term createTerm(UUID id, String code, String name, LocalDate startDate, LocalDate endDate, UUID actorId);

    Optional<Term> findTerm(UUID termId);

    List<Term> findTerms();

    Term updateTerm(UUID termId, String name, LocalDate startDate, LocalDate endDate, long expectedVersion);

    Term publishTerm(UUID termId, long expectedVersion);

    Term archiveTerm(UUID termId, long expectedVersion);

    Store createStore(UUID id, String code, String name, UUID actorId);

    Optional<Store> findStore(UUID storeId);

    List<Store> findStores();

    Store updateStore(UUID storeId, String name, String status, long expectedVersion);

    Team createTeam(UUID id, UUID termId, String code, String name, UUID actorId);

    Optional<Team> findTeam(UUID teamId);

    List<Team> findTeams(UUID termId);

    Team updateTeam(UUID teamId, String name, String status, long expectedVersion);

    TeachingWeek createTeachingWeek(UUID id, UUID termId, int weekNumber, String name, LocalDate startDate,
                                    LocalDate endDate, String phaseCode, UUID actorId);

    List<TeachingWeek> findTeachingWeeks(UUID termId);

    Optional<TeachingWeek> findTeachingWeek(UUID teachingWeekId);

    TeachingWeek updateTeachingWeek(UUID teachingWeekId, String name, LocalDate startDate, LocalDate endDate,
                                    String phaseCode, long expectedVersion);

    Membership createMembership(UUID id, UUID termId, UUID accountId, UUID teamId, UUID actorId);

    Optional<Membership> findMembership(UUID membershipId);

    List<Membership> findMemberships(UUID termId);

    Membership deactivateMembership(UUID membershipId, long expectedVersion, UUID actorId);

    TemplateVersion createTemplateVersion(UUID id, UUID termId, UUID storeId, String templateCode,
                                          int templateRevision, String name, LocalDate effectiveFrom,
                                          String configurationJson, UUID actorId);

    int nextTemplateRevision(UUID termId, UUID storeId, String templateCode);

    Optional<TemplateVersion> findTemplateVersion(UUID templateVersionId);

    List<TemplateVersion> findTemplateVersions(UUID termId, UUID storeId);

    Optional<TemplateVersion> lockTemplateVersion(UUID templateVersionId);

    TemplateVersion updateTemplateVersion(UUID templateVersionId, String name, LocalDate effectiveFrom,
                                          LocalDate effectiveUntil, String configurationJson, long expectedVersion);

    TemplateVersion publishTemplateVersion(UUID templateVersionId, long expectedVersion, UUID actorId);

    TemplateComponent createTemplateComponent(UUID id, UUID templateVersionId, String componentType, String code,
                                              String name, String configurationJson, UUID actorId);

    List<TemplateComponent> findTemplateComponents(UUID templateVersionId, String componentType);

    List<AuditEventView> findAuditEvents(String resourceType, UUID resourceId, OffsetDateTime from, OffsetDateTime to);

    void appendAudit(AuditEvent event);

    record Term(UUID id, String code, String name, LocalDate startDate, LocalDate endDate, String status,
                long version, OffsetDateTime updatedAt) {
    }

    record Store(UUID id, String code, String name, String status, long version, OffsetDateTime updatedAt) {
    }

    record Team(UUID id, UUID termId, String code, String name, String status, long version, OffsetDateTime updatedAt) {
    }

    record Membership(UUID id, UUID termId, UUID accountId, UUID teamId, String status, long version,
                      OffsetDateTime updatedAt) {
    }

    record TeachingWeek(UUID id, UUID termId, int weekNumber, String name, LocalDate startDate, LocalDate endDate,
                        String phaseCode, long version, OffsetDateTime updatedAt) {
    }

    record TemplateVersion(UUID id, UUID termId, UUID storeId, String templateCode, int templateRevision,
                           String name, TemplateStatus status, LocalDate effectiveFrom, LocalDate effectiveUntil,
                           String configurationJson,
                           long version, OffsetDateTime updatedAt) {
    }

    record TemplateComponent(UUID id, UUID templateVersionId, String componentType, String code, String name,
                             String configurationJson, long version, OffsetDateTime updatedAt) {
    }

    record AuditEvent(String eventType, String resourceType, UUID resourceId, UUID actorId,
                      Long previousVersion, Long newVersion, String reason, String metadataJson) {
    }

    record AuditEventView(UUID id, String eventType, String resourceType, UUID resourceId, UUID actorId,
                          String reason, Long previousVersion, Long newVersion, String metadataJson,
                          OffsetDateTime occurredAt) {
    }
}
