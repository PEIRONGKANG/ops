package com.beverageops.shared.notification.application.event;

import java.util.UUID;

/**
 * A request emitted by an operations transaction. It is materialised only after that transaction commits.
 */
public record OperationalNotificationRequested(UUID recipientAccountId, String eventType, String resourceType, UUID resourceId,
                                               String title, String message, UUID actorAccountId) {
}
