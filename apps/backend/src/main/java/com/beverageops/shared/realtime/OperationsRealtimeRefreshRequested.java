package com.beverageops.shared.realtime;

import java.util.UUID;

/** Raised inside the notification transaction and delivered only after that transaction commits. */
public record OperationsRealtimeRefreshRequested(UUID recipientAccountId, String eventType, String resourceType,
                                                 UUID resourceId, UUID notificationId) {
}
