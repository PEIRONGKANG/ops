package com.beverageops.shared.realtime;

import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

/**
 * Keeps the realtime boundary user-scoped. Resource identities are deliberately
 * not accepted as STOMP destinations; REST endpoints remain the authoritative
 * source for every operation view.
 */
@Component
public class OperationsSubscriptionAuthorizer implements ChannelInterceptor {

    static final String OPERATIONS_DESTINATION = "/user/queue/operations";

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        var accessor = StompHeaderAccessor.wrap(message);
        if (StompCommand.SEND.equals(accessor.getCommand()) || (StompCommand.SUBSCRIBE.equals(accessor.getCommand())
                && (accessor.getUser() == null || !OPERATIONS_DESTINATION.equals(accessor.getDestination())))) {
            throw new AccessDeniedException("Realtime subscriptions are limited to the authenticated personal operations queue.");
        }
        return message;
    }
}
