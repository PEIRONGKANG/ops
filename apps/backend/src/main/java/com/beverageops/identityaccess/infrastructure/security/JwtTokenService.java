package com.beverageops.identityaccess.infrastructure.security;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

import javax.crypto.SecretKey;

import com.beverageops.identityaccess.application.usecase.AuthenticationException;
import com.beverageops.identityaccess.application.usecase.IdentityAccessProperties;
import com.beverageops.identityaccess.domain.port.AccessTokenPort;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Component;

@Component
public class JwtTokenService implements AccessTokenPort {

    private final SecretKey signingKey;

    public JwtTokenService(IdentityAccessProperties properties) {
        this.signingKey = Keys.hmacShaKeyFor(requireSecret(properties.jwtSecret(), "AUTH_JWT_SECRET").getBytes(StandardCharsets.UTF_8));
    }

    @Override
    public String issueAccessToken(UUID accountId, UUID sessionId, UUID familyId, long authorizationVersion) {
        return issue(accountId, sessionId, familyId, authorizationVersion, "access", Duration.ofMinutes(15));
    }

    @Override
    public String issuePasswordChangeToken(UUID accountId, long authorizationVersion) {
        return issue(accountId, UUID.randomUUID(), UUID.randomUUID(), authorizationVersion, "password_change", Duration.ofMinutes(10));
    }

    @Override
    public AuthenticatedToken parse(String rawToken) {
        try {
            var claims = Jwts.parser().verifyWith(signingKey).build().parseSignedClaims(rawToken).getPayload();
            return new AccessTokenPort.AuthenticatedToken(UUID.fromString(claims.getSubject()), UUID.fromString(claims.get("sid", String.class)),
                    UUID.fromString(claims.get("fid", String.class)), claims.get("av", Long.class),
                    claims.get("typ", String.class), claims.getId());
        } catch (Exception exception) {
            throw new AuthenticationException("Access token is invalid or expired.");
        }
    }

    private String issue(UUID accountId, UUID sessionId, UUID familyId, long authorizationVersion, String type, Duration duration) {
        var now = Instant.now();
        return Jwts.builder()
                .subject(accountId.toString())
                .claim("sid", sessionId.toString())
                .claim("fid", familyId.toString())
                .claim("av", authorizationVersion)
                .claim("typ", type)
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(duration)))
                .signWith(signingKey)
                .compact();
    }

    private String requireSecret(String value, String variableName) {
        if (value == null || value.length() < 32) {
            throw new IllegalStateException(variableName + " must be at least 32 characters.");
        }
        return value;
    }

}
