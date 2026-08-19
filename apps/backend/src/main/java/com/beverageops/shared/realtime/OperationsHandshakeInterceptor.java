package com.beverageops.shared.realtime;

import java.util.Map;

import com.beverageops.identityaccess.application.usecase.AuthenticationException;
import com.beverageops.identityaccess.domain.port.AccessTokenPort;
import com.beverageops.identityaccess.domain.port.IdentityAuthenticationRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

/** Validates the same short-lived access session used by the HTTP API before opening a STOMP connection. */
@Component
class OperationsHandshakeInterceptor implements HandshakeInterceptor {

    static final String PRINCIPAL_ATTRIBUTE = OperationsHandshakeInterceptor.class.getName() + ".principal";
    static final String OPERATIONS_PROTOCOL = "ops-v1";
    private static final String BEARER_PROTOCOL_PREFIX = "ops-bearer.";

    private final AccessTokenPort tokens;
    private final IdentityAuthenticationRepository accounts;

    OperationsHandshakeInterceptor(AccessTokenPort tokens, IdentityAuthenticationRepository accounts) {
        this.tokens = tokens;
        this.accounts = accounts;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {
        var rawToken = bearerToken(request);
        if (rawToken == null) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
        try {
            var token = tokens.parse(rawToken);
            if (!token.isAccessToken()) {
                throw new AuthenticationException("An access token is required.");
            }
            var profile = accounts.findActiveAccountProfile(token.accountId(), token.authorizationVersion())
                    .orElseThrow(() -> new AuthenticationException("Account is unavailable or authorization has changed."));
            accounts.findActiveSession(token.sessionId(), token.accountId(), token.authorizationVersion())
                    .orElseThrow(() -> new AuthenticationException("The session is no longer active."));
            attributes.put(PRINCIPAL_ATTRIBUTE, new AuthenticatedOperationsPrincipal(token, profile.roles()));
            return true;
        } catch (AuthenticationException exception) {
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
    }

    private String bearerToken(ServerHttpRequest request) {
        var authorization = request.getHeaders().getFirst(HttpHeaders.AUTHORIZATION);
        if (authorization != null && authorization.startsWith("Bearer ")) {
            return authorization.substring("Bearer ".length()).trim();
        }
        var protocols = request.getHeaders().getOrEmpty("Sec-WebSocket-Protocol").stream()
                .flatMap(value -> java.util.Arrays.stream(value.split(",")))
                .map(String::trim)
                .toList();
        if (!protocols.contains(OPERATIONS_PROTOCOL)) {
            return null;
        }
        return protocols.stream()
                .filter(protocol -> protocol.startsWith(BEARER_PROTOCOL_PREFIX))
                .map(protocol -> protocol.substring(BEARER_PROTOCOL_PREFIX.length()))
                .filter(token -> !token.isBlank())
                .findFirst()
                .orElse(null);
    }

    @Override
    public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response, WebSocketHandler wsHandler,
                               Exception exception) {
        // The authenticated principal exists only for the lifetime of this WebSocket session.
    }
}
