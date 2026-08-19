package com.beverageops.learning.adapter.in.web;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.beverageops.identityaccess.domain.port.AccessTokenPort;
import com.beverageops.learning.application.usecase.LearningProgressUseCase;
import com.beverageops.learning.domain.port.LearningProgressRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
class LearningProgressController {

    private final LearningProgressUseCase learning;
    private final ObjectMapper objectMapper;

    LearningProgressController(LearningProgressUseCase learning, ObjectMapper objectMapper) {
        this.learning = learning;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/feedback")
    ResponseEntity<FeedbackResponse> createFeedback(@RequestBody CreateFeedbackRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(feedback(learning.createFeedback(
                new LearningProgressUseCase.CreateFeedbackCommand(request.studentAccountId(), request.shiftId(),
                        request.taskCompletionId(), request.incidentId(), request.evidenceId(), request.observation(),
                        request.recommendation(), request.requiresRetraining(), request.retrainingDueAt(), actorId(authentication),
                        hasRole(authentication, "P1"), hasRole(authentication, "T1")))));
    }

    @PatchMapping("/feedback/{feedbackId}")
    FeedbackResponse updateFeedback(@PathVariable UUID feedbackId, @RequestBody UpdateFeedbackRequest request,
                                    Authentication authentication) {
        return feedback(learning.updateFeedback(feedbackId, new LearningProgressUseCase.UpdateFeedbackCommand(
                request.observation(), request.recommendation(), request.requiresRetraining(), request.retrainingDueAt(),
                request.version(), actorId(authentication), hasRole(authentication, "P1"), hasRole(authentication, "T1"))));
    }

    @GetMapping("/feedback")
    List<FeedbackResponse> feedback(@RequestParam UUID termId, @RequestParam UUID storeId, Authentication authentication) {
        return learning.feedback(termId, storeId, read(authentication)).stream().map(this::feedback).toList();
    }

    @GetMapping("/me/feedback")
    List<FeedbackResponse> myFeedback(Authentication authentication) {
        return learning.myFeedback(actorId(authentication), hasRole(authentication, "P3")).stream().map(this::feedback).toList();
    }

    @PostMapping("/retraining")
    ResponseEntity<RetrainingResponse> createRetraining(@RequestBody CreateRetrainingRequest request,
                                                        Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(retraining(learning.createRetraining(
                new LearningProgressUseCase.CreateRetrainingCommand(request.feedbackId(), request.dueAt(),
                        actorId(authentication), hasRole(authentication, "P1"), hasRole(authentication, "T1")))));
    }

    @PatchMapping("/retraining/{retrainingId}")
    RetrainingResponse updateRetraining(@PathVariable UUID retrainingId, @RequestBody UpdateRetrainingRequest request,
                                        Authentication authentication) {
        return retraining(learning.updateRetraining(retrainingId, new LearningProgressUseCase.UpdateRetrainingCommand(
                request.dueAt(), request.version(), actorId(authentication), hasRole(authentication, "P1"),
                hasRole(authentication, "T1"))));
    }

    @PostMapping("/retraining/{retrainingId}/submit")
    RetrainingResponse submitRetraining(@PathVariable UUID retrainingId, @RequestBody SubmitRetrainingRequest request,
                                        Authentication authentication) {
        return retraining(learning.submitRetraining(retrainingId, new LearningProgressUseCase.SubmitRetrainingCommand(
                request.version(), request.evidenceIds(), actorId(authentication), hasRole(authentication, "P3"))));
    }

    @PostMapping("/retraining/{retrainingId}/request-retest")
    RetrainingResponse requestRetest(@PathVariable UUID retrainingId, @RequestBody ReasonVersionRequest request,
                                     Authentication authentication) {
        return retraining(learning.requestRetest(retrainingId, reasonVersion(request.version(), request.reason(), authentication)));
    }

    @PostMapping("/retraining/{retrainingId}/record-retest")
    RetrainingResponse recordRetest(@PathVariable UUID retrainingId, @RequestBody RetestRequest request,
                                    Authentication authentication) {
        return retraining(learning.recordRetest(retrainingId, new LearningProgressUseCase.RetestCommand(request.version(),
                request.passed(), request.result(), actorId(authentication), hasRole(authentication, "P1"),
                hasRole(authentication, "T1"))));
    }

    @GetMapping("/retraining")
    List<RetrainingResponse> retraining(@RequestParam(required = false) UUID termId,
                                        @RequestParam(required = false) UUID storeId, Authentication authentication) {
        if (!hasRole(authentication, "P3") && (termId == null || storeId == null)) {
            throw new IllegalArgumentException("Term and store are required for staff retraining queries.");
        }
        return learning.retraining(termId, storeId, read(authentication)).stream().map(this::retraining).toList();
    }

    @PostMapping("/certifications")
    ResponseEntity<CertificationResponse> createCertification(@RequestBody CreateCertificationRequest request,
                                                               Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(certification(learning.createCertification(
                new LearningProgressUseCase.CreateCertificationCommand(request.studentAccountId(), request.templateVersionId(),
                        request.certificationRuleId(), request.note(), actorId(authentication), hasRole(authentication, "P1"),
                        hasRole(authentication, "T1")))));
    }

    @PostMapping("/certifications/{certificationId}/decide")
    CertificationResponse decideCertification(@PathVariable UUID certificationId, @RequestBody DecideCertificationRequest request,
                                              Authentication authentication) {
        return certification(learning.decideCertification(certificationId, new LearningProgressUseCase.DecideCertificationCommand(
                request.version(), request.approved(), request.reason(), request.evidenceIds(), request.retrainingId(),
                actorId(authentication), hasRole(authentication, "P1"), hasRole(authentication, "P2"),
                hasRole(authentication, "T1"))));
    }

    @PatchMapping("/certifications/{certificationId}")
    CertificationResponse updateCertification(@PathVariable UUID certificationId,
                                               @RequestBody UpdateCertificationRequest request,
                                               Authentication authentication) {
        return certification(learning.updateCertification(certificationId,
                new LearningProgressUseCase.UpdateCertificationCommand(request.note(), request.version(), actorId(authentication),
                        hasRole(authentication, "P1"), hasRole(authentication, "T1"))));
    }

    @GetMapping("/certifications")
    List<CertificationResponse> certifications(@RequestParam(required = false) UUID termId,
                                               @RequestParam(required = false) UUID storeId, Authentication authentication) {
        if (!hasRole(authentication, "P3") && (termId == null || storeId == null)) {
            throw new IllegalArgumentException("Term and store are required for staff certification queries.");
        }
        return learning.certifications(termId, storeId, read(authentication)).stream().map(this::certification).toList();
    }

    @GetMapping("/me/learning-growth")
    LearningGrowthResponse learningGrowth(Authentication authentication) {
        var growth = learning.learningGrowth(actorId(authentication), hasRole(authentication, "P3"));
        return new LearningGrowthResponse(growth.feedback().stream().map(this::feedback).toList(),
                growth.retraining().stream().map(this::retraining).toList(),
                growth.certifications().stream().map(this::certification).toList(),
                growth.openActions().stream().map(action -> new OpenActionResponse(action.actionType(), action.resourceId(),
                        action.status(), action.dueAt())).toList());
    }

    private LearningProgressUseCase.ReasonVersionCommand reasonVersion(long version, String reason, Authentication authentication) {
        return new LearningProgressUseCase.ReasonVersionCommand(version, reason, actorId(authentication),
                hasRole(authentication, "P1"), hasRole(authentication, "T1"));
    }

    private LearningProgressUseCase.ReadCommand read(Authentication authentication) {
        return new LearningProgressUseCase.ReadCommand(actorId(authentication), hasRole(authentication, "P1"),
                hasRole(authentication, "T1"), hasRole(authentication, "P3"));
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

    private FeedbackResponse feedback(LearningProgressRepository.Feedback feedback) {
        return new FeedbackResponse(feedback.id(), feedback.termId(), feedback.storeId(), feedback.studentAccountId(),
                feedback.shiftId(), feedback.taskCompletionId(), feedback.incidentId(), feedback.evidenceId(), feedback.observation(),
                feedback.recommendation(), feedback.requiresRetraining(), feedback.retrainingDueAt(), feedback.status(),
                feedback.version(), feedback.createdAt(), feedback.updatedAt());
    }

    private RetrainingResponse retraining(LearningProgressRepository.Retraining retraining) {
        return new RetrainingResponse(retraining.id(), retraining.feedbackId(), retraining.termId(), retraining.storeId(),
                retraining.studentAccountId(), retraining.status().name(), retraining.dueAt(), retraining.version(),
                retraining.createdAt(), retraining.updatedAt());
    }

    private CertificationResponse certification(LearningProgressRepository.Certification certification) {
        return new CertificationResponse(certification.id(), certification.termId(), certification.storeId(),
                certification.studentAccountId(), certification.templateVersionId(), certification.certificationRuleId(),
                json(certification.ruleSnapshotJson()), certification.note(), certification.status().name(), certification.version(),
                certification.createdAt(), certification.updatedAt());
    }

    private JsonNode json(String value) {
        try {
            return objectMapper.readTree(value);
        } catch (Exception exception) {
            throw new IllegalStateException("Learning record JSON is invalid.");
        }
    }

    record CreateFeedbackRequest(UUID studentAccountId, UUID shiftId, UUID taskCompletionId, UUID incidentId, UUID evidenceId,
                                 String observation, String recommendation, boolean requiresRetraining,
                                 OffsetDateTime retrainingDueAt) {
    }

    record UpdateFeedbackRequest(String observation, String recommendation, boolean requiresRetraining,
                                 OffsetDateTime retrainingDueAt, long version) {
    }

    record SubmitRetrainingRequest(long version, List<UUID> evidenceIds) {
    }

    record CreateRetrainingRequest(UUID feedbackId, OffsetDateTime dueAt) {
    }

    record UpdateRetrainingRequest(OffsetDateTime dueAt, long version) {
    }

    record ReasonVersionRequest(long version, String reason) {
    }

    record RetestRequest(long version, boolean passed, String result) {
    }

    record CreateCertificationRequest(UUID studentAccountId, UUID templateVersionId, UUID certificationRuleId, String note) {
    }

    record UpdateCertificationRequest(String note, long version) {
    }

    record DecideCertificationRequest(long version, boolean approved, String reason, List<UUID> evidenceIds,
                                      UUID retrainingId) {
    }

    record FeedbackResponse(UUID id, UUID termId, UUID storeId, UUID studentAccountId, UUID shiftId, UUID taskCompletionId,
                            UUID incidentId, UUID evidenceId, String observation, String recommendation,
                            boolean requiresRetraining, OffsetDateTime retrainingDueAt, String status, long version,
                            OffsetDateTime createdAt, OffsetDateTime updatedAt) {
    }

    record RetrainingResponse(UUID id, UUID feedbackId, UUID termId, UUID storeId, UUID studentAccountId, String status,
                              OffsetDateTime dueAt, long version, OffsetDateTime createdAt, OffsetDateTime updatedAt) {
    }

    record CertificationResponse(UUID id, UUID termId, UUID storeId, UUID studentAccountId, UUID templateVersionId,
                                 UUID certificationRuleId, JsonNode ruleSnapshot, String note, String status, long version,
                                 OffsetDateTime createdAt, OffsetDateTime updatedAt) {
    }

    record OpenActionResponse(String actionType, UUID resourceId, String status, OffsetDateTime dueAt) {
    }

    record LearningGrowthResponse(List<FeedbackResponse> feedback, List<RetrainingResponse> retraining,
                                  List<CertificationResponse> certifications, List<OpenActionResponse> openActions) {
    }
}
