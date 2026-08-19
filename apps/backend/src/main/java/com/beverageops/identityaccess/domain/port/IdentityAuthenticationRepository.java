package com.beverageops.identityaccess.domain.port;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.identityaccess.domain.model.LoginId;

public interface IdentityAuthenticationRepository {

    Optional<AccountAuthentication> findAccountForLogin(LoginId loginId);

    Optional<AccountProfile> findActiveAccountProfile(UUID accountId);

    Optional<AccountProfile> findActiveAccountProfile(UUID accountId, long authorizationVersion);

    Optional<RefreshSession> lockRefreshSessionByTokenHash(String tokenHash);

    Optional<RefreshSession> findActiveSession(UUID sessionId, UUID accountId, long authorizationVersion);

    void createRefreshSession(RefreshSession session);

    void rotateRefreshSession(UUID previousSessionId, UUID nextSessionId, UUID accountId, UUID familyId,
                              String nextTokenHash, long authorizationVersion, OffsetDateTime expiresAt,
                              String clientIpHash, String userAgentSummary);

    void revokeSession(UUID sessionId, String reason);

    void revokeFamily(UUID familyId, String reason);

    void changePassword(UUID accountId, String passwordHash);

    void recordSuccessfulLogin(UUID accountId);

    boolean isThrottled(String keyType, String keyHash, OffsetDateTime now);

    void recordFailedLogin(String keyType, String keyHash, OffsetDateTime now);

    void clearFailedLogin(String keyType, String keyHash);

    void appendEvent(AuthEvent event);

    record AuthEvent(String eventType, UUID actorAccountId, UUID subjectAccountId, String requestId,
                     String ipHash, String metadataJson) {
    }

    record AccountAuthentication(UUID id, String loginId, String displayName, String status, String passwordHash,
                                 boolean mustChangePassword, long authorizationVersion, List<String> roles) {
    }

    record AccountProfile(UUID id, String loginId, String displayName, long authorizationVersion, List<String> roles) {
    }

    record RefreshSession(UUID id, UUID accountId, UUID familyId, String tokenHash, long authorizationVersion,
                          OffsetDateTime expiresAt, OffsetDateTime rotatedAt, OffsetDateTime revokedAt) {
        public boolean isUsable(OffsetDateTime now) {
            return revokedAt == null && rotatedAt == null && expiresAt.isAfter(now);
        }
    }
}
