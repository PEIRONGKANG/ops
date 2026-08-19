package com.beverageops.identityaccess.domain.port;

import java.util.UUID;

/**
 * Boundary for issuing and verifying short-lived identity access tokens.
 */
public interface AccessTokenPort {

    String issueAccessToken(UUID accountId, UUID sessionId, UUID familyId, long authorizationVersion);

    String issuePasswordChangeToken(UUID accountId, long authorizationVersion);

    AuthenticatedToken parse(String rawToken);

    record AuthenticatedToken(UUID accountId, UUID sessionId, UUID familyId, long authorizationVersion,
                              String type, String tokenId) {
        public boolean isAccessToken() {
            return "access".equals(type);
        }

        public boolean isPasswordChangeToken() {
            return "password_change".equals(type);
        }
    }
}
