package com.beverageops.shared.realtime;

import java.security.Principal;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

import com.beverageops.identityaccess.domain.port.AccessTokenPort;
import com.beverageops.identityaccess.domain.port.IdentityAuthenticationRepository;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.web.socket.WebSocketHandler;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class RealtimeAuthorisationTest {

    private final OperationsSubscriptionAuthorizer authorizer = new OperationsSubscriptionAuthorizer();

    @Test
    void onlyAuthenticatedClientsMaySubscribeToTheirPersonalOperationsQueue() {
        var allowed = subscription("/user/queue/operations", () -> "82000000-0000-0000-0000-000000000003");

        assertThat(authorizer.preSend(allowed, null)).isSameAs(allowed);
        assertThatThrownBy(() -> authorizer.preSend(subscription("/topic/operations", () -> "82000000-0000-0000-0000-000000000003"), null))
                .isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> authorizer.preSend(subscription("/user/82000000-0000-0000-0000-000000000004/queue/operations",
                () -> "82000000-0000-0000-0000-000000000003"), null)).isInstanceOf(AccessDeniedException.class);
        assertThatThrownBy(() -> authorizer.preSend(subscription("/user/queue/operations", null), null))
                .isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void clientsCannotPublishMessagesThroughTheOperationsBroker() {
        var headers = StompHeaderAccessor.create(StompCommand.SEND);
        headers.setSessionId("test-session");
        headers.setDestination("/queue/operations");
        headers.setUser(() -> "82000000-0000-0000-0000-000000000003");
        var message = MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());

        assertThatThrownBy(() -> authorizer.preSend(message, null)).isInstanceOf(AccessDeniedException.class);
    }

    @Test
    void handshakeRejectsMissingOrInvalidBearerTokenAndAcceptsAnActiveAccessSession() throws Exception {
        var tokens = mock(AccessTokenPort.class);
        var accounts = mock(IdentityAuthenticationRepository.class);
        var interceptor = new OperationsHandshakeInterceptor(tokens, accounts);

        var noTokenResponse = new MockHttpServletResponse();
        assertThat(interceptor.beforeHandshake(request(null), new ServletServerHttpResponse(noTokenResponse), null, Map.of())).isFalse();
        assertThat(noTokenResponse.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());

        when(tokens.parse("invalid")).thenThrow(new com.beverageops.identityaccess.application.usecase.AuthenticationException("invalid"));
        var invalidResponse = new MockHttpServletResponse();
        assertThat(interceptor.beforeHandshake(request("Bearer invalid"), new ServletServerHttpResponse(invalidResponse), null, Map.of())).isFalse();
        assertThat(invalidResponse.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());

        var accountId = UUID.fromString("82000000-0000-0000-0000-000000000003");
        var sessionId = UUID.fromString("83000000-0000-0000-0000-000000000003");
        var token = new AccessTokenPort.AuthenticatedToken(accountId, sessionId, UUID.randomUUID(), 1L, "access", UUID.randomUUID().toString());
        when(tokens.parse("active")).thenReturn(token);
        when(accounts.findActiveAccountProfile(accountId, 1L)).thenReturn(java.util.Optional.of(
                new IdentityAuthenticationRepository.AccountProfile(accountId, "P3", "P3 learner", 1L, java.util.List.of("P3"))));
        when(accounts.findActiveSession(sessionId, accountId, 1L)).thenReturn(java.util.Optional.of(
                new IdentityAuthenticationRepository.RefreshSession(sessionId, accountId, token.familyId(), "hash", 1L,
                        OffsetDateTime.now().plusMinutes(10), null, null)));

        var attributes = new java.util.HashMap<String, Object>();
        var activeResponse = new MockHttpServletResponse();
        assertThat(interceptor.beforeHandshake(request("Bearer active"), new ServletServerHttpResponse(activeResponse), null, attributes)).isTrue();
        assertThat(((Principal) attributes.get(OperationsHandshakeInterceptor.PRINCIPAL_ATTRIBUTE)).getName())
                .isEqualTo(accountId.toString());

        var browserAttributes = new java.util.HashMap<String, Object>();
        assertThat(interceptor.beforeHandshake(requestWithProtocols("ops-v1", "ops-bearer.active"),
                new ServletServerHttpResponse(new MockHttpServletResponse()), null, browserAttributes)).isTrue();
        assertThat(((Principal) browserAttributes.get(OperationsHandshakeInterceptor.PRINCIPAL_ATTRIBUTE)).getName())
                .isEqualTo(accountId.toString());

        var missingProtocolResponse = new MockHttpServletResponse();
        assertThat(interceptor.beforeHandshake(requestWithProtocols("ops-bearer.active"),
                new ServletServerHttpResponse(missingProtocolResponse), null, new java.util.HashMap<>())).isFalse();
        assertThat(missingProtocolResponse.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
    }

    @Test
    void handshakeHandlerBindsTheValidatedPrincipalToTheWebSocketSession() {
        var principal = (Principal) () -> "82000000-0000-0000-0000-000000000003";
        var handler = new OperationsPrincipalHandshakeHandler();

        assertThat(handler.determineUser(request(null), mock(WebSocketHandler.class),
                Map.of(OperationsHandshakeInterceptor.PRINCIPAL_ATTRIBUTE, principal))).isSameAs(principal);
    }

    private Message<byte[]> subscription(String destination, Principal principal) {
        var headers = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        headers.setSessionId("test-session");
        headers.setSubscriptionId("test-subscription");
        headers.setDestination(destination);
        headers.setUser(principal);
        return MessageBuilder.createMessage(new byte[0], headers.getMessageHeaders());
    }

    private ServletServerHttpRequest request(String authorization) {
        var request = new MockHttpServletRequest("GET", "/ws");
        if (authorization != null) {
            request.addHeader(HttpHeaders.AUTHORIZATION, authorization);
        }
        return new ServletServerHttpRequest(request);
    }

    private ServletServerHttpRequest requestWithProtocols(String... protocols) {
        var request = new MockHttpServletRequest("GET", "/ws");
        request.addHeader("Sec-WebSocket-Protocol", String.join(", ", protocols));
        return new ServletServerHttpRequest(request);
    }
}
