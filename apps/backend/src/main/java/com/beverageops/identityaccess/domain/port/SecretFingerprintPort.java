package com.beverageops.identityaccess.domain.port;

/**
 * Boundary for keyed, non-reversible fingerprints of secrets and client identifiers.
 */
public interface SecretFingerprintPort {

    String fingerprint(String value);
}
