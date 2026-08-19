package com.beverageops.shared.realtime;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class OperationalRealtimeEventListenerTest {

    @Test
    void committedNotificationRefreshIsSentOnlyToItsRecipient() {
        var messaging = mock(SimpMessagingTemplate.class);
        var listener = new OperationalRealtimeEventListener(messaging);
        var recipientId = UUID.fromString("82000000-0000-0000-0000-000000000003");
        var resourceId = UUID.fromString("81000000-0000-0000-0000-000000000003");
        var notificationId = UUID.fromString("84000000-0000-0000-0000-000000000003");

        listener.on(new OperationsRealtimeRefreshRequested(recipientId, "ASSIGNMENT_CREATED", "SHIFT_ASSIGNMENT", resourceId, notificationId));

        verify(messaging).convertAndSendToUser(eq(recipientId.toString()), eq("/queue/operations"),
                eq(new OperationsRefreshEvent("ASSIGNMENT_CREATED", "SHIFT_ASSIGNMENT", resourceId, notificationId)));
    }
}
