package com.beverageops.shared.notification.application.event;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.beverageops.shared.notification.domain.port.NotificationRepository;
import com.beverageops.shared.realtime.OperationsRealtimeRefreshRequested;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OperationalNotificationListenerTest {

    @Test
    void committedNotificationSendsOnlyItsRecipientALightweightRefreshEvent() {
        var notifications = mock(NotificationRepository.class);
        var events = mock(ApplicationEventPublisher.class);
        var listener = new OperationalNotificationListener(notifications, events);
        var recipientId = UUID.fromString("82000000-0000-0000-0000-000000000003");
        var resourceId = UUID.fromString("81000000-0000-0000-0000-000000000003");
        var notificationId = UUID.fromString("84000000-0000-0000-0000-000000000003");
        var event = new OperationalNotificationRequested(recipientId, "ASSIGNMENT_CREATED", "SHIFT_ASSIGNMENT", resourceId,
                "New role assignment", "You have been assigned.", UUID.fromString("80000000-0000-0000-0000-000000000003"));
        when(notifications.create(any(), eq(recipientId), eq("ASSIGNMENT_CREATED"), eq("SHIFT_ASSIGNMENT"), eq(resourceId),
                eq("New role assignment"), eq("You have been assigned.")))
                .thenReturn(new NotificationRepository.Notification(notificationId, recipientId, "ASSIGNMENT_CREATED", "SHIFT_ASSIGNMENT",
                        resourceId, "New role assignment", "You have been assigned.", null, 1, OffsetDateTime.now(), OffsetDateTime.now()));

        listener.on(event);

        verify(events).publishEvent(eq(new OperationsRealtimeRefreshRequested(recipientId, "ASSIGNMENT_CREATED", "SHIFT_ASSIGNMENT",
                resourceId, notificationId)));
        verify(notifications).appendAudit("NOTIFICATION_CREATED", notificationId, event.actorAccountId(), null, 1L);
    }
}
