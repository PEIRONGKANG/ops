package com.beverageops.identityaccess.adapter.in.web;

import java.time.Duration;
import java.util.Arrays;

import com.beverageops.identityaccess.application.usecase.IdentityAccessProperties;
import com.beverageops.identityaccess.application.usecase.IdentityAuthenticationUseCase;
import com.beverageops.identityaccess.application.usecase.OriginInvalidException;
import com.beverageops.identityaccess.domain.port.AccessTokenPort;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
class AuthenticationController {

    private static final String REFRESH_COOKIE_NAME = "ops_rt";

    private final IdentityAuthenticationUseCase authentication;
    private final AccessTokenPort tokens;
    private final IdentityAccessProperties properties;

    AuthenticationController(IdentityAuthenticationUseCase authentication,
                             AccessTokenPort tokens,
                             IdentityAccessProperties properties) {
        this.authentication = authentication;
        this.tokens = tokens;
        this.properties = properties;
    }

    @PostMapping("/login")
    ResponseEntity<SessionResponse> login(@RequestBody LoginRequest request, HttpServletRequest servletRequest) {
        var result = authentication.login(request.loginId(), request.password(), requestMetadata(servletRequest));
        return sessionResponse(result);
    }

    @PostMapping("/change-password")
    ResponseEntity<SessionResponse> changePassword(
            @RequestHeader(HttpHeaders.AUTHORIZATION) String authorization,
            @RequestBody ChangePasswordRequest request,
            HttpServletRequest servletRequest) {
        return sessionResponse(authentication.changePassword(parseBearerToken(authorization), request.newPassword(),
                requestMetadata(servletRequest)));
    }

    @GetMapping("/me")
    ProfileResponse me(@RequestHeader(HttpHeaders.AUTHORIZATION) String authorization) {
        var result = authentication.me(parseBearerToken(authorization));
        return new ProfileResponse(result.id(), result.loginId(), result.displayName(), result.roles());
    }

    @PostMapping("/refresh")
    ResponseEntity<SessionResponse> refresh(
            @RequestHeader(value = HttpHeaders.ORIGIN, required = false) String origin,
            HttpServletRequest servletRequest) {
        requireTrustedOrigin(origin);
        var result = authentication.refresh(refreshCookie(servletRequest), requestMetadata(servletRequest));
        return sessionResponse(result);
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(
            @RequestHeader(value = HttpHeaders.ORIGIN, required = false) String origin,
            @RequestHeader(value = HttpHeaders.AUTHORIZATION, required = false) String authorization,
            HttpServletRequest servletRequest) {
        var refreshToken = refreshCookie(servletRequest);
        if (refreshToken != null) {
            requireTrustedOrigin(origin);
        }
        authentication.logout(parseBearerTokenIfValid(authorization), refreshToken, requestMetadata(servletRequest));
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, clearRefreshCookie().toString()).build();
    }

    private ResponseEntity<SessionResponse> sessionResponse(IdentityAuthenticationUseCase.AuthenticationResult result) {
        var response = ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store");
        if (result.hasRefreshToken()) {
            response.header(HttpHeaders.SET_COOKIE, refreshCookie(result.refreshToken()).toString());
        }
        return response.body(new SessionResponse(result.accessToken(), result.tokenType(), result.expiresInSeconds()));
    }

    private AccessTokenPort.AuthenticatedToken parseBearerToken(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            throw new com.beverageops.identityaccess.application.usecase.AuthenticationException("Bearer access token is required.");
        }
        return tokens.parse(authorization.substring("Bearer ".length()).trim());
    }

    private AccessTokenPort.AuthenticatedToken parseBearerTokenIfValid(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            return null;
        }
        try {
            return tokens.parse(authorization.substring("Bearer ".length()).trim());
        } catch (com.beverageops.identityaccess.application.usecase.AuthenticationException exception) {
            return null;
        }
    }

    private void requireTrustedOrigin(String origin) {
        if (origin == null || properties.trustedOrigins() == null || !properties.trustedOrigins().contains(origin)) {
            throw new OriginInvalidException();
        }
    }

    private String refreshCookie(HttpServletRequest request) {
        if (request.getCookies() == null) {
            return null;
        }
        return Arrays.stream(request.getCookies())
                .filter(cookie -> REFRESH_COOKIE_NAME.equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst()
                .orElse(null);
    }

    private ResponseCookie refreshCookie(String token) {
        return ResponseCookie.from(REFRESH_COOKIE_NAME, token)
                .httpOnly(true)
                .secure(properties.secureCookies())
                .sameSite("Lax")
                .path("/api/v1/auth")
                .maxAge(Duration.ofDays(7))
                .build();
    }

    private ResponseCookie clearRefreshCookie() {
        return ResponseCookie.from(REFRESH_COOKIE_NAME, "")
                .httpOnly(true)
                .secure(properties.secureCookies())
                .sameSite("Lax")
                .path("/api/v1/auth")
                .maxAge(Duration.ZERO)
                .build();
    }

    private IdentityAuthenticationUseCase.AuthenticationRequestMetadata requestMetadata(HttpServletRequest request) {
        return new IdentityAuthenticationUseCase.AuthenticationRequestMetadata(
                request.getRemoteAddr(), request.getHeader("User-Agent"), request.getHeader("X-Request-Id"));
    }

    record LoginRequest(String loginId, String password) {
    }

    record ChangePasswordRequest(String newPassword) {
    }

    record SessionResponse(String accessToken, String tokenType, int expiresInSeconds) {
    }

    record ProfileResponse(java.util.UUID id, String loginId, String displayName, java.util.List<String> roles) {
    }
}
