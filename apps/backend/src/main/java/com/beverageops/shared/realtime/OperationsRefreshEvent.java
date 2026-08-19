package com.beverageops.shared.realtime;

import java.util.UUID;

/**
 * A signal for an authenticated client to re-fetch its server-authoritative
 * dashboard and notifications. It is not a business data replication channel.
 */
public record OperationsRefreshEvent(String eventType, String resourceType, UUID resourceId, UUID notificationId) {
}
