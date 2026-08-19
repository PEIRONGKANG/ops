package com.beverageops.identityaccess.domain.port;

/**
 * Boundary for cryptographically secure opaque refresh-token generation.
 */
public interface RefreshTokenPort {

    String generate();
}
