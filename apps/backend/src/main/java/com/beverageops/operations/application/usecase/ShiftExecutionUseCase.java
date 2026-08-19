package com.beverageops.operations.application.usecase;

import java.time.OffsetDateTime;
import java.time.Clock;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import com.beverageops.governance.application.usecase.VersionConflictException;
import com.beverageops.identityaccess.application.usecase.ForbiddenException;
import com.beverageops.identityaccess.application.usecase.ResourceNotFoundException;
import com.beverageops.operations.domain.model.EvidenceKind;
import com.beverageops.operations.domain.model.EvidenceFileStatus;
import com.beverageops.operations.domain.model.MilestoneDecision;
import com.beverageops.operations.domain.model.ShiftStatus;
import com.beverageops.operations.domain.model.TaskCompletionStatus;
import com.beverageops.operations.domain.port.OperationsSchedulingRepository;
import com.beverageops.operations.domain.port.EvidenceMediaStoragePort;
import com.beverageops.operations.domain.port.ShiftExecutionRepository;
import com.beverageops.shared.notification.application.event.OperationalNotificationRequested;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ShiftExecutionUseCase {

    private final OperationsSchedulingRepository scheduling;
    private final ShiftExecutionRepository execution;
    private final ApplicationEventPublisher events;
    private final EvidenceMediaStoragePort mediaStorage;
    private final Clock clock;

    @Autowired
    public ShiftExecutionUseCase(OperationsSchedulingRepository scheduling, ShiftExecutionRepository execution,
                                 ApplicationEventPublisher events, EvidenceMediaStoragePort mediaStorage) {
        this(scheduling, execution, events, mediaStorage, Clock.systemUTC());
    }

    ShiftExecutionUseCase(OperationsSchedulingRepository scheduling, ShiftExecutionRepository execution,
                          ApplicationEventPublisher events, EvidenceMediaStoragePort mediaStorage, Clock clock) {
        this.scheduling = scheduling;
        this.execution = execution;
        this.events = events;
        this.mediaStorage = mediaStorage;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<ShiftExecutionRepository.TaskCompletion> tasks(UUID shiftId, UUID actorId, boolean p1, boolean p2, boolean p3) {
        var shift = shift(shiftId);
        if (p1 || (p2 && hasP2Scope(actorId, shift))) {
            return execution.findTaskCompletions(shiftId);
        }
        requireAssignedP3(actorId, shiftId, p3);
        return execution.findTaskCompletions(shiftId).stream()
                .filter(task -> task.accountId().equals(actorId))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ShiftExecutionRepository.MilestoneSubmission> milestones(UUID shiftId, UUID actorId, boolean p1, boolean p2,
                                                                           boolean p3) {
        var shift = shift(shiftId);
        if (p1 || (p2 && hasP2Scope(actorId, shift))) {
            return execution.findMilestoneSubmissions(shiftId);
        }
        requireAssignedP3(actorId, shiftId, p3);
        return execution.findMilestoneSubmissions(shiftId);
    }

    @Transactional
    public ShiftExecutionRepository.TaskCompletion submitTask(UUID taskCompletionId, VersionCommand command) {
        var task = lockTask(taskCompletionId);
        requireAssignedP3(command.actorId(), task.shiftId(), command.p3());
        if (!task.accountId().equals(command.actorId())) {
            throw new ForbiddenException("Only the assigned student can submit this task.");
        }
        requireShiftExecutionOpen(task.shiftId());
        if (task.evidenceRequired() && !execution.hasEvidenceForTask(task.id())) {
            throw new EvidenceRequiredException("Evidence is required before this task can be submitted.");
        }
        if (task.status() != TaskCompletionStatus.PENDING && task.status() != TaskCompletionStatus.RETURNED) {
            throw new IllegalStateException("The task is not available for submission.");
        }
        return transitionTask(task, TaskCompletionStatus.SUBMITTED, command.version(), command.actorId(), null,
                "TASK_COMPLETION_SUBMITTED");
    }

    @Transactional
    public ShiftExecutionRepository.TaskCompletion returnTask(UUID taskCompletionId, ReasonVersionCommand command) {
        var task = lockTask(taskCompletionId);
        requireP2Scope(command.actorId(), command.p1(), command.p2(), task.shiftId());
        var updated = transitionTask(task, TaskCompletionStatus.RETURNED, command.version(), command.actorId(),
                requiredText(command.reason(), "Return reason", 500), "TASK_COMPLETION_RETURNED");
        notify(task.accountId(), "TASK_COMPLETION_RETURNED", "TASK_COMPLETION", task.id(), "当班任务需补充",
                "你的任务被退回，请补充后重新提交。", command.actorId());
        return updated;
    }

    @Transactional
    public ShiftExecutionRepository.TaskCompletion acceptTask(UUID taskCompletionId, VersionCommand command) {
        var task = lockTask(taskCompletionId);
        requireP2Scope(command.actorId(), command.p1(), command.p2(), task.shiftId());
        return transitionTask(task, TaskCompletionStatus.ACCEPTED, command.version(), command.actorId(), null,
                "TASK_COMPLETION_ACCEPTED");
    }

    @Transactional
    public ShiftExecutionRepository.TaskCompletion withdrawTask(UUID taskCompletionId, ReasonVersionCommand command) {
        var task = lockTask(taskCompletionId);
        requireAssignedP3(command.actorId(), task.shiftId(), command.p3());
        if (!task.accountId().equals(command.actorId())) {
            throw new ForbiddenException("Only the assigned student can withdraw this task.");
        }
        if (task.status() != TaskCompletionStatus.PENDING && task.status() != TaskCompletionStatus.RETURNED
                && task.status() != TaskCompletionStatus.SUBMITTED) {
            throw new IllegalStateException("The task cannot be withdrawn from its current state.");
        }
        return transitionTask(task, TaskCompletionStatus.WITHDRAWN, command.version(), command.actorId(),
                requiredText(command.reason(), "Withdrawal reason", 500), "TASK_COMPLETION_WITHDRAWN");
    }

    @Transactional
    public ShiftExecutionRepository.MilestoneSubmission submitMilestone(UUID milestoneSubmissionId, VersionCommand command) {
        var milestone = lockMilestone(milestoneSubmissionId);
        requireAssignedP3(command.actorId(), milestone.shiftId(), command.p3());
        requireShiftExecutionOpen(milestone.shiftId());
        if (milestone.evidenceRequired() && !execution.hasEvidenceForMilestone(milestone.id())) {
            throw new EvidenceRequiredException("Evidence is required before this milestone can be submitted.");
        }
        if (milestone.status() != MilestoneDecision.PENDING && milestone.status() != MilestoneDecision.RETURNED) {
            throw new IllegalStateException("The milestone is not available for submission.");
        }
        return transitionMilestone(milestone, MilestoneDecision.SUBMITTED, command.version(), command.actorId(), null,
                "MILESTONE_SUBMITTED", command.actorId());
    }

    @Transactional
    public ShiftExecutionRepository.MilestoneSubmission approveMilestone(UUID milestoneSubmissionId, VersionCommand command) {
        var milestone = lockMilestone(milestoneSubmissionId);
        requireP2Scope(command.actorId(), command.p1(), command.p2(), milestone.shiftId());
        return transitionMilestone(milestone, MilestoneDecision.APPROVED, command.version(), command.actorId(), null,
                "MILESTONE_APPROVED", null);
    }

    @Transactional
    public ShiftExecutionRepository.MilestoneSubmission returnMilestone(UUID milestoneSubmissionId, ReasonVersionCommand command) {
        var milestone = lockMilestone(milestoneSubmissionId);
        requireP2Scope(command.actorId(), command.p1(), command.p2(), milestone.shiftId());
        return transitionMilestone(milestone, MilestoneDecision.RETURNED, command.version(), command.actorId(),
                requiredText(command.reason(), "Return reason", 500), "MILESTONE_RETURNED", null);
    }

    @Transactional
    public ShiftExecutionRepository.Evidence createEvidence(CreateEvidenceCommand command) {
        if ((command.taskCompletionId() == null) == (command.milestoneSubmissionId() == null)) {
            throw new IllegalArgumentException("Evidence must target exactly one task completion or milestone submission.");
        }
        var kind = evidenceKind(command.kind());
        if (command.occurredAt() == null) {
            throw new IllegalArgumentException("Evidence occurrence time is required.");
        }
        UUID shiftId;
        if (command.taskCompletionId() != null) {
            var task = lockTask(command.taskCompletionId());
            shiftId = task.shiftId();
            requireEvidenceAuthorised(command.actorId(), command.p1(), command.p2(), command.p3(), shift(shiftId), task.accountId());
        } else {
            var milestone = lockMilestone(command.milestoneSubmissionId());
            shiftId = milestone.shiftId();
            requireEvidenceAuthorised(command.actorId(), command.p1(), command.p2(), command.p3(), shift(shiftId), null);
        }
        var evidence = execution.createEvidence(UUID.randomUUID(), shiftId, command.taskCompletionId(), command.milestoneSubmissionId(),
                kind, evidenceText(kind, command.textContent()), evidenceUrl(kind, command.externalUrl()),
                evidenceReference(kind, command.referenceValue()), command.occurredAt(), command.actorId());
        audit("EVIDENCE_CREATED", "EVIDENCE", evidence.id(), command.actorId(), null, null, evidence.version());
        return evidence;
    }

    @Transactional
    public ShiftExecutionRepository.EvidenceFileVersion uploadEvidenceFile(UUID evidenceId, EvidenceFileUploadCommand command) {
        var evidence = lockEvidence(evidenceId);
        requireObjectReference(evidence);
        requireEvidenceAuthorised(command.actorId(), command.p1(), command.p2(), command.p3(), shift(evidence.shiftId()),
                evidenceTaskOwner(evidence));
        if (execution.lockCurrentEvidenceFileVersion(evidenceId).isPresent()) {
            throw new IllegalStateException("The evidence already has a current file. Use replacement instead.");
        }
        var stored = mediaStorage.stageAndPublish(new EvidenceMediaStoragePort.Upload(evidenceId,
                execution.nextEvidenceFileVersion(evidenceId), command.originalFilename(), command.declaredMimeType(),
                command.content()));
        try {
            var created = execution.insertCurrentEvidenceFileVersion(newFileVersion(evidenceId, stored,
                    command.declaredMimeType(), command.actorId()));
            audit("EVIDENCE_FILE_UPLOADED", "EVIDENCE_FILE", created.id(), command.actorId(), null, null, null);
            return created;
        } catch (RuntimeException exception) {
            mediaStorage.delete(stored.relativePath());
            throw exception;
        }
    }

    @Transactional
    public ShiftExecutionRepository.EvidenceFileVersion replaceEvidenceFile(UUID evidenceId, String reason,
                                                                              EvidenceFileUploadCommand command) {
        var evidence = lockEvidence(evidenceId);
        requireObjectReference(evidence);
        requireEvidenceAuthorised(command.actorId(), command.p1(), command.p2(), command.p3(), shift(evidence.shiftId()),
                evidenceTaskOwner(evidence));
        var current = currentEvidenceFile(evidenceId);
        var replacementReason = requiredText(reason, "Replacement reason", 500);
        var newVersion = execution.nextEvidenceFileVersion(evidenceId);
        var stored = mediaStorage.stageAndPublish(new EvidenceMediaStoragePort.Upload(evidenceId, newVersion,
                command.originalFilename(), command.declaredMimeType(), command.content()));
        try {
            execution.replaceCurrentEvidenceFileVersion(evidenceId, command.actorId(), replacementReason, purgeAfter());
            var replacement = execution.insertCurrentEvidenceFileVersion(newFileVersion(evidenceId, stored,
                    command.declaredMimeType(), command.actorId()));
            audit("EVIDENCE_FILE_REPLACED", "EVIDENCE_FILE", replacement.id(), command.actorId(), replacementReason,
                    current.fileVersion(), replacement.fileVersion());
            return replacement;
        } catch (RuntimeException exception) {
            mediaStorage.delete(stored.relativePath());
            throw exception;
        }
    }

    @Transactional
    public ShiftExecutionRepository.EvidenceFileVersion withdrawEvidenceFile(UUID evidenceId, String reason,
                                                                               EvidenceFileActor actor) {
        var evidence = lockEvidence(evidenceId);
        requireObjectReference(evidence);
        requireEvidenceAuthorised(actor.actorId(), actor.p1(), actor.p2(), actor.p3(), shift(evidence.shiftId()),
                evidenceTaskOwner(evidence));
        var current = currentEvidenceFile(evidenceId);
        var withdrawalReason = requiredText(reason, "Withdrawal reason", 500);
        var withdrawn = execution.withdrawCurrentEvidenceFileVersion(evidenceId, actor.actorId(), withdrawalReason, purgeAfter());
        audit("EVIDENCE_FILE_WITHDRAWN", "EVIDENCE_FILE", current.id(), actor.actorId(), withdrawalReason,
                current.fileVersion(), withdrawn.fileVersion());
        return withdrawn;
    }

    @Transactional(readOnly = true)
    public List<ShiftExecutionRepository.EvidenceFileVersion> evidenceFiles(UUID evidenceId, EvidenceFileActor actor) {
        var evidence = findEvidence(evidenceId);
        requireEvidenceAuthorised(actor.actorId(), actor.p1(), actor.p2(), actor.p3(), shift(evidence.shiftId()),
                evidenceTaskOwner(evidence));
        return execution.findEvidenceFileVersions(evidenceId);
    }

    @Transactional
    public ShiftExecutionRepository.EvidenceFileVersion currentEvidenceFileForRead(UUID evidenceId, EvidenceFileActor actor) {
        var evidence = findEvidence(evidenceId);
        requireEvidenceAuthorised(actor.actorId(), actor.p1(), actor.p2(), actor.p3(), shift(evidence.shiftId()),
                evidenceTaskOwner(evidence));
        var current = findCurrentEvidenceFile(evidenceId);
        audit("EVIDENCE_FILE_ACCESSED", "EVIDENCE_FILE", current.id(), actor.actorId(), null, null, null);
        return current;
    }

    private ShiftExecutionRepository.TaskCompletion transitionTask(ShiftExecutionRepository.TaskCompletion task,
                                                                    TaskCompletionStatus next, long expectedVersion,
                                                                    UUID actorId, String reason, String eventType) {
        requireVersion(task.version(), expectedVersion);
        var updated = execution.transitionTaskCompletion(task.id(), task.status(), next, expectedVersion);
        execution.appendTaskHistory(task.id(), eventType, actorId, reason, task.status(), next, task.version(), updated.version());
        audit(eventType, "TASK_COMPLETION", task.id(), actorId, reason, task.version(), updated.version());
        return updated;
    }

    private ShiftExecutionRepository.MilestoneSubmission transitionMilestone(
            ShiftExecutionRepository.MilestoneSubmission milestone, MilestoneDecision next, long expectedVersion, UUID actorId,
            String reason, String eventType, UUID submittedByAccountId) {
        requireVersion(milestone.version(), expectedVersion);
        var updated = execution.transitionMilestone(milestone.id(), milestone.status(), next, submittedByAccountId, expectedVersion);
        execution.appendMilestoneDecision(milestone.id(), next, actorId, reason, milestone.status(), next, milestone.version(),
                updated.version());
        audit(eventType, "MILESTONE_SUBMISSION", milestone.id(), actorId, reason, milestone.version(), updated.version());
        return updated;
    }

    private ShiftExecutionRepository.NewEvidenceFileVersion newFileVersion(UUID evidenceId,
                                                                             EvidenceMediaStoragePort.StoredEvidenceFile stored,
                                                                             String declaredMimeType, UUID actorId) {
        var fileVersion = fileVersion(stored.relativePath());
        return new ShiftExecutionRepository.NewEvidenceFileVersion(UUID.randomUUID(), evidenceId, fileVersion,
                stored.relativePath(), stored.originalFilename(), stored.mediaType(), declaredMimeType,
                stored.detectedMimeType(), stored.byteSize(), stored.sha256(), actorId);
    }

    private long fileVersion(String relativePath) {
        var segment = relativePath.split("/")[2];
        if (!segment.startsWith("v")) {
            throw new IllegalStateException("Stored evidence path does not include a version.");
        }
        return Long.parseLong(segment.substring(1));
    }

    private OffsetDateTime purgeAfter() {
        return OffsetDateTime.ofInstant(clock.instant().plusSeconds(3 * 24 * 60 * 60), clock.getZone());
    }

    private void requireObjectReference(ShiftExecutionRepository.Evidence evidence) {
        if (evidence.kind() != EvidenceKind.OBJECT_REFERENCE) {
            throw new IllegalStateException("Evidence files are only supported for OBJECT_REFERENCE evidence.");
        }
    }

    private ShiftExecutionRepository.EvidenceFileVersion currentEvidenceFile(UUID evidenceId) {
        return execution.lockCurrentEvidenceFileVersion(evidenceId)
                .orElseThrow(() -> new EvidenceFileNotCurrentException("The evidence does not have a current file."));
    }

    private ShiftExecutionRepository.EvidenceFileVersion findCurrentEvidenceFile(UUID evidenceId) {
        return execution.findCurrentEvidenceFileVersion(evidenceId)
                .orElseThrow(() -> new EvidenceFileNotCurrentException("The evidence does not have a current file."));
    }

    private UUID evidenceTaskOwner(ShiftExecutionRepository.Evidence evidence) {
        if (evidence.taskCompletionId() == null) {
            return null;
        }
        return lockTask(evidence.taskCompletionId()).accountId();
    }

    private void requireEvidenceAuthorised(UUID actorId, boolean p1, boolean p2, boolean p3,
                                           OperationsSchedulingRepository.Shift shift, UUID taskOwnerId) {
        if (p1 || (p2 && hasP2Scope(actorId, shift))) {
            return;
        }
        requireAssignedP3(actorId, shift.id(), p3);
        if (taskOwnerId != null && !taskOwnerId.equals(actorId)) {
            throw new ForbiddenException("Only the assigned student can add evidence to this task.");
        }
    }

    private void requireP2Scope(UUID actorId, boolean p1, boolean p2, UUID shiftId) {
        if (p1) {
            return;
        }
        if (!p2 || !hasP2Scope(actorId, shift(shiftId))) {
            throw new ForbiddenException("You do not have P2 scope for this term and store.");
        }
    }

    private boolean hasP2Scope(UUID actorId, OperationsSchedulingRepository.Shift shift) {
        return scheduling.hasScope(actorId, "P2", shift.termId(), shift.storeId());
    }

    private void requireAssignedP3(UUID actorId, UUID shiftId, boolean p3) {
        if (!p3 || !scheduling.isAssignedToShift(actorId, shiftId)) {
            throw new ForbiddenException("Only an assigned student can perform this operation.");
        }
    }

    private void requireShiftExecutionOpen(UUID shiftId) {
        var status = shift(shiftId).status();
        if (status != ShiftStatus.IN_PROGRESS && status != ShiftStatus.KEY_APPROVAL_PENDING) {
            throw new IllegalStateException("The shift is not open for execution.");
        }
    }

    private OperationsSchedulingRepository.Shift shift(UUID shiftId) {
        return scheduling.findShift(shiftId).orElseThrow(() -> new ResourceNotFoundException("Shift not found."));
    }

    private ShiftExecutionRepository.TaskCompletion lockTask(UUID id) {
        return execution.lockTaskCompletion(id).orElseThrow(() -> new ResourceNotFoundException("Task completion not found."));
    }

    private ShiftExecutionRepository.MilestoneSubmission lockMilestone(UUID id) {
        return execution.lockMilestoneSubmission(id)
                .orElseThrow(() -> new ResourceNotFoundException("Milestone submission not found."));
    }

    private ShiftExecutionRepository.Evidence lockEvidence(UUID id) {
        return execution.lockEvidence(id).orElseThrow(() -> new ResourceNotFoundException("Evidence not found."));
    }

    private ShiftExecutionRepository.Evidence findEvidence(UUID id) {
        return execution.findEvidence(id).orElseThrow(() -> new ResourceNotFoundException("Evidence not found."));
    }

    private EvidenceKind evidenceKind(String value) {
        try {
            return EvidenceKind.valueOf(requiredText(value, "Evidence kind", 32).toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("Unsupported evidence kind.");
        }
    }

    private String evidenceText(EvidenceKind kind, String value) {
        return kind == EvidenceKind.TEXT ? requiredText(value, "Text evidence", 4000) : null;
    }

    private String evidenceUrl(EvidenceKind kind, String value) {
        if (kind != EvidenceKind.EXTERNAL_LINK) {
            return null;
        }
        var url = requiredText(value, "External evidence URL", 2048);
        if (!url.startsWith("https://") && !url.startsWith("http://")) {
            throw new IllegalArgumentException("External evidence URL must use HTTP or HTTPS.");
        }
        return url;
    }

    private String evidenceReference(EvidenceKind kind, String value) {
        return kind == EvidenceKind.OPERATING_SUMMARY_REFERENCE || kind == EvidenceKind.OBJECT_REFERENCE
                ? requiredText(value, "Evidence reference", 1024) : null;
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

    private String requiredText(String value, String field, int maxLength) {
        if (value == null || value.trim().isEmpty() || value.trim().length() > maxLength) {
            throw new IllegalArgumentException(field + " must contain 1 to " + maxLength + " characters.");
        }
        return value.trim();
    }

    public record VersionCommand(long version, UUID actorId, boolean p1, boolean p2, boolean p3) {
    }

    public record ReasonVersionCommand(long version, String reason, UUID actorId, boolean p1, boolean p2, boolean p3) {
    }

    public record CreateEvidenceCommand(UUID taskCompletionId, UUID milestoneSubmissionId, String kind, String textContent,
                                        String externalUrl, String referenceValue, OffsetDateTime occurredAt, UUID actorId,
                                        boolean p1, boolean p2, boolean p3) {
    }

    public record EvidenceFileUploadCommand(String originalFilename, String declaredMimeType, java.io.InputStream content,
                                            UUID actorId, boolean p1, boolean p2, boolean p3) {
    }

    public record EvidenceFileActor(UUID actorId, boolean p1, boolean p2, boolean p3) {
    }
}
