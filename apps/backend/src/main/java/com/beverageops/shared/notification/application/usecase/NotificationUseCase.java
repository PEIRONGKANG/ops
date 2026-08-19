package com.beverageops.shared.notification.application.usecase;

import java.util.List;
import java.util.UUID;

import com.beverageops.identityaccess.application.usecase.ForbiddenException;
import com.beverageops.identityaccess.application.usecase.ResourceNotFoundException;
import com.beverageops.shared.notification.domain.port.NotificationRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class NotificationUseCase {

    private final NotificationRepository notifications;

    public NotificationUseCase(NotificationRepository notifications) {
        this.notifications = notifications;
    }

    @Transactional(readOnly = true)
    public List<NotificationRepository.Notification> notifications(UUID recipientAccountId) {
        return notifications.findForRecipient(recipientAccountId);
    }

    @Transactional
    public NotificationRepository.Notification markRead(UUID notificationId, UUID actorAccountId) {
        var current = notifications.lock(notificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Notification not found."));
        if (!current.recipientAccountId().equals(actorAccountId)) {
            throw new ForbiddenException("Only the notification recipient can mark it read.");
        }
        if (current.readAt() != null) {
            return current;
        }
        var updated = notifications.markRead(current.id(), current.version());
        notifications.appendAudit("NOTIFICATION_READ", updated.id(), actorAccountId, current.version(), updated.version());
        return updated;
    }

    @Transactional
    public int markAllRead(UUID actorAccountId) {
        var updated = notifications.markAllRead(actorAccountId);
        if (updated > 0) {
            notifications.appendAudit("NOTIFICATIONS_READ_ALL", actorAccountId, actorAccountId, null, null);
        }
        return updated;
    }
}
