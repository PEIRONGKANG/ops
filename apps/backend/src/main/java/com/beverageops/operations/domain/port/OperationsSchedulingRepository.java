package com.beverageops.operations.domain.port;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.operations.domain.model.AssignmentStatus;
import com.beverageops.operations.domain.model.ShiftStatus;

public interface OperationsSchedulingRepository {

    Optional<PublishedTemplate> findPublishedTemplate(UUID templateVersionId);

    boolean hasScope(UUID accountId, String roleCode, UUID termId, UUID storeId);

    ScopeGrant createScopeGrant(UUID id, UUID termId, UUID storeId, UUID accountId, String roleCode, UUID actorId);

    OperatingDay createOperatingDay(UUID id, UUID termId, UUID storeId, LocalDate operatingDate, UUID templateVersionId,
                                    int templateRevision, String templateSnapshotJson, UUID actorId);

    Optional<OperatingDay> findOperatingDay(UUID operatingDayId);

    Optional<OperatingDay> lockOperatingDay(UUID operatingDayId);

    OperatingDay updateOperatingDay(UUID operatingDayId, LocalDate operatingDate, UUID templateVersionId,
                                    int templateRevision, String templateSnapshotJson, long expectedVersion);

    List<OperatingDay> findOperatingDays(UUID termId, UUID storeId, LocalDate operatingDate);

    Shift createShift(UUID id, UUID operatingDayId, String code, String name, OffsetDateTime startsAt,
                      OffsetDateTime endsAt, UUID actorId);

    boolean hasShiftConflict(UUID operatingDayId, OffsetDateTime startsAt, OffsetDateTime endsAt);

    boolean hasShifts(UUID operatingDayId);

    Optional<Shift> findShift(UUID shiftId);

    Optional<Shift> lockShift(UUID shiftId);

    List<Shift> findShifts(UUID operatingDayId);

    Shift transitionShift(UUID shiftId, ShiftStatus expectedStatus, ShiftStatus nextStatus, long expectedVersion,
                          UUID actorId, String cancellationReason);

    Assignment createAssignment(UUID id, UUID shiftId, UUID accountId, String roleCode, String reason, UUID actorId);

    Optional<Assignment> lockAssignment(UUID assignmentId);

    boolean hasActiveAssignment(UUID shiftId, UUID accountId, String roleCode, UUID excludedAssignmentId);

    Assignment updateAssignment(UUID assignmentId, String roleCode, AssignmentStatus status, long expectedVersion);

    List<Assignment> findAssignments(UUID shiftId);

    boolean hasAssignments(UUID shiftId);

    boolean hasAssignmentConflict(UUID accountId, OffsetDateTime startsAt, OffsetDateTime endsAt);

    boolean isAssignedToShift(UUID accountId, UUID shiftId);

    List<PersonalShift> findPersonalShifts(UUID accountId);

    List<Shift> findScopedShifts(UUID accountId, LocalDate operatingDate);

    List<Shift> findAllShifts(LocalDate operatingDate);

    void appendAudit(String eventType, String resourceType, UUID resourceId, UUID actorId, String reason,
                     Long previousVersion, Long newVersion);

    void appendAssignmentHistory(UUID assignmentId, String eventType, UUID actorId, String reason, Long previousVersion,
                                 Long newVersion);

    void appendShiftStateHistory(UUID shiftId, ShiftStatus fromStatus, ShiftStatus toStatus, UUID actorId,
                                 String reason, long previousVersion, long newVersion);

    record PublishedTemplate(UUID id, UUID termId, UUID storeId, int templateRevision, String configurationJson,
                             LocalDate effectiveFrom, LocalDate effectiveUntil) {
    }

    record ScopeGrant(UUID id, UUID termId, UUID storeId, UUID accountId, String roleCode, OffsetDateTime createdAt) {
    }

    record OperatingDay(UUID id, UUID termId, UUID storeId, LocalDate operatingDate, UUID templateVersionId,
                        int templateRevision, String templateSnapshotJson, ShiftStatus status, long version,
                        OffsetDateTime updatedAt) {
    }

    record Shift(UUID id, UUID operatingDayId, UUID termId, UUID storeId, LocalDate operatingDate, String code,
                 String name, OffsetDateTime startsAt, OffsetDateTime endsAt, ShiftStatus status, String cancellationReason,
                 long version, OffsetDateTime updatedAt) {
    }

    record Assignment(UUID id, UUID shiftId, UUID accountId, String roleCode, AssignmentStatus status, long version,
                      OffsetDateTime updatedAt) {
    }

    record PersonalShift(UUID shiftId, UUID operatingDayId, UUID termId, UUID storeId, LocalDate operatingDate,
                         String shiftCode, String shiftName, OffsetDateTime startsAt, OffsetDateTime endsAt,
                         ShiftStatus shiftStatus, String roleCode, AssignmentStatus assignmentStatus, long shiftVersion) {
    }
}
