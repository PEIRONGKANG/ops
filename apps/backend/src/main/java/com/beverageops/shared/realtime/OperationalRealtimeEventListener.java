package com.beverageops.shared.realtime;

import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
class OperationalRealtimeEventListener {

    private final SimpMessagingTemplate messaging;

    OperationalRealtimeEventListener(SimpMessagingTemplate messaging) {
        this.messaging = messaging;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(OperationsRealtimeRefreshRequested event) {
        messaging.convertAndSendToUser(event.recipientAccountId().toString(), "/queue/operations",
                new OperationsRefreshEvent(event.eventType(), event.resourceType(), event.resourceId(), event.notificationId()));
    }
}
