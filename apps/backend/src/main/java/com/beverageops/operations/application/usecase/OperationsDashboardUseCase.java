package com.beverageops.operations.application.usecase;

import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.beverageops.operations.domain.model.ShiftStatus;
import com.beverageops.operations.domain.port.OperationsSchedulingRepository;
import com.beverageops.operations.domain.port.OperationalRiskRepository;
import com.beverageops.shared.notification.domain.port.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OperationsDashboardUseCase {

    private final OperationsSchedulingRepository scheduling;
    private final OperationalRiskRepository risk;
    private final NotificationRepository notifications;

    public OperationsDashboardUseCase(OperationsSchedulingRepository scheduling, OperationalRiskRepository risk,
                                      NotificationRepository notifications) {
        this.scheduling = scheduling;
        this.risk = risk;
        this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public PersonalDashboard personal(UUID accountId) {
        var shifts = scheduling.findPersonalShifts(accountId).stream()
                .map(shift -> new PersonalShiftItem(shift.shiftId(), shift.operatingDayId(), shift.operatingDate(), shift.shiftCode(),
                        shift.shiftName(), shift.roleCode(), shift.shiftStatus().name(), shift.shiftVersion()))
                .toList();
        var unread = notifications.findForRecipient(accountId).stream().filter(notification -> notification.readAt() == null).count();
        return new PersonalDashboard(shifts, unread);
    }

    @Transactional(readOnly = true)
    public OperationsToday today(UUID accountId, boolean p1) {
        var date = LocalDate.now(ZoneOffset.UTC);
        var shifts = p1 ? scheduling.findAllShifts(date) : scheduling.findScopedShifts(accountId, date);
        var draft = shifts.stream().filter(shift -> shift.status() == ShiftStatus.DRAFT).toList();
        var pendingApproval = shifts.stream().filter(shift -> shift.status() == ShiftStatus.KEY_APPROVAL_PENDING).toList();
        var blocking = shifts.stream().filter(shift -> risk.hasOpenBlockingIncident(shift.id())).toList();
        var pendingHandover = shifts.stream().filter(shift -> risk.hasUnacceptedRequiredHandover(shift.id())).toList();
        return new OperationsToday(draft.stream().map(this::shiftItem).toList(),
                pendingApproval.stream().map(this::shiftItem).toList(), blocking.stream().map(this::shiftItem).toList(),
                pendingHandover.stream().map(this::shiftItem).toList(), date);
    }

    private ShiftItem shiftItem(OperationsSchedulingRepository.Shift shift) {
        return new ShiftItem(shift.id(), shift.operatingDayId(), shift.operatingDate(), shift.code(), shift.name(),
                shift.status().name(), shift.version(), shift.storeId());
    }

    public record PersonalDashboard(List<PersonalShiftItem> assignedShifts, long unreadNotificationCount) {
    }

    public record PersonalShiftItem(UUID shiftId, UUID operatingDayId, LocalDate operatingDate, String code, String name,
                                    String roleCode, String status, long version) {
    }

    public record OperationsToday(List<ShiftItem> draftShifts, List<ShiftItem> pendingApprovalShifts,
                                  List<ShiftItem> blockingIncidentShifts, List<ShiftItem> pendingHandoverShifts,
                                  LocalDate operatingDate) {
    }

    public record ShiftItem(UUID id, UUID operatingDayId, LocalDate operatingDate, String code, String name, String status,
                            long version, UUID storeId) {
    }
}
