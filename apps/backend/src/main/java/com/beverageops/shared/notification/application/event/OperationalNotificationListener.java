package com.beverageops.shared.notification.application.event;

import java.util.UUID;

import com.beverageops.shared.notification.domain.port.NotificationRepository;
import com.beverageops.shared.realtime.OperationsRealtimeRefreshRequested;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

@Component
class OperationalNotificationListener {

    private final NotificationRepository notifications;
    private final ApplicationEventPublisher events;

    OperationalNotificationListener(NotificationRepository notifications, ApplicationEventPublisher events) {
        this.notifications = notifications;
        this.events = events;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(OperationalNotificationRequested event) {
        var notification = notifications.create(UUID.randomUUID(), event.recipientAccountId(), event.eventType(),
                event.resourceType(), event.resourceId(), event.title(), event.message());
        notifications.appendAudit("NOTIFICATION_CREATED", notification.id(), event.actorAccountId(), null,
                notification.version());
        events.publishEvent(new OperationsRealtimeRefreshRequested(event.recipientAccountId(), event.eventType(),
                event.resourceType(), event.resourceId(), notification.id()));
    }
}
