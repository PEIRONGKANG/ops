package com.beverageops.shared.notification.domain.port;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationRepository {

    Notification create(UUID id, UUID recipientAccountId, String eventType, String resourceType, UUID resourceId,
                        String title, String message);

    List<Notification> findForRecipient(UUID recipientAccountId);

    Optional<Notification> lock(UUID notificationId);

    Notification markRead(UUID notificationId, long expectedVersion);

    int markAllRead(UUID recipientAccountId);

    void appendAudit(String eventType, UUID resourceId, UUID actorAccountId, Long previousVersion, Long newVersion);

    record Notification(UUID id, UUID recipientAccountId, String eventType, String resourceType, UUID resourceId,
                        String title, String message, OffsetDateTime readAt, long version, OffsetDateTime createdAt,
                        OffsetDateTime updatedAt) {
    }
}
