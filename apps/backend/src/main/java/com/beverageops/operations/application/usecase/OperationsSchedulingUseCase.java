package com.beverageops.operations.application.usecase;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

import com.beverageops.governance.application.usecase.VersionConflictException;
import com.beverageops.identityaccess.application.usecase.ForbiddenException;
import com.beverageops.identityaccess.application.usecase.ResourceNotFoundException;
import com.beverageops.operations.domain.model.ShiftStatus;
import com.beverageops.operations.domain.model.AssignmentStatus;
import com.beverageops.operations.domain.model.TaskCompletionStatus;
import com.beverageops.operations.domain.port.OperationsSchedulingRepository;
import com.beverageops.operations.domain.port.OperationalRiskRepository;
import com.beverageops.operations.domain.port.ShiftExecutionRepository;
import com.beverageops.shared.notification.application.event.OperationalNotificationRequested;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OperationsSchedulingUseCase {

    private final OperationsSchedulingRepository scheduling;
    private final ShiftExecutionRepository execution;
    private final OperationalRiskRepository risk;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher events;

    public OperationsSchedulingUseCase(OperationsSchedulingRepository scheduling, ShiftExecutionRepository execution,
                                       OperationalRiskRepository risk, ObjectMapper objectMapper, ApplicationEventPublisher events) {
        this.scheduling = scheduling;
        this.execution = execution;
        this.risk = risk;
        this.objectMapper = objectMapper;
        this.events = events;
    }

    @Transactional
    public OperationsSchedulingRepository.ScopeGrant createScopeGrant(CreateScopeGrantCommand command) {
        require(command.termId(), "Term");
        require(command.storeId(), "Store");
        require(command.accountId(), "Account");
        var roleCode = requiredRole(command.roleCode());
        var grant = scheduling.createScopeGrant(UUID.randomUUID(), command.termId(), command.storeId(), command.accountId(),
                roleCode, command.actorId());
        audit("OPERATION_SCOPE_GRANTED", "OPERATION_SCOPE_GRANT", grant.id(), command.actorId(), null, null, null);
        return grant;
    }

    @Transactional
    public OperationsSchedulingRepository.OperatingDay createOperatingDay(CreateOperatingDayCommand command) {
        require(command.termId(), "Term");
        require(command.storeId(), "Store");
        require(command.templateVersionId(), "Template version");
        if (command.operatingDate() == null) {
            throw new IllegalArgumentException("Operating date is required.");
        }
        requireOperationalManagerScope(command.actorId(), command.p1(), command.termId(), command.storeId());
        var template = scheduling.findPublishedTemplate(command.templateVersionId())
                .orElseThrow(() -> new IllegalStateException("A published template version is required."));
        if (!template.termId().equals(command.termId()) || !template.storeId().equals(command.storeId())) {
            throw new IllegalArgumentException("The template version must belong to the operating day term and store.");
        }
        if (command.operatingDate().isBefore(template.effectiveFrom())
                || (template.effectiveUntil() != null && command.operatingDate().isAfter(template.effectiveUntil()))) {
            throw new IllegalArgumentException("The template version is not effective on the operating date.");
        }
        var operatingDay = scheduling.createOperatingDay(UUID.randomUUID(), command.termId(), command.storeId(),
                command.operatingDate(), template.id(), template.templateRevision(), template.configurationJson(), command.actorId());
        audit("OPERATING_DAY_CREATED", "OPERATING_DAY", operatingDay.id(), command.actorId(), null, null,
                operatingDay.version());
        return operatingDay;
    }

    @Transactional(readOnly = true)
    public List<OperationsSchedulingRepository.OperatingDay> operatingDays(UUID actorId, boolean p1, UUID termId,
                                                                              UUID storeId, LocalDate operatingDate) {
        if (!p1) {
            requireOperationalManagerScope(actorId, false, termId, storeId);
        }
        return scheduling.findOperatingDays(termId, storeId, operatingDate);
    }

    @Transactional(readOnly = true)
    public OperationsSchedulingRepository.OperatingDay operatingDay(UUID operatingDayId) {
        return scheduling.findOperatingDay(operatingDayId)
                .orElseThrow(() -> new ResourceNotFoundException("Operating day not found."));
    }

    @Transactional(readOnly = true)
    public OperationsSchedulingRepository.OperatingDay visibleOperatingDay(UUID operatingDayId, UUID actorId, boolean p1) {
        var day = operatingDay(operatingDayId);
        requireOperationalManagerScope(actorId, p1, day.termId(), day.storeId());
        return day;
    }

    @Transactional
    public OperationsSchedulingRepository.Shift createShift(CreateShiftCommand command) {
        require(command.operatingDayId(), "Operating day");
        if (command.startsAt() == null || command.endsAt() == null || !command.endsAt().isAfter(command.startsAt())) {
            throw new IllegalArgumentException("Shift start and end times must form a valid interval.");
        }
        var day = operatingDay(command.operatingDayId());
        requireOperationalManagerScope(command.actorId(), command.p1(), day.termId(), day.storeId());
        if (day.status() == ShiftStatus.CANCELLED || day.status() == ShiftStatus.CLOSED) {
            throw new IllegalStateException("A shift cannot be added to this operating day.");
        }
        if (scheduling.hasShiftConflict(day.id(), command.startsAt(), command.endsAt())) {
            throw new ShiftConflictException("This shift overlaps an existing non-cancelled shift in the operating day.");
        }
        var shift = scheduling.createShift(UUID.randomUUID(), day.id(), requiredCode(command.code(), "Shift code"),
                requiredText(command.name(), "Shift name", 128), command.startsAt(), command.endsAt(), command.actorId());
        audit("SHIFT_CREATED", "SHIFT", shift.id(), command.actorId(), null, null, shift.version());
        return shift;
    }

    @Transactional(readOnly = true)
    public OperationsSchedulingRepository.Shift shift(UUID shiftId) {
        return scheduling.findShift(shiftId).orElseThrow(() -> new ResourceNotFoundException("Shift not found."));
    }

    @Transactional
    public OperationsSchedulingRepository.OperatingDay updateOperatingDay(UUID operatingDayId, UpdateOperatingDayCommand command) {
        var day = scheduling.lockOperatingDay(operatingDayId)
                .orElseThrow(() -> new ResourceNotFoundException("Operating day not found."));
        requireOperationalManagerScope(command.actorId(), command.p1(), day.termId(), day.storeId());
        requireVersion(day.version(), command.version());
        if (scheduling.hasShifts(day.id())) {
            throw new IllegalStateException("An operating day with shifts cannot be modified in place.");
        }
        var operatingDate = command.operatingDate() == null ? day.operatingDate() : command.operatingDate();
        var template = command.templateVersionId() == null ? null : scheduling.findPublishedTemplate(command.templateVersionId())
                .orElseThrow(() -> new IllegalStateException("A published template version is required."));
        if (template != null && (!template.termId().equals(day.termId()) || !template.storeId().equals(day.storeId()))) {
            throw new IllegalArgumentException("The template version must belong to the operating day term and store.");
        }
        if (template != null && (operatingDate.isBefore(template.effectiveFrom())
                || (template.effectiveUntil() != null && operatingDate.isAfter(template.effectiveUntil())))) {
            throw new IllegalArgumentException("The template version is not effective on the operating date.");
        }
        var templateVersionId = template == null ? day.templateVersionId() : template.id();
        var templateRevision = template == null ? day.templateRevision() : template.templateRevision();
        var templateSnapshot = template == null ? day.templateSnapshotJson() : template.configurationJson();
        var updated = scheduling.updateOperatingDay(day.id(), operatingDate, templateVersionId, templateRevision, templateSnapshot,
                command.version());
        audit("OPERATING_DAY_UPDATED", "OPERATING_DAY", day.id(), command.actorId(), null, day.version(), updated.version());
        return updated;
    }

    @Transactional(readOnly = true)
    public OperationsSchedulingRepository.Shift visibleShift(UUID shiftId, UUID actorId, boolean p1) {
        var shift = shift(shiftId);
        requireOperationalManagerScope(actorId, p1, shift.termId(), shift.storeId());
        return shift;
    }

    @Transactional
    public OperationsSchedulingRepository.Assignment createAssignment(UUID shiftId, CreateAssignmentCommand command) {
        require(command.accountId(), "Account");
        var shift = lockShift(shiftId);
        requireOperationalManagerScope(command.actorId(), command.p1(), shift.termId(), shift.storeId());
        if (shift.status() != ShiftStatus.DRAFT && shift.status() != ShiftStatus.SCHEDULED) {
            throw new IllegalStateException("Assignments can only be changed before or during scheduling.");
        }
        if (scheduling.hasAssignmentConflict(command.accountId(), shift.startsAt(), shift.endsAt())) {
            throw new AssignmentConflictException("The account already has an overlapping assigned shift.");
        }
        var assignment = scheduling.createAssignment(UUID.randomUUID(), shiftId, command.accountId(),
                requiredCode(command.roleCode(), "Role code"), optionalText(command.reason(), 500), command.actorId());
        scheduling.appendAssignmentHistory(assignment.id(), "ASSIGNMENT_CREATED", command.actorId(), command.reason(),
                null, assignment.version());
        audit("SHIFT_ASSIGNMENT_CREATED", "SHIFT_ASSIGNMENT", assignment.id(), command.actorId(), command.reason(), null,
                assignment.version());
        notify(assignment.accountId(), "SHIFT_ASSIGNMENT_CREATED", "SHIFT_ASSIGNMENT", assignment.id(), "岗位已安排",
                "你已被安排至 " + assignment.roleCode() + " 岗位。", command.actorId());
        return assignment;
    }

    @Transactional
    public OperationsSchedulingRepository.Assignment updateAssignment(UUID shiftId, UpdateAssignmentCommand command) {
        var shift = lockShift(shiftId);
        requireOperationalManagerScope(command.actorId(), command.p1(), shift.termId(), shift.storeId());
        if (shift.status() != ShiftStatus.DRAFT && shift.status() != ShiftStatus.SCHEDULED) {
            throw new IllegalStateException("Assignments can only be changed before or during scheduling.");
        }
        require(command.assignmentId(), "Assignment");
        var assignment = scheduling.lockAssignment(command.assignmentId())
                .orElseThrow(() -> new ResourceNotFoundException("Shift assignment not found."));
        if (!assignment.shiftId().equals(shift.id())) {
            throw new ResourceNotFoundException("Shift assignment not found.");
        }
        requireVersion(assignment.version(), command.version());
        var reason = requiredText(command.reason(), "Assignment change reason", 500);
        if (assignment.status() != AssignmentStatus.ASSIGNED) {
            throw new IllegalStateException("A cancelled assignment cannot be changed.");
        }
        var cancelled = Boolean.TRUE.equals(command.cancelled());
        var nextRoleCode = cancelled ? assignment.roleCode() : requiredCode(command.roleCode(), "Role code");
        if (!cancelled && scheduling.hasActiveAssignment(shift.id(), assignment.accountId(), nextRoleCode, assignment.id())) {
            throw new AssignmentConflictException("The account already has this active role assignment in the shift.");
        }
        var nextStatus = cancelled ? AssignmentStatus.CANCELLED : AssignmentStatus.ASSIGNED;
        var updated = scheduling.updateAssignment(assignment.id(), nextRoleCode, nextStatus, command.version());
        var eventType = cancelled ? "ASSIGNMENT_CANCELLED" : "ASSIGNMENT_UPDATED";
        scheduling.appendAssignmentHistory(assignment.id(), eventType, command.actorId(), reason, assignment.version(),
                updated.version());
        audit(cancelled ? "SHIFT_ASSIGNMENT_CANCELLED" : "SHIFT_ASSIGNMENT_UPDATED", "SHIFT_ASSIGNMENT", assignment.id(),
                command.actorId(), reason, assignment.version(), updated.version());
        notify(assignment.accountId(), cancelled ? "SHIFT_ASSIGNMENT_CANCELLED" : "SHIFT_ASSIGNMENT_UPDATED",
                "SHIFT_ASSIGNMENT", assignment.id(), cancelled ? "岗位安排已取消" : "岗位安排已调整",
                cancelled ? "你的当班岗位安排已取消。" : "你的当班岗位安排已更新。", command.actorId());
        return updated;
    }

    @Transactional
    public OperationsSchedulingRepository.Shift scheduleShift(UUID shiftId, VersionCommand command) {
        var shift = lockShift(shiftId);
        requireOperationalManagerScope(command.actorId(), command.p1(), shift.termId(), shift.storeId());
        if (!scheduling.hasAssignments(shiftId)) {
            throw new IllegalStateException("A shift must have at least one assigned person before scheduling.");
        }
        var scheduled = transition(shift, ShiftStatus.DRAFT, ShiftStatus.SCHEDULED, command.version(), command.actorId(), null,
                "SHIFT_SCHEDULED");
        expandExecutionSnapshot(scheduled, command.actorId());
        return scheduled;
    }

    @Transactional
    public OperationsSchedulingRepository.Shift startShift(UUID shiftId, VersionCommand command, boolean p1) {
        var shift = lockShift(shiftId);
        if (!p1 && !scheduling.isAssignedToShift(command.actorId(), shiftId)) {
            throw new ForbiddenException("Only an assigned student can start this shift.");
        }
        var expectedStatus = shift.status() == ShiftStatus.REOPENED ? ShiftStatus.REOPENED : ShiftStatus.SCHEDULED;
        return transition(shift, expectedStatus, ShiftStatus.IN_PROGRESS, command.version(), command.actorId(), null,
                "SHIFT_STARTED");
    }

    @Transactional
    public OperationsSchedulingRepository.Shift requestClose(UUID shiftId, VersionCommand command, boolean p1) {
        var shift = lockShift(shiftId);
        if (!p1 && !scheduling.isAssignedToShift(command.actorId(), shiftId)) {
            throw new ForbiddenException("Only an assigned student can request shift close.");
        }
        return transition(shift, ShiftStatus.IN_PROGRESS, ShiftStatus.KEY_APPROVAL_PENDING, command.version(), command.actorId(),
                null, "SHIFT_CLOSE_REQUESTED");
    }

    @Transactional
    public OperationsSchedulingRepository.Shift closeShift(UUID shiftId, VersionCommand command) {
        var shift = lockShift(shiftId);
        requireOperationalManagerScope(command.actorId(), command.p1(), shift.termId(), shift.storeId());
        if (execution.hasUnapprovedRequiredMilestones(shiftId)) {
            throw new KeyApprovalRequiredException("All required milestones must be approved before closing the shift.");
        }
        if (risk.hasOpenBlockingIncident(shiftId)) {
            throw new BlockingIncidentException("All blocking incidents must be verified and closed before closing the shift.");
        }
        if (risk.hasUnacceptedRequiredHandover(shiftId)) {
            throw new HandoverRequiredException("All required handovers must be accepted before closing the shift.");
        }
        return transition(shift, ShiftStatus.KEY_APPROVAL_PENDING, ShiftStatus.CLOSED, command.version(), command.actorId(), null,
                "SHIFT_CLOSED");
    }

    @Transactional
    public OperationsSchedulingRepository.Shift reopenShift(UUID shiftId, ReasonVersionCommand command) {
        var shift = lockShift(shiftId);
        requireOperationalManagerScope(command.actorId(), command.p1(), shift.termId(), shift.storeId());
        return transition(shift, ShiftStatus.CLOSED, ShiftStatus.REOPENED, command.version(), command.actorId(),
                requiredText(command.reason(), "Reopen reason", 500), "SHIFT_REOPENED");
    }

    @Transactional
    public OperationsSchedulingRepository.Shift cancelShift(UUID shiftId, ReasonVersionCommand command) {
        var shift = lockShift(shiftId);
        requireOperationalManagerScope(command.actorId(), command.p1(), shift.termId(), shift.storeId());
        if (shift.status() != ShiftStatus.DRAFT && shift.status() != ShiftStatus.SCHEDULED) {
            throw new IllegalStateException("Only a draft or scheduled shift can be cancelled.");
        }
        return transition(shift, shift.status(), ShiftStatus.CANCELLED, command.version(), command.actorId(),
                requiredText(command.reason(), "Cancellation reason", 500), "SHIFT_CANCELLED");
    }

    @Transactional(readOnly = true)
    public List<OperationsSchedulingRepository.PersonalShift> personalShifts(UUID accountId) {
        return scheduling.findPersonalShifts(accountId);
    }

    @Transactional(readOnly = true)
    public List<OperationsSchedulingRepository.Shift> shifts(UUID operatingDayId, UUID actorId, boolean p1) {
        var day = visibleOperatingDay(operatingDayId, actorId, p1);
        return scheduling.findShifts(day.id());
    }

    @Transactional(readOnly = true)
    public List<OperationsSchedulingRepository.Assignment> assignments(UUID shiftId, UUID actorId, boolean p1) {
        var shift = visibleShift(shiftId, actorId, p1);
        return scheduling.findAssignments(shift.id());
    }

    private OperationsSchedulingRepository.Shift transition(OperationsSchedulingRepository.Shift current,
                                                             ShiftStatus expected, ShiftStatus next, long expectedVersion,
                                                             UUID actorId, String reason, String eventType) {
        requireVersion(current.version(), expectedVersion);
        if (current.status() != expected) {
            throw new IllegalStateException("The shift is not in the required state for this operation.");
        }
        var updated = scheduling.transitionShift(current.id(), expected, next, expectedVersion, actorId,
                next == ShiftStatus.CANCELLED ? reason : null);
        scheduling.appendShiftStateHistory(current.id(), current.status(), next, actorId, reason, current.version(), updated.version());
        audit(eventType, "SHIFT", current.id(), actorId, reason, current.version(), updated.version());
        return enrich(updated, current);
    }

    private OperationsSchedulingRepository.Shift lockShift(UUID shiftId) {
        return scheduling.lockShift(shiftId).orElseThrow(() -> new ResourceNotFoundException("Shift not found."));
    }

    private void expandExecutionSnapshot(OperationsSchedulingRepository.Shift shift, UUID actorId) {
        var day = operatingDay(shift.operatingDayId());
        var assignments = execution.findActiveAssignments(shift.id());
        for (var definition : execution.findTemplateComponents(day.templateVersionId(), "SOP_TASK")) {
            var configuration = configuration(definition.configurationJson());
            var roleCode = configuration.path("roleCode").asText(null);
            var evidenceRequired = configuration.path("evidenceRequired").asBoolean(false);
            var p2AcceptanceRequired = configuration.path("requiresP2Acceptance").asBoolean(false);
            for (var assignment : assignments) {
                if (roleCode == null || roleCode.isBlank() || roleCode.equalsIgnoreCase(assignment.roleCode())) {
                    var taskId = UUID.randomUUID();
                    execution.createTaskCompletion(taskId, shift.id(), assignment.id(), definition.id(), definition.code(),
                            definition.name(), assignment.roleCode(), definition.configurationJson(), evidenceRequired,
                            p2AcceptanceRequired);
                    execution.appendTaskHistory(taskId, "TASK_COMPLETION_CREATED", actorId, null, TaskCompletionStatus.PENDING,
                            TaskCompletionStatus.PENDING, 0, 1);
                    audit("TASK_COMPLETION_CREATED", "TASK_COMPLETION", taskId, actorId, null, null, 1L);
                }
            }
        }
        for (var definition : execution.findTemplateComponents(day.templateVersionId(), "MILESTONE")) {
            var configuration = configuration(definition.configurationJson());
            execution.createMilestoneSubmission(UUID.randomUUID(), shift.id(), definition.id(), definition.code(), definition.name(),
                    definition.configurationJson(), configuration.path("required").asBoolean(false),
                    configuration.path("evidenceRequired").asBoolean(false));
        }
    }

    private JsonNode configuration(String value) {
        try {
            return objectMapper.readTree(value);
        } catch (Exception exception) {
            throw new IllegalStateException("Template component configuration is invalid.");
        }
    }

    private OperationsSchedulingRepository.Shift enrich(OperationsSchedulingRepository.Shift candidate,
                                                          OperationsSchedulingRepository.Shift source) {
        return new OperationsSchedulingRepository.Shift(candidate.id(), candidate.operatingDayId(), source.termId(), source.storeId(),
                source.operatingDate(), candidate.code(), candidate.name(), candidate.startsAt(), candidate.endsAt(), candidate.status(),
                candidate.cancellationReason(), candidate.version(), candidate.updatedAt());
    }

    private void requireOperationalManagerScope(UUID actorId, boolean p1, UUID termId, UUID storeId) {
        if (p1) {
            return;
        }
        if (!scheduling.hasScope(actorId, "P2", termId, storeId)) {
            throw new ForbiddenException("You do not have P2 scope for this term and store.");
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

    private void requireVersion(long actual, long expected) {
        if (actual != expected) {
            throw new VersionConflictException("The resource has changed. Refresh and try again.");
        }
    }

    private void require(Object value, String name) {
        if (value == null) {
            throw new IllegalArgumentException(name + " is required.");
        }
    }

    private String requiredRole(String value) {
        var role = requiredText(value, "Role code", 32).toUpperCase(Locale.ROOT);
        if (!role.equals("P1") && !role.equals("P2") && !role.equals("T1")) {
            throw new IllegalArgumentException("Role code must be P1, P2 or T1.");
        }
        return role;
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

    private String optionalText(String value, int maxLength) {
        return value == null || value.isBlank() ? null : requiredText(value, "Reason", maxLength);
    }

    public record CreateScopeGrantCommand(UUID termId, UUID storeId, UUID accountId, String roleCode, UUID actorId) {
    }

    public record CreateOperatingDayCommand(UUID termId, UUID storeId, LocalDate operatingDate, UUID templateVersionId,
                                            UUID actorId, boolean p1) {
    }

    public record CreateShiftCommand(UUID operatingDayId, String code, String name, OffsetDateTime startsAt,
                                     OffsetDateTime endsAt, UUID actorId, boolean p1) {
    }

    public record UpdateOperatingDayCommand(LocalDate operatingDate, UUID templateVersionId, long version, UUID actorId,
                                            boolean p1) {
    }

    public record CreateAssignmentCommand(UUID accountId, String roleCode, String reason, UUID actorId, boolean p1) {
    }

    public record UpdateAssignmentCommand(UUID assignmentId, String roleCode, Boolean cancelled, String reason, long version,
                                          UUID actorId, boolean p1) {
    }

    public record VersionCommand(long version, UUID actorId, boolean p1) {
    }

    public record ReasonVersionCommand(long version, String reason, UUID actorId, boolean p1) {
    }
}
