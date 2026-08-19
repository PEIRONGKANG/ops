package com.beverageops.shared.realtime;

import org.springframework.context.annotation.Configuration;

import com.beverageops.identityaccess.application.usecase.IdentityAccessProperties;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
class OperationsRealtimeConfiguration implements WebSocketMessageBrokerConfigurer {

    private final OperationsHandshakeInterceptor handshake;
    private final OperationsPrincipalHandshakeHandler handshakeHandler;
    private final OperationsSubscriptionAuthorizer subscriptionAuthorizer;
    private final IdentityAccessProperties identityAccess;

    OperationsRealtimeConfiguration(OperationsHandshakeInterceptor handshake, OperationsPrincipalHandshakeHandler handshakeHandler,
                                    OperationsSubscriptionAuthorizer subscriptionAuthorizer,
                                    IdentityAccessProperties identityAccess) {
        this.handshake = handshake;
        this.handshakeHandler = handshakeHandler;
        this.subscriptionAuthorizer = subscriptionAuthorizer;
        this.identityAccess = identityAccess;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .addInterceptors(handshake)
                .setHandshakeHandler(handshakeHandler)
                .setAllowedOriginPatterns(identityAccess.trustedOrigins().toArray(String[]::new));
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        registry.enableSimpleBroker("/queue");
        registry.setUserDestinationPrefix("/user");
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(subscriptionAuthorizer);
    }
}
