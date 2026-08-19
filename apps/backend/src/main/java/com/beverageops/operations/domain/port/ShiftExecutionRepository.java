package com.beverageops.operations.domain.port;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.operations.domain.model.EvidenceKind;
import com.beverageops.operations.domain.model.MilestoneDecision;
import com.beverageops.operations.domain.model.TaskCompletionStatus;

public interface ShiftExecutionRepository {

    List<TemplateComponent> findTemplateComponents(UUID templateVersionId, String componentType);

    List<AssignmentProjection> findActiveAssignments(UUID shiftId);

    void createTaskCompletion(UUID id, UUID shiftId, UUID assignmentId, UUID sourceTemplateComponentId, String code,
                              String name, String roleCode, String definitionSnapshotJson, boolean evidenceRequired,
                              boolean p2AcceptanceRequired);

    void createMilestoneSubmission(UUID id, UUID shiftId, UUID sourceTemplateComponentId, String code, String name,
                                   String definitionSnapshotJson, boolean required, boolean evidenceRequired);

    List<TaskCompletion> findTaskCompletions(UUID shiftId);

    Optional<TaskCompletion> lockTaskCompletion(UUID taskCompletionId);

    TaskCompletion transitionTaskCompletion(UUID taskCompletionId, TaskCompletionStatus expectedStatus,
                                            TaskCompletionStatus nextStatus, long expectedVersion);

    void appendTaskHistory(UUID taskCompletionId, String eventType, UUID actorId, String reason,
                           TaskCompletionStatus previousStatus, TaskCompletionStatus nextStatus, long previousVersion,
                           long newVersion);

    List<MilestoneSubmission> findMilestoneSubmissions(UUID shiftId);

    Optional<MilestoneSubmission> lockMilestoneSubmission(UUID milestoneSubmissionId);

    MilestoneSubmission transitionMilestone(UUID milestoneSubmissionId, MilestoneDecision expectedStatus,
                                            MilestoneDecision nextStatus, UUID submittedByAccountId, long expectedVersion);

    void appendMilestoneDecision(UUID milestoneSubmissionId, MilestoneDecision decision, UUID actorId, String reason,
                                 MilestoneDecision previousStatus, MilestoneDecision nextStatus, long previousVersion,
                                 long newVersion);

    Evidence createEvidence(UUID id, UUID shiftId, UUID taskCompletionId, UUID milestoneSubmissionId, EvidenceKind kind,
                            String textContent, String externalUrl, String referenceValue, OffsetDateTime occurredAt,
                            UUID submittedByAccountId);

    boolean hasEvidenceForTask(UUID taskCompletionId);

    boolean hasEvidenceForMilestone(UUID milestoneSubmissionId);

    boolean hasUnapprovedRequiredMilestones(UUID shiftId);

    record TemplateComponent(UUID id, String code, String name, String configurationJson) {
    }

    record AssignmentProjection(UUID id, UUID accountId, String roleCode) {
    }

    record TaskCompletion(UUID id, UUID shiftId, UUID assignmentId, UUID accountId, String code, String name, String roleCode,
                          boolean evidenceRequired, boolean p2AcceptanceRequired, TaskCompletionStatus status, long version,
                          OffsetDateTime updatedAt) {
    }

    record MilestoneSubmission(UUID id, UUID shiftId, String code, String name, boolean required, boolean evidenceRequired,
                               MilestoneDecision status, UUID submittedByAccountId, long version, OffsetDateTime updatedAt) {
    }

    record Evidence(UUID id, UUID shiftId, UUID taskCompletionId, UUID milestoneSubmissionId, EvidenceKind kind,
                    OffsetDateTime occurredAt, UUID submittedByAccountId, long version, OffsetDateTime updatedAt) {
    }
}
