package com.beverageops.identityaccess.infrastructure.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.beverageops.identityaccess.application.usecase.IdentityAccessProperties;
import com.beverageops.identityaccess.domain.port.SecretFingerprintPort;
import org.springframework.stereotype.Component;

@Component
public class SecretFingerprintService implements SecretFingerprintPort {

    private static final String ALGORITHM = "HmacSHA256";

    private final byte[] secret;

    public SecretFingerprintService(IdentityAccessProperties properties) {
        var configuredSecret = properties.tokenHmacSecret();
        if (configuredSecret == null || configuredSecret.length() < 32) {
            throw new IllegalStateException("AUTH_TOKEN_HMAC_SECRET must be at least 32 characters.");
        }
        this.secret = configuredSecret.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    public String fingerprint(String value) {
        try {
            var mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(secret, ALGORITHM));
            return HexFormat.of().formatHex(mac.doFinal(value.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to calculate secure token fingerprint.", exception);
        }
    }

    public boolean matches(String value, String fingerprint) {
        return MessageDigest.isEqual(fingerprint(value).getBytes(StandardCharsets.UTF_8),
                fingerprint.getBytes(StandardCharsets.UTF_8));
    }
}
