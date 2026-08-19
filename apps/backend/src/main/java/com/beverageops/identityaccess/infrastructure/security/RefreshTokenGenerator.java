package com.beverageops.identityaccess.infrastructure.security;

import java.security.SecureRandom;
import java.util.Base64;

import com.beverageops.identityaccess.domain.port.RefreshTokenPort;
import org.springframework.stereotype.Component;

@Component
public class RefreshTokenGenerator implements RefreshTokenPort {

    private final SecureRandom secureRandom = new SecureRandom();

    @Override
    public String generate() {
        var bytes = new byte[48];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
