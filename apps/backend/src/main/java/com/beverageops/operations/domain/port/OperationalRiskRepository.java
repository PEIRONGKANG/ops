package com.beverageops.operations.domain.port;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.List;
import java.util.UUID;

import com.beverageops.operations.domain.model.HandoverStatus;
import com.beverageops.operations.domain.model.IncidentStatus;
import com.beverageops.operations.domain.model.OperatingSummaryStatus;

public interface OperationalRiskRepository {

    OperatingSummary createSummary(UUID id, UUID shiftId, String sourceSystem, String collectionMethod, String sourceReference,
                                   OffsetDateTime collectedAt, String summaryDataJson, boolean pendingSupplement, String note,
                                   UUID collectedByAccountId);

    Optional<OperatingSummary> lockSummary(UUID summaryId);

    OperatingSummary updateSummary(UUID summaryId, String summaryDataJson, boolean pendingSupplement, String note,
                                   OperatingSummaryStatus nextStatus, long expectedVersion);

    OperatingSummary confirmSummary(UUID summaryId, UUID actorId, long expectedVersion);

    List<OperatingSummary> findSummaries(UUID shiftId);

    Incident createIncident(UUID id, UUID shiftId, String categoryCode, String severity, boolean blocking, String description,
                            UUID reportedByAccountId);

    Optional<Incident> lockIncident(UUID incidentId);

    Incident updateIncident(UUID incidentId, String categoryCode, String severity, boolean blocking, String description,
                            long expectedVersion);

    Incident transitionIncident(UUID incidentId, IncidentStatus expectedStatus, IncidentStatus nextStatus, UUID assigneeAccountId,
                                OffsetDateTime dueAt, String controlMeasure, String verificationEvidenceReference,
                                long expectedVersion);

    void appendIncidentHistory(UUID incidentId, String eventType, UUID actorId, String reason, IncidentStatus previousStatus,
                               IncidentStatus nextStatus, long previousVersion, long newVersion);

    void appendIncidentAction(UUID incidentId, String actionType, String content, UUID assigneeAccountId, OffsetDateTime dueAt,
                              UUID actorId);

    void linkIncidentEvidence(UUID incidentId, String relationType, String evidenceReference, UUID actorId);

    boolean hasOpenBlockingIncident(UUID shiftId);

    List<Incident> findIncidents(UUID shiftId);

    Incident waiveBlocking(UUID incidentId, UUID actorId, String reason, long expectedVersion);

    Handover createHandover(UUID id, UUID shiftId, UUID receivingShiftId, UUID receivingAccountId, boolean requiredForClose,
                            String contentJson);

    Optional<Handover> lockHandover(UUID handoverId);

    Optional<UUID> handoverInitiator(UUID handoverId);

    Handover transitionHandover(UUID handoverId, HandoverStatus expectedStatus, HandoverStatus nextStatus, UUID actorId,
                                long expectedVersion);

    void appendHandoverHistory(UUID handoverId, String eventType, UUID actorId, String reason, HandoverStatus previousStatus,
                               HandoverStatus nextStatus, long previousVersion, long newVersion);

    boolean hasUnacceptedRequiredHandover(UUID shiftId);

    List<Handover> findHandovers(UUID shiftId);

    Handover updateHandover(UUID handoverId, String contentJson, long expectedVersion);

    void appendHandoverVersion(UUID handoverId, String contentJson, HandoverStatus status, long resourceVersion,
                               String eventType, UUID actorId);

    record OperatingSummary(UUID id, UUID shiftId, String sourceSystem, String collectionMethod, String sourceReference,
                            OffsetDateTime collectedAt, String summaryDataJson, boolean pendingSupplement, String note,
                            UUID collectedByAccountId, OperatingSummaryStatus status, long version, OffsetDateTime updatedAt) {
    }

    record Incident(UUID id, UUID shiftId, String categoryCode, String severity, boolean blocking, String description,
                    IncidentStatus status, UUID reportedByAccountId, UUID assigneeAccountId, OffsetDateTime dueAt,
                    String controlMeasure, String verificationEvidenceReference, long version, OffsetDateTime updatedAt) {
    }

    record Handover(UUID id, UUID shiftId, UUID receivingShiftId, UUID receivingAccountId, boolean requiredForClose,
                    String contentJson, HandoverStatus status, long version, OffsetDateTime updatedAt) {
    }
}
