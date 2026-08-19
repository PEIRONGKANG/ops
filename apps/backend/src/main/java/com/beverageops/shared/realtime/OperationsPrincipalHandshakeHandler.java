package com.beverageops.shared.realtime;

import java.security.Principal;
import java.util.Map;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

/** Places the already validated bearer identity on the resulting WebSocket session. */
@Component
class OperationsPrincipalHandshakeHandler extends DefaultHandshakeHandler {

    OperationsPrincipalHandshakeHandler() {
        setSupportedProtocols(OperationsHandshakeInterceptor.OPERATIONS_PROTOCOL);
    }

    @Override
    protected Principal determineUser(ServerHttpRequest request, WebSocketHandler wsHandler, Map<String, Object> attributes) {
        var principal = attributes.get(OperationsHandshakeInterceptor.PRINCIPAL_ATTRIBUTE);
        return principal instanceof Principal authenticatedPrincipal ? authenticatedPrincipal : null;
    }
}
