package com.beverageops.operations.application.usecase;

import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.UUID;

import com.beverageops.governance.application.usecase.VersionConflictException;
import com.beverageops.identityaccess.application.usecase.ForbiddenException;
import com.beverageops.identityaccess.application.usecase.ResourceNotFoundException;
import com.beverageops.operations.domain.model.HandoverStatus;
import com.beverageops.operations.domain.model.IncidentStatus;
import com.beverageops.operations.domain.model.OperatingSummaryStatus;
import com.beverageops.operations.domain.port.OperationalRiskRepository;
import com.beverageops.operations.domain.port.OperationsSchedulingRepository;
import com.beverageops.shared.notification.application.event.OperationalNotificationRequested;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OperationalRiskUseCase {

    private final OperationsSchedulingRepository scheduling;
    private final OperationalRiskRepository risk;
    private final ApplicationEventPublisher events;

    public OperationalRiskUseCase(OperationsSchedulingRepository scheduling, OperationalRiskRepository risk,
                                  ApplicationEventPublisher events) {
        this.scheduling = scheduling;
        this.risk = risk;
        this.events = events;
    }

    @Transactional
    public OperationalRiskRepository.OperatingSummary createSummary(CreateSummaryCommand command) {
        var shift = shift(command.shiftId());
        requireOperationalWriter(command.actorId(), command.p1(), command.p2(), command.p3(), shift);
        if (command.collectedAt() == null) {
            throw new IllegalArgumentException("Collection time is required.");
        }
        var summary = risk.createSummary(UUID.randomUUID(), shift.id(), requiredText(command.sourceSystem(), "Source system", 128),
                requiredText(command.collectionMethod(), "Collection method", 64),
                requiredText(command.sourceReference(), "Source reference", 512), command.collectedAt(),
                command.summaryDataJson() == null ? "{}" : command.summaryDataJson(), command.pendingSupplement(),
                optionalText(command.note(), "Note", 1000), command.actorId());
        audit("OPERATING_SUMMARY_CREATED", "OPERATING_SUMMARY", summary.id(), command.actorId(), null, null, summary.version());
        if (summary.pendingSupplement()) {
            notify(summary.collectedByAccountId(), "OPERATING_SUMMARY_PENDING_SUPPLEMENT", "OPERATING_SUMMARY", summary.id(),
                    "经营摘要待补充", "外部经营数据尚未可用，请在数据到位后补充摘要。", command.actorId());
        }
        return summary;
    }

    @Transactional
    public OperationalRiskRepository.OperatingSummary updateSummary(UUID summaryId, UpdateSummaryCommand command) {
        var summary = lockSummary(summaryId);
        var shift = shift(summary.shiftId());
        requireSummaryEditor(summary, command.actorId(), command.p1(), command.p2(), command.p3(), shift);
        requireVersion(summary.version(), command.version());
        if (summary.status() == OperatingSummaryStatus.CONFIRMED) {
            throw new IllegalStateException("A confirmed operating summary cannot be changed in place.");
        }
        var pending = command.pendingSupplement();
        var updated = risk.updateSummary(summary.id(), command.summaryDataJson() == null ? "{}" : command.summaryDataJson(), pending,
                optionalText(command.note(), "Note", 1000), pending ? OperatingSummaryStatus.PENDING_SUPPLEMENT : OperatingSummaryStatus.RECORDED,
                command.version());
        audit("OPERATING_SUMMARY_UPDATED", "OPERATING_SUMMARY", summary.id(), command.actorId(), null, summary.version(),
                updated.version());
        return updated;
    }

    @Transactional
    public OperationalRiskRepository.OperatingSummary confirmSummary(UUID summaryId, VersionCommand command) {
        var summary = lockSummary(summaryId);
        requireP2Scope(command.actorId(), command.p1(), command.p2(), summary.shiftId());
        requireVersion(summary.version(), command.version());
        if (summary.status() != OperatingSummaryStatus.RECORDED) {
            throw new IllegalStateException("Only a recorded operating summary can be confirmed.");
        }
        var updated = risk.confirmSummary(summary.id(), command.actorId(), command.version());
        audit("OPERATING_SUMMARY_CONFIRMED", "OPERATING_SUMMARY", summary.id(), command.actorId(), null, summary.version(),
                updated.version());
        return updated;
    }

    @Transactional(readOnly = true)
    public java.util.List<OperationalRiskRepository.OperatingSummary> summaries(UUID shiftId, ReadCommand command) {
        requireRiskReadAccess(shiftId, command);
        return risk.findSummaries(shiftId);
    }

    @Transactional
    public OperationalRiskRepository.Incident createIncident(CreateIncidentCommand command) {
        var shift = shift(command.shiftId());
        requireOperationalWriter(command.actorId(), command.p1(), command.p2(), command.p3(), shift);
        var incident = risk.createIncident(UUID.randomUUID(), shift.id(), requiredCode(command.categoryCode(), "Incident category"),
                severity(command.severity()), command.blocking(), requiredText(command.description(), "Incident description", 2000),
                command.actorId());
        risk.appendIncidentHistory(incident.id(), "INCIDENT_REPORTED", command.actorId(), null, IncidentStatus.REPORTED,
                IncidentStatus.REPORTED, 0, incident.version());
        audit("INCIDENT_REPORTED", "INCIDENT", incident.id(), command.actorId(), null, null, incident.version());
        return incident;
    }

    @Transactional
    public OperationalRiskRepository.Incident updateIncident(UUID incidentId, UpdateIncidentCommand command) {
        var incident = lockIncident(incidentId);
        var shift = shift(incident.shiftId());
        if (incident.status() != IncidentStatus.REPORTED) {
            throw new IllegalStateException("Only a reported incident can be edited.");
        }
        if (command.p1() || (command.p2() && hasP2Scope(command.actorId(), shift))) {
            // Scoped operational managers may correct a still-unacknowledged report.
        } else if (!command.p3() || !incident.reportedByAccountId().equals(command.actorId())) {
            throw new ForbiddenException("Only the original reporter or scoped P2 can edit a reported incident.");
        }
        requireVersion(incident.version(), command.version());
        var updated = risk.updateIncident(incident.id(), requiredCode(command.categoryCode(), "Incident category"),
                severity(command.severity()), command.blocking(), requiredText(command.description(), "Incident description", 2000),
                command.version());
        risk.appendIncidentHistory(incident.id(), "INCIDENT_UPDATED", command.actorId(), null, incident.status(),
                incident.status(), incident.version(), updated.version());
        audit("INCIDENT_UPDATED", "INCIDENT", incident.id(), command.actorId(), null, incident.version(), updated.version());
        return updated;
    }

    @Transactional
    public OperationalRiskRepository.Incident acknowledgeIncident(UUID incidentId, VersionCommand command) {
        var incident = lockIncident(incidentId);
        requireP2Scope(command.actorId(), command.p1(), command.p2(), incident.shiftId());
        return transitionIncident(incident, IncidentStatus.ACKNOWLEDGED, command.version(), command.actorId(), null, null, null,
                "INCIDENT_ACKNOWLEDGED");
    }

    @Transactional
    public OperationalRiskRepository.Incident assignIncident(UUID incidentId, AssignIncidentCommand command) {
        var incident = lockIncident(incidentId);
        requireP2Scope(command.actorId(), command.p1(), command.p2(), incident.shiftId());
        if (command.assigneeAccountId() == null || command.dueAt() == null) {
            throw new IllegalArgumentException("Incident assignee and due time are required.");
        }
        var controlMeasure = requiredText(command.controlMeasure(), "Temporary control measure", 1000);
        var updated = transitionIncident(incident, IncidentStatus.IN_PROGRESS, command.version(), command.actorId(),
                command.assigneeAccountId(), command.dueAt(), controlMeasure, "INCIDENT_ASSIGNED");
        risk.appendIncidentAction(incident.id(), "CONTROL_MEASURE", controlMeasure, command.assigneeAccountId(), command.dueAt(),
                command.actorId());
        notify(command.assigneeAccountId(), "INCIDENT_ASSIGNED", "INCIDENT", incident.id(), "异常已指派",
                "你被指派处理一项异常，请在时限前提交验证证据。", command.actorId());
        return updated;
    }

    @Transactional
    public OperationalRiskRepository.Incident submitIncidentVerification(UUID incidentId, VerificationCommand command) {
        var incident = lockIncident(incidentId);
        if (!command.p1() && !command.actorId().equals(incident.assigneeAccountId())) {
            throw new ForbiddenException("Only the assigned resolver can submit incident verification.");
        }
        var evidenceReference = requiredText(command.evidenceReference(), "Verification evidence reference", 1024);
        var updated = transitionIncident(incident, IncidentStatus.PENDING_VERIFICATION, command.version(), command.actorId(), null,
                null, evidenceReference, "INCIDENT_VERIFICATION_SUBMITTED");
        risk.linkIncidentEvidence(incident.id(), "VERIFICATION", evidenceReference, command.actorId());
        risk.appendIncidentAction(incident.id(), "VERIFICATION", evidenceReference, null, null, command.actorId());
        return updated;
    }

    @Transactional
    public OperationalRiskRepository.Incident closeIncident(UUID incidentId, VersionCommand command) {
        var incident = lockIncident(incidentId);
        requireP2Scope(command.actorId(), command.p1(), command.p2(), incident.shiftId());
        return transitionIncident(incident, IncidentStatus.CLOSED, command.version(), command.actorId(), null, null, null,
                "INCIDENT_CLOSED");
    }

    @Transactional
    public OperationalRiskRepository.Incident returnIncidentVerification(UUID incidentId, ReasonVersionCommand command) {
        var incident = lockIncident(incidentId);
        requireP2Scope(command.actorId(), command.p1(), command.p2(), incident.shiftId());
        requireVersion(incident.version(), command.version());
        if (incident.status() != IncidentStatus.PENDING_VERIFICATION) {
            throw new IllegalStateException("Only an incident pending verification can be returned.");
        }
        var reason = requiredText(command.reason(), "Verification return reason", 1000);
        var updated = risk.transitionIncident(incident.id(), IncidentStatus.PENDING_VERIFICATION, IncidentStatus.IN_PROGRESS,
                null, null, null, null, command.version());
        risk.appendIncidentAction(incident.id(), "VERIFICATION_RETURN", reason, null, null, command.actorId());
        risk.appendIncidentHistory(incident.id(), "INCIDENT_VERIFICATION_RETURNED", command.actorId(), reason,
                incident.status(), updated.status(), incident.version(), updated.version());
        audit("INCIDENT_VERIFICATION_RETURNED", "INCIDENT", incident.id(), command.actorId(), reason, incident.version(),
                updated.version());
        return updated;
    }

    @Transactional
    public OperationalRiskRepository.Incident reopenIncident(UUID incidentId, ReasonVersionCommand command) {
        var incident = lockIncident(incidentId);
        requireP2Scope(command.actorId(), command.p1(), command.p2(), incident.shiftId());
        var reason = requiredText(command.reason(), "Reopen reason", 1000);
        var updated = transitionIncident(incident, IncidentStatus.REOPENED, command.version(), command.actorId(), null, null,
                reason, "INCIDENT_REOPENED");
        risk.appendIncidentAction(incident.id(), "REOPEN", reason, null, null, command.actorId());
        return updated;
    }

    @Transactional
    public OperationalRiskRepository.Incident waiveBlocking(UUID incidentId, ReasonVersionCommand command) {
        var incident = lockIncident(incidentId);
        requireP2Scope(command.actorId(), command.p1(), command.p2(), incident.shiftId());
        requireVersion(incident.version(), command.version());
        if (!incident.blocking()) {
            throw new IllegalStateException("Only a blocking incident can be waived.");
        }
        var reason = requiredText(command.reason(), "Blocking waiver reason", 1000);
        var updated = risk.waiveBlocking(incident.id(), command.actorId(), reason, command.version());
        risk.appendIncidentAction(incident.id(), "BLOCKING_WAIVER", reason, null, null, command.actorId());
        risk.appendIncidentHistory(incident.id(), "INCIDENT_BLOCKING_WAIVED", command.actorId(), reason,
                incident.status(), incident.status(), incident.version(), updated.version());
        audit("INCIDENT_BLOCKING_WAIVED", "INCIDENT", incident.id(), command.actorId(), reason, incident.version(),
                updated.version());
        return updated;
    }

    @Transactional(readOnly = true)
    public java.util.List<OperationalRiskRepository.Incident> incidents(UUID shiftId, ReadCommand command) {
        requireRiskReadAccess(shiftId, command);
        return risk.findIncidents(shiftId);
    }

    @Transactional
    public OperationalRiskRepository.Handover createHandover(CreateHandoverCommand command) {
        var shift = shift(command.shiftId());
        requireAssignedP3(command.actorId(), command.p3(), shift.id());
        if (command.receivingAccountId() == null || command.contentJson() == null || command.contentJson().isBlank()) {
            throw new IllegalArgumentException("Receiving student and handover content are required.");
        }
        if (command.receivingShiftId() != null && !scheduling.isAssignedToShift(command.receivingAccountId(), command.receivingShiftId())) {
            throw new IllegalArgumentException("The receiving student must be assigned to the receiving shift.");
        }
        var handover = risk.createHandover(UUID.randomUUID(), shift.id(), command.receivingShiftId(), command.receivingAccountId(),
                command.requiredForClose(), command.contentJson());
        risk.appendHandoverHistory(handover.id(), "HANDOVER_CREATED", command.actorId(), null, HandoverStatus.DRAFT,
                HandoverStatus.DRAFT, 0, handover.version());
        risk.appendHandoverVersion(handover.id(), handover.contentJson(), handover.status(), handover.version(), "HANDOVER_CREATED",
                command.actorId());
        audit("HANDOVER_CREATED", "HANDOVER", handover.id(), command.actorId(), null, null, handover.version());
        return handover;
    }

    @Transactional
    public OperationalRiskRepository.Handover submitHandover(UUID handoverId, VersionCommand command) {
        var handover = lockHandover(handoverId);
        requireAssignedP3(command.actorId(), command.p3(), handover.shiftId());
        if (!command.p1() && !isHandoverInitiator(handover.id(), command.actorId())) {
            throw new ForbiddenException("Only the handover initiator can submit this handover.");
        }
        var updated = transitionHandover(handover, HandoverStatus.SUBMITTED, command.version(), command.actorId(), null,
                "HANDOVER_SUBMITTED");
        notify(handover.receivingAccountId(), "HANDOVER_SUBMITTED", "HANDOVER", handover.id(), "待接收交接",
                "有一份交接等待你确认接收。", command.actorId());
        return updated;
    }

    @Transactional
    public OperationalRiskRepository.Handover acceptHandover(UUID handoverId, VersionCommand command) {
        var handover = lockHandover(handoverId);
        if (!command.p1() && (!command.p3() || !command.actorId().equals(handover.receivingAccountId()))) {
            throw new ForbiddenException("Only the designated receiving student can accept this handover.");
        }
        return transitionHandover(handover, HandoverStatus.ACCEPTED, command.version(), command.actorId(), null,
                "HANDOVER_ACCEPTED");
    }

    @Transactional
    public OperationalRiskRepository.Handover returnHandover(UUID handoverId, ReasonVersionCommand command) {
        var handover = lockHandover(handoverId);
        boolean receiver = command.p3() && command.actorId().equals(handover.receivingAccountId());
        if (!command.p1() && !receiver && !(command.p2() && hasP2Scope(command.actorId(), shift(handover.shiftId())))) {
            throw new ForbiddenException("Only the receiving student or scoped P2 can return this handover.");
        }
        var updated = transitionHandover(handover, HandoverStatus.RETURNED, command.version(), command.actorId(),
                requiredText(command.reason(), "Return reason", 1000), "HANDOVER_RETURNED");
        risk.handoverInitiator(handover.id()).ifPresent(initiator -> notify(initiator, "HANDOVER_RETURNED", "HANDOVER",
                handover.id(), "交接需补充", "交接被退回，请补充后重新提交。", command.actorId()));
        return updated;
    }

    @Transactional
    public OperationalRiskRepository.Handover approveHandover(UUID handoverId, VersionCommand command) {
        var handover = lockHandover(handoverId);
        requireP2Scope(command.actorId(), command.p1(), command.p2(), handover.shiftId());
        if (!handover.requiredForClose()) {
            throw new IllegalStateException("Only a required handover needs P2 approval.");
        }
        return transitionHandover(handover, HandoverStatus.APPROVED, command.version(), command.actorId(), null,
                "HANDOVER_APPROVED");
    }

    @Transactional
    public OperationalRiskRepository.Handover updateHandover(UUID handoverId, UpdateHandoverCommand command) {
        var handover = lockHandover(handoverId);
        requireVersion(handover.version(), command.version());
        if (!command.p1() && (!command.p3() || !scheduling.isAssignedToShift(command.actorId(), handover.shiftId()))) {
            throw new ForbiddenException("Only an assigned student can revise this handover.");
        }
        if (!command.p1() && !isHandoverInitiator(handover.id(), command.actorId())) {
            throw new ForbiddenException("Only the handover initiator can revise this handover.");
        }
        if (handover.status() != HandoverStatus.DRAFT && handover.status() != HandoverStatus.RETURNED) {
            throw new IllegalStateException("Only a draft or returned handover can be revised.");
        }
        var content = requiredText(command.contentJson(), "Handover content", 10000);
        var updated = risk.updateHandover(handover.id(), content, command.version());
        risk.appendHandoverHistory(handover.id(), "HANDOVER_UPDATED", command.actorId(), null, handover.status(),
                handover.status(), handover.version(), updated.version());
        risk.appendHandoverVersion(handover.id(), updated.contentJson(), updated.status(), updated.version(), "HANDOVER_UPDATED",
                command.actorId());
        audit("HANDOVER_UPDATED", "HANDOVER", handover.id(), command.actorId(), null, handover.version(), updated.version());
        return updated;
    }

    @Transactional(readOnly = true)
    public java.util.List<OperationalRiskRepository.Handover> handovers(UUID shiftId, ReadCommand command) {
        var shift = shift(shiftId);
        var handovers = risk.findHandovers(shiftId);
        if (command.p1() || (command.p2() && hasP2Scope(command.actorId(), shift))
                || (command.p3() && scheduling.isAssignedToShift(command.actorId(), shiftId))) {
            return handovers;
        }
        var received = handovers.stream().anyMatch(handover -> command.p3()
                && command.actorId().equals(handover.receivingAccountId()));
        if (received) {
            return handovers.stream().filter(handover -> command.actorId().equals(handover.receivingAccountId())).toList();
        }
        throw new ForbiddenException("You do not have access to this shift's handovers.");
    }

    private OperationalRiskRepository.Incident transitionIncident(OperationalRiskRepository.Incident incident,
                                                                    IncidentStatus next, long expectedVersion, UUID actorId,
                                                                    UUID assignee, OffsetDateTime dueAt, String extra,
                                                                    String eventType) {
        requireVersion(incident.version(), expectedVersion);
        IncidentStatus expected = switch (next) {
            case ACKNOWLEDGED -> IncidentStatus.REPORTED;
            case IN_PROGRESS -> incident.status() == IncidentStatus.REOPENED
                    ? IncidentStatus.REOPENED
                    : IncidentStatus.ACKNOWLEDGED;
            case PENDING_VERIFICATION -> IncidentStatus.IN_PROGRESS;
            case CLOSED -> IncidentStatus.PENDING_VERIFICATION;
            case REOPENED -> IncidentStatus.CLOSED;
            default -> throw new IllegalStateException("Unsupported incident transition.");
        };
        if (incident.status() != expected) {
            throw new IllegalStateException("The incident is not in the required state for this operation.");
        }
        var updated = risk.transitionIncident(incident.id(), expected, next, assignee, dueAt,
                next == IncidentStatus.IN_PROGRESS ? extra : null,
                next == IncidentStatus.PENDING_VERIFICATION ? extra : null, expectedVersion);
        risk.appendIncidentHistory(incident.id(), eventType, actorId, next == IncidentStatus.REOPENED ? extra : null,
                incident.status(), next, incident.version(), updated.version());
        audit(eventType, "INCIDENT", incident.id(), actorId, next == IncidentStatus.REOPENED ? extra : null,
                incident.version(), updated.version());
        return updated;
    }

    private OperationalRiskRepository.Handover transitionHandover(OperationalRiskRepository.Handover handover,
                                                                    HandoverStatus next, long expectedVersion, UUID actorId,
                                                                    String reason, String eventType) {
        requireVersion(handover.version(), expectedVersion);
        HandoverStatus expected = switch (next) {
            case SUBMITTED -> handover.status() == HandoverStatus.RETURNED ? HandoverStatus.RETURNED : HandoverStatus.DRAFT;
            case RETURNED -> HandoverStatus.SUBMITTED;
            case ACCEPTED -> HandoverStatus.SUBMITTED;
            case APPROVED -> HandoverStatus.ACCEPTED;
            default -> throw new IllegalStateException("Unsupported handover transition.");
        };
        if (handover.status() != expected) {
            throw new IllegalStateException("The handover is not in the required state for this operation.");
        }
        var updated = risk.transitionHandover(handover.id(), expected, next, actorId, expectedVersion);
        risk.appendHandoverHistory(handover.id(), eventType, actorId, reason, handover.status(), next, handover.version(),
                updated.version());
        risk.appendHandoverVersion(handover.id(), updated.contentJson(), updated.status(), updated.version(), eventType, actorId);
        audit(eventType, "HANDOVER", handover.id(), actorId, reason, handover.version(), updated.version());
        return updated;
    }

    private void requireOperationalWriter(UUID actorId, boolean p1, boolean p2, boolean p3,
                                          OperationsSchedulingRepository.Shift shift) {
        if (p1 || (p2 && hasP2Scope(actorId, shift))) {
            return;
        }
        requireAssignedP3(actorId, p3, shift.id());
    }

    private void requireRiskReadAccess(UUID shiftId, ReadCommand command) {
        var shift = shift(shiftId);
        if (command.p1() || (command.p2() && hasP2Scope(command.actorId(), shift))) {
            return;
        }
        if (command.p3() && scheduling.isAssignedToShift(command.actorId(), shiftId)) {
            return;
        }
        throw new ForbiddenException("You do not have access to this shift's operational risk records.");
    }

    private boolean isHandoverInitiator(UUID handoverId, UUID actorId) {
        return risk.handoverInitiator(handoverId).map(actorId::equals).orElse(false);
    }

    private void requireSummaryEditor(OperationalRiskRepository.OperatingSummary summary, UUID actorId, boolean p1, boolean p2,
                                      boolean p3, OperationsSchedulingRepository.Shift shift) {
        if (p1 || (p2 && hasP2Scope(actorId, shift))) {
            return;
        }
        if (!p3 || !summary.collectedByAccountId().equals(actorId)) {
            throw new ForbiddenException("Only the original collector or scoped P2 can update this summary.");
        }
    }

    private void requireP2Scope(UUID actorId, boolean p1, boolean p2, UUID shiftId) {
        if (!p1 && (!p2 || !hasP2Scope(actorId, shift(shiftId)))) {
            throw new ForbiddenException("You do not have P2 scope for this term and store.");
        }
    }

    private boolean hasP2Scope(UUID actorId, OperationsSchedulingRepository.Shift shift) {
        return scheduling.hasScope(actorId, "P2", shift.termId(), shift.storeId());
    }

    private void requireAssignedP3(UUID actorId, boolean p3, UUID shiftId) {
        if (!p3 || !scheduling.isAssignedToShift(actorId, shiftId)) {
            throw new ForbiddenException("Only an assigned student can perform this operation.");
        }
    }

    private OperationalRiskRepository.OperatingSummary lockSummary(UUID summaryId) {
        return risk.lockSummary(summaryId).orElseThrow(() -> new ResourceNotFoundException("Operating summary not found."));
    }

    private OperationalRiskRepository.Incident lockIncident(UUID incidentId) {
        return risk.lockIncident(incidentId).orElseThrow(() -> new ResourceNotFoundException("Incident not found."));
    }

    private OperationalRiskRepository.Handover lockHandover(UUID handoverId) {
        return risk.lockHandover(handoverId).orElseThrow(() -> new ResourceNotFoundException("Handover not found."));
    }

    private OperationsSchedulingRepository.Shift shift(UUID shiftId) {
        return scheduling.findShift(shiftId).orElseThrow(() -> new ResourceNotFoundException("Shift not found."));
    }

    private void requireVersion(long actual, long expected) {
        if (actual != expected) {
            throw new VersionConflictException("The resource has changed. Refresh and try again.");
        }
    }

    private void audit(String eventType, String resourceType, UUID resourceId, UUID actorId, String reason,
                       Long previousVersion, Long newVersion) {
        scheduling.appendAudit(eventType, resourceType, resourceId, actorId, reason, previousVersion, newVersion);
    }

    private void notify(UUID recipientAccountId, String eventType, String resourceType, UUID resourceId, String title,
                        String message, UUID actorAccountId) {
        events.publishEvent(new OperationalNotificationRequested(recipientAccountId, eventType, resourceType, resourceId,
                title, message, actorAccountId));
    }

    private String severity(String value) {
        var severity = requiredText(value, "Incident severity", 16).toUpperCase(Locale.ROOT);
        if (!severity.equals("LOW") && !severity.equals("MEDIUM") && !severity.equals("HIGH") && !severity.equals("CRITICAL")) {
            throw new IllegalArgumentException("Incident severity is unsupported.");
        }
        return severity;
    }

    private String requiredCode(String value, String field) {
        var code = requiredText(value, field, 64).toUpperCase(Locale.ROOT);
        if (!code.matches("[A-Z0-9][A-Z0-9_-]*")) {
            throw new IllegalArgumentException(field + " may contain only A-Z, 0-9, underscores and hyphens.");
        }
        return code;
    }

    private String requiredText(String value, String field, int maxLength) {
        if (value == null || value.trim().isEmpty() || value.trim().length() > maxLength) {
            throw new IllegalArgumentException(field + " must contain 1 to " + maxLength + " characters.");
        }
        return value.trim();
    }

    private String optionalText(String value, String field, int maxLength) {
        return value == null || value.isBlank() ? null : requiredText(value, field, maxLength);
    }

    public record VersionCommand(long version, UUID actorId, boolean p1, boolean p2, boolean p3) {
    }

    public record ReasonVersionCommand(long version, String reason, UUID actorId, boolean p1, boolean p2, boolean p3) {
    }

    public record ReadCommand(UUID actorId, boolean p1, boolean p2, boolean p3) {
    }

    public record CreateSummaryCommand(UUID shiftId, String sourceSystem, String collectionMethod, String sourceReference,
                                       OffsetDateTime collectedAt, String summaryDataJson, boolean pendingSupplement, String note,
                                       UUID actorId, boolean p1, boolean p2, boolean p3) {
    }

    public record UpdateSummaryCommand(String summaryDataJson, boolean pendingSupplement, String note, long version, UUID actorId,
                                       boolean p1, boolean p2, boolean p3) {
    }

    public record CreateIncidentCommand(UUID shiftId, String categoryCode, String severity, boolean blocking, String description,
                                        UUID actorId, boolean p1, boolean p2, boolean p3) {
    }

    public record UpdateIncidentCommand(String categoryCode, String severity, boolean blocking, String description, long version,
                                        UUID actorId, boolean p1, boolean p2, boolean p3) {
    }

    public record AssignIncidentCommand(long version, UUID assigneeAccountId, OffsetDateTime dueAt, String controlMeasure,
                                        UUID actorId, boolean p1, boolean p2) {
    }

    public record VerificationCommand(long version, String evidenceReference, UUID actorId, boolean p1) {
    }

    public record CreateHandoverCommand(UUID shiftId, UUID receivingShiftId, UUID receivingAccountId, boolean requiredForClose,
                                        String contentJson, UUID actorId, boolean p3) {
    }

    public record UpdateHandoverCommand(String contentJson, long version, UUID actorId, boolean p1, boolean p3) {
    }
}
