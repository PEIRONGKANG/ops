package com.beverageops.shared.notification.adapter.in.web;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.beverageops.identityaccess.domain.port.AccessTokenPort;
import com.beverageops.shared.notification.application.usecase.NotificationUseCase;
import com.beverageops.shared.notification.domain.port.NotificationRepository;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/notifications")
class NotificationController {

    private final NotificationUseCase notifications;

    NotificationController(NotificationUseCase notifications) {
        this.notifications = notifications;
    }

    @GetMapping
    List<NotificationResponse> notifications(Authentication authentication) {
        return notifications.notifications(actorId(authentication)).stream().map(this::response).toList();
    }

    @PostMapping("/{notificationId}/read")
    NotificationResponse markRead(@PathVariable UUID notificationId, Authentication authentication) {
        return response(notifications.markRead(notificationId, actorId(authentication)));
    }

    @PostMapping("/read-all")
    ReadAllResponse markAllRead(Authentication authentication) {
        return new ReadAllResponse(notifications.markAllRead(actorId(authentication)));
    }

    private UUID actorId(Authentication authentication) {
        if (authentication.getPrincipal() instanceof AccessTokenPort.AuthenticatedToken token) {
            return token.accountId();
        }
        return UUID.fromString(authentication.getName());
    }

    private NotificationResponse response(NotificationRepository.Notification notification) {
        return new NotificationResponse(notification.id(), notification.eventType(), notification.resourceType(), notification.resourceId(),
                notification.title(), notification.message(), notification.readAt(), notification.version(), notification.createdAt(),
                notification.updatedAt());
    }

    record NotificationResponse(UUID id, String eventType, String resourceType, UUID resourceId, String title, String message,
                                OffsetDateTime readAt, long version, OffsetDateTime createdAt, OffsetDateTime updatedAt) {
    }

    record ReadAllResponse(int updatedCount) {
    }
}
