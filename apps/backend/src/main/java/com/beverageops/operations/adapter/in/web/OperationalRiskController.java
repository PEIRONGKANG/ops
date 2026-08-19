package com.beverageops.operations.adapter.in.web;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.beverageops.identityaccess.domain.port.AccessTokenPort;
import com.beverageops.operations.application.usecase.OperationalRiskUseCase;
import com.beverageops.operations.domain.port.OperationalRiskRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
class OperationalRiskController {

    private final OperationalRiskUseCase risk;
    private final ObjectMapper objectMapper;

    OperationalRiskController(OperationalRiskUseCase risk, ObjectMapper objectMapper) {
        this.risk = risk;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/operating-summaries")
    ResponseEntity<OperatingSummaryResponse> createSummary(@RequestBody CreateSummaryRequest request,
                                                            Authentication authentication) {
        var data = request.summaryData() == null ? "{}" : request.summaryData().toString();
        return ResponseEntity.status(HttpStatus.CREATED).body(summary(risk.createSummary(
                new OperationalRiskUseCase.CreateSummaryCommand(request.shiftId(), request.sourceSystem(), request.collectionMethod(),
                        request.sourceReference(), request.collectedAt(), data, request.pendingSupplement(), request.note(),
                        actorId(authentication), hasRole(authentication, "P1"), hasRole(authentication, "P2"),
                        hasRole(authentication, "P3")))));
    }

    @PatchMapping("/operating-summaries/{summaryId}")
    OperatingSummaryResponse updateSummary(@PathVariable UUID summaryId, @RequestBody UpdateSummaryRequest request,
                                           Authentication authentication) {
        var data = request.summaryData() == null ? "{}" : request.summaryData().toString();
        return summary(risk.updateSummary(summaryId, new OperationalRiskUseCase.UpdateSummaryCommand(data,
                request.pendingSupplement(), request.note(), request.version(), actorId(authentication),
                hasRole(authentication, "P1"), hasRole(authentication, "P2"), hasRole(authentication, "P3"))));
    }

    @GetMapping("/operating-summaries")
    List<OperatingSummaryResponse> summaries(@org.springframework.web.bind.annotation.RequestParam UUID shiftId,
                                             Authentication authentication) {
        return risk.summaries(shiftId, read(authentication)).stream().map(this::summary).toList();
    }

    @PostMapping("/operating-summaries/{summaryId}/confirm")
    OperatingSummaryResponse confirmSummary(@PathVariable UUID summaryId, @RequestBody VersionRequest request,
                                            Authentication authentication) {
        return summary(risk.confirmSummary(summaryId, version(request.version(), authentication)));
    }

    @PostMapping("/incidents")
    ResponseEntity<IncidentResponse> createIncident(@RequestBody CreateIncidentRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(incident(risk.createIncident(
                new OperationalRiskUseCase.CreateIncidentCommand(request.shiftId(), request.categoryCode(), request.severity(),
                        request.blocking(), request.description(), actorId(authentication), hasRole(authentication, "P1"),
                        hasRole(authentication, "P2"), hasRole(authentication, "P3")))));
    }

    @PostMapping("/incidents/{incidentId}/acknowledge")
    IncidentResponse acknowledge(@PathVariable UUID incidentId, @RequestBody VersionRequest request, Authentication authentication) {
        return incident(risk.acknowledgeIncident(incidentId, version(request.version(), authentication)));
    }

    @PatchMapping("/incidents/{incidentId}")
    IncidentResponse updateIncident(@PathVariable UUID incidentId, @RequestBody UpdateIncidentRequest request,
                                    Authentication authentication) {
        return incident(risk.updateIncident(incidentId, new OperationalRiskUseCase.UpdateIncidentCommand(request.categoryCode(),
                request.severity(), request.blocking(), request.description(), request.version(), actorId(authentication),
                hasRole(authentication, "P1"), hasRole(authentication, "P2"), hasRole(authentication, "P3"))));
    }

    @PostMapping("/incidents/{incidentId}/assign")
    IncidentResponse assign(@PathVariable UUID incidentId, @RequestBody AssignIncidentRequest request,
                            Authentication authentication) {
        return incident(risk.assignIncident(incidentId, new OperationalRiskUseCase.AssignIncidentCommand(request.version(),
                request.assigneeAccountId(), request.dueAt(), request.controlMeasure(), actorId(authentication),
                hasRole(authentication, "P1"), hasRole(authentication, "P2"))));
    }

    @PostMapping("/incidents/{incidentId}/submit-verification")
    IncidentResponse submitVerification(@PathVariable UUID incidentId, @RequestBody VerificationRequest request,
                                        Authentication authentication) {
        return incident(risk.submitIncidentVerification(incidentId, new OperationalRiskUseCase.VerificationCommand(request.version(),
                request.evidenceReference(), actorId(authentication), hasRole(authentication, "P1"))));
    }

    @PostMapping("/incidents/{incidentId}/close")
    IncidentResponse close(@PathVariable UUID incidentId, @RequestBody VersionRequest request, Authentication authentication) {
        return incident(risk.closeIncident(incidentId, version(request.version(), authentication)));
    }

    @PostMapping("/incidents/{incidentId}/return-verification")
    IncidentResponse returnVerification(@PathVariable UUID incidentId, @RequestBody ReasonVersionRequest request,
                                       Authentication authentication) {
        return incident(risk.returnIncidentVerification(incidentId,
                reasonVersion(request.version(), request.reason(), authentication)));
    }

    @PostMapping("/incidents/{incidentId}/reopen")
    IncidentResponse reopen(@PathVariable UUID incidentId, @RequestBody ReasonVersionRequest request, Authentication authentication) {
        return incident(risk.reopenIncident(incidentId, reasonVersion(request.version(), request.reason(), authentication)));
    }

    @GetMapping("/incidents")
    List<IncidentResponse> incidents(@org.springframework.web.bind.annotation.RequestParam UUID shiftId,
                                     Authentication authentication) {
        return risk.incidents(shiftId, read(authentication)).stream().map(this::incident).toList();
    }

    @PostMapping("/incidents/{incidentId}/waive-blocking")
    IncidentResponse waiveBlocking(@PathVariable UUID incidentId, @RequestBody ReasonVersionRequest request,
                                   Authentication authentication) {
        return incident(risk.waiveBlocking(incidentId, reasonVersion(request.version(), request.reason(), authentication)));
    }

    @PostMapping("/handovers")
    ResponseEntity<HandoverResponse> createHandover(@RequestBody CreateHandoverRequest request, Authentication authentication) {
        if (request.content() == null) {
            throw new IllegalArgumentException("Handover content is required.");
        }
        return ResponseEntity.status(HttpStatus.CREATED).body(handover(risk.createHandover(
                new OperationalRiskUseCase.CreateHandoverCommand(request.shiftId(), request.receivingShiftId(),
                        request.receivingAccountId(), request.requiredForClose(), request.content().toString(), actorId(authentication),
                        hasRole(authentication, "P3")))));
    }

    @PostMapping("/handovers/{handoverId}/submit")
    HandoverResponse submitHandover(@PathVariable UUID handoverId, @RequestBody VersionRequest request, Authentication authentication) {
        return handover(risk.submitHandover(handoverId, version(request.version(), authentication)));
    }

    @PostMapping("/handovers/{handoverId}/accept")
    HandoverResponse acceptHandover(@PathVariable UUID handoverId, @RequestBody VersionRequest request, Authentication authentication) {
        return handover(risk.acceptHandover(handoverId, version(request.version(), authentication)));
    }

    @PostMapping("/handovers/{handoverId}/return")
    HandoverResponse returnHandover(@PathVariable UUID handoverId, @RequestBody ReasonVersionRequest request,
                                    Authentication authentication) {
        return handover(risk.returnHandover(handoverId, reasonVersion(request.version(), request.reason(), authentication)));
    }

    @PostMapping("/handovers/{handoverId}/approve")
    HandoverResponse approveHandover(@PathVariable UUID handoverId, @RequestBody VersionRequest request,
                                     Authentication authentication) {
        return handover(risk.approveHandover(handoverId, version(request.version(), authentication)));
    }

    @PatchMapping("/handovers/{handoverId}")
    HandoverResponse updateHandover(@PathVariable UUID handoverId, @RequestBody UpdateHandoverRequest request,
                                    Authentication authentication) {
        if (request.content() == null) {
            throw new IllegalArgumentException("Handover content is required.");
        }
        return handover(risk.updateHandover(handoverId, new OperationalRiskUseCase.UpdateHandoverCommand(
                request.content().toString(), request.version(), actorId(authentication), hasRole(authentication, "P1"),
                hasRole(authentication, "P3"))));
    }

    @GetMapping("/handovers")
    List<HandoverResponse> handovers(@org.springframework.web.bind.annotation.RequestParam UUID shiftId,
                                     Authentication authentication) {
        return risk.handovers(shiftId, read(authentication)).stream().map(this::handover).toList();
    }

    private UUID actorId(Authentication authentication) {
        if (authentication.getPrincipal() instanceof AccessTokenPort.AuthenticatedToken token) {
            return token.accountId();
        }
        return UUID.fromString(authentication.getName());
    }

    private boolean hasRole(Authentication authentication, String role) {
        return authentication.getAuthorities().stream().anyMatch(authority -> authority.getAuthority().equals("ROLE_" + role));
    }

    private OperationalRiskUseCase.VersionCommand version(long version, Authentication authentication) {
        return new OperationalRiskUseCase.VersionCommand(version, actorId(authentication), hasRole(authentication, "P1"),
                hasRole(authentication, "P2"), hasRole(authentication, "P3"));
    }

    private OperationalRiskUseCase.ReasonVersionCommand reasonVersion(long version, String reason, Authentication authentication) {
        return new OperationalRiskUseCase.ReasonVersionCommand(version, reason, actorId(authentication),
                hasRole(authentication, "P1"), hasRole(authentication, "P2"), hasRole(authentication, "P3"));
    }

    private OperationalRiskUseCase.ReadCommand read(Authentication authentication) {
        return new OperationalRiskUseCase.ReadCommand(actorId(authentication), hasRole(authentication, "P1"),
                hasRole(authentication, "P2"), hasRole(authentication, "P3"));
    }

    private OperatingSummaryResponse summary(OperationalRiskRepository.OperatingSummary summary) {
        return new OperatingSummaryResponse(summary.id(), summary.shiftId(), summary.sourceSystem(), summary.collectionMethod(),
                summary.sourceReference(), summary.collectedAt(), json(summary.summaryDataJson()), summary.pendingSupplement(), summary.note(),
                summary.status().name(), summary.version(), summary.updatedAt());
    }

    private IncidentResponse incident(OperationalRiskRepository.Incident incident) {
        return new IncidentResponse(incident.id(), incident.shiftId(), incident.categoryCode(), incident.severity(), incident.blocking(),
                incident.description(), incident.status().name(), incident.assigneeAccountId(), incident.dueAt(),
                incident.controlMeasure(), incident.verificationEvidenceReference(), incident.version(), incident.updatedAt());
    }

    private HandoverResponse handover(OperationalRiskRepository.Handover handover) {
        return new HandoverResponse(handover.id(), handover.shiftId(), handover.receivingShiftId(), handover.receivingAccountId(),
                handover.requiredForClose(), json(handover.contentJson()), handover.status().name(), handover.version(), handover.updatedAt());
    }

    private JsonNode json(String value) {
        try {
            return objectMapper.readTree(value);
        } catch (Exception exception) {
            throw new IllegalStateException("Operational record JSON is invalid.");
        }
    }

    record CreateSummaryRequest(UUID shiftId, String sourceSystem, String collectionMethod, String sourceReference,
                                OffsetDateTime collectedAt, JsonNode summaryData, boolean pendingSupplement, String note) {
    }

    record UpdateSummaryRequest(JsonNode summaryData, boolean pendingSupplement, String note, long version) {
    }

    record CreateIncidentRequest(UUID shiftId, String categoryCode, String severity, boolean blocking, String description) {
    }

    record UpdateIncidentRequest(String categoryCode, String severity, boolean blocking, String description, long version) {
    }

    record AssignIncidentRequest(long version, UUID assigneeAccountId, OffsetDateTime dueAt, String controlMeasure) {
    }

    record VerificationRequest(long version, String evidenceReference) {
    }

    record CreateHandoverRequest(UUID shiftId, UUID receivingShiftId, UUID receivingAccountId, boolean requiredForClose,
                                 JsonNode content) {
    }

    record UpdateHandoverRequest(JsonNode content, long version) {
    }

    record VersionRequest(long version) {
    }

    record ReasonVersionRequest(long version, String reason) {
    }

    record OperatingSummaryResponse(UUID id, UUID shiftId, String sourceSystem, String collectionMethod, String sourceReference,
                                    OffsetDateTime collectedAt, JsonNode summaryData, boolean pendingSupplement, String note, String status,
                                    long version, OffsetDateTime updatedAt) {
    }

    record IncidentResponse(UUID id, UUID shiftId, String categoryCode, String severity, boolean blocking, String description,
                            String status, UUID assigneeAccountId, OffsetDateTime dueAt, String controlMeasure,
                            String verificationEvidenceReference, long version, OffsetDateTime updatedAt) {
    }

    record HandoverResponse(UUID id, UUID shiftId, UUID receivingShiftId, UUID receivingAccountId, boolean requiredForClose,
                            JsonNode content, String status, long version, OffsetDateTime updatedAt) {
    }
}
