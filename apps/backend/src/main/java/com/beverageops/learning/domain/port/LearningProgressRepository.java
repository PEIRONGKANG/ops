package com.beverageops.learning.domain.port;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.learning.domain.model.CertificationStatus;
import com.beverageops.learning.domain.model.RetrainingStatus;

public interface LearningProgressRepository {

    Optional<ShiftScope> findShiftScope(UUID shiftId);

    Optional<TaskReference> findTaskReference(UUID taskCompletionId);

    Optional<IncidentReference> findIncidentReference(UUID incidentId);

    Optional<EvidenceReference> findEvidenceReference(UUID evidenceId);

    Optional<TemplateScope> findPublishedTemplateScope(UUID templateVersionId);

    Optional<CertificationRule> findCertificationRule(UUID certificationRuleId);

    boolean isActiveStudent(UUID termId, UUID accountId);

    boolean hasScope(UUID accountId, String roleCode, UUID termId, UUID storeId);

    boolean isStudentAssignedToShift(UUID shiftId, UUID accountId);

    boolean isEvidenceOwnedBy(UUID evidenceId, UUID accountId);

    int countCertificationEvidence(UUID certificationId);

    Feedback createFeedback(UUID id, UUID termId, UUID storeId, UUID studentAccountId, UUID shiftId,
                            UUID taskCompletionId, UUID incidentId, UUID evidenceId, String observation,
                            String recommendation, boolean requiresRetraining, OffsetDateTime retrainingDueAt,
                            UUID actorId);

    Optional<Feedback> lockFeedback(UUID feedbackId);

    Feedback updateFeedback(UUID feedbackId, String observation, String recommendation, boolean requiresRetraining,
                            OffsetDateTime retrainingDueAt, long expectedVersion);

    List<Feedback> findFeedback(UUID termId, UUID storeId);

    List<Feedback> findFeedbackForStudent(UUID studentAccountId);

    void appendFeedbackHistory(UUID feedbackId, String eventType, UUID actorId, String reason,
                               Long previousVersion, long newVersion);

    Retraining createRetraining(UUID id, UUID feedbackId, UUID termId, UUID storeId, UUID studentAccountId,
                                OffsetDateTime dueAt, UUID actorId);

    Retraining updateRetrainingDueAt(UUID retrainingId, OffsetDateTime dueAt, long expectedVersion);

    Optional<Retraining> lockRetraining(UUID retrainingId);

    Optional<Retraining> findRetrainingByFeedback(UUID feedbackId);

    Retraining transitionRetraining(UUID retrainingId, RetrainingStatus expectedStatus, RetrainingStatus nextStatus,
                                   long expectedVersion);

    void linkRetrainingEvidence(UUID retrainingId, UUID evidenceId, UUID actorId);

    void appendRetrainingAction(UUID retrainingId, String eventType, UUID actorId, String reason,
                                RetrainingStatus previousStatus, RetrainingStatus nextStatus,
                                Long previousVersion, long newVersion);

    void appendRetrainingRetest(UUID retrainingId, boolean passed, String result, UUID actorId);

    List<Retraining> findRetrainingForStudent(UUID studentAccountId);

    List<Retraining> findRetraining(UUID termId, UUID storeId);

    Certification createCertification(UUID id, UUID termId, UUID storeId, UUID studentAccountId,
                                      UUID templateVersionId, UUID certificationRuleId, String ruleSnapshotJson,
                                      String note, UUID actorId);

    Certification updateCertificationNote(UUID certificationId, String note, long expectedVersion);

    Optional<Certification> lockCertification(UUID certificationId);

    Certification decideCertification(UUID certificationId, CertificationStatus nextStatus, long expectedVersion);

    void linkCertificationEvidence(UUID certificationId, UUID evidenceId, UUID actorId);

    void appendCertificationDecision(UUID certificationId, boolean approved, String reason, UUID actorId,
                                     UUID retrainingId, long previousVersion, long newVersion);

    void appendCertificationHistory(UUID certificationId, String eventType, UUID actorId, String reason,
                                    CertificationStatus previousStatus, CertificationStatus nextStatus,
                                    Long previousVersion, long newVersion);

    List<Certification> findCertificationsForStudent(UUID studentAccountId);

    List<Certification> findCertifications(UUID termId, UUID storeId);

    void appendAudit(String eventType, String resourceType, UUID resourceId, UUID actorId, String reason,
                     Long previousVersion, Long newVersion);

    record ShiftScope(UUID shiftId, UUID termId, UUID storeId) {
    }

    record TaskReference(UUID taskCompletionId, UUID shiftId, UUID studentAccountId) {
    }

    record IncidentReference(UUID incidentId, UUID shiftId, UUID reportedByAccountId, UUID assigneeAccountId) {
    }

    record EvidenceReference(UUID evidenceId, UUID shiftId, UUID submittedByAccountId, UUID taskStudentAccountId) {
    }

    record TemplateScope(UUID templateVersionId, UUID termId, UUID storeId, String status) {
    }

    record CertificationRule(UUID id, UUID templateVersionId, String code, String name, String configurationJson) {
    }

    record Feedback(UUID id, UUID termId, UUID storeId, UUID studentAccountId, UUID shiftId, UUID taskCompletionId,
                    UUID incidentId, UUID evidenceId, String observation, String recommendation,
                    boolean requiresRetraining, OffsetDateTime retrainingDueAt, String status, long version,
                    UUID createdByAccountId, OffsetDateTime createdAt, OffsetDateTime updatedAt) {
    }

    record Retraining(UUID id, UUID feedbackId, UUID termId, UUID storeId, UUID studentAccountId,
                      RetrainingStatus status, OffsetDateTime dueAt, long version, UUID createdByAccountId,
                      OffsetDateTime createdAt, OffsetDateTime updatedAt) {
    }

    record Certification(UUID id, UUID termId, UUID storeId, UUID studentAccountId, UUID templateVersionId,
                         UUID certificationRuleId, String ruleSnapshotJson, String note, CertificationStatus status,
                         long version, UUID createdByAccountId, OffsetDateTime createdAt, OffsetDateTime updatedAt) {
    }
}
