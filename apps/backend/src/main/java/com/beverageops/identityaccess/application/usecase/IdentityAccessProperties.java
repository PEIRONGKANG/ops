package com.beverageops.identityaccess.application.usecase;

import java.util.List;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "identity-access")
public record IdentityAccessProperties(
        Bootstrap bootstrap,
        String jwtSecret,
        String tokenHmacSecret,
        List<String> trustedOrigins,
        boolean secureCookies) {

    public record Bootstrap(String p1LoginId, String temporaryPassword, String claimSecret) {
    }
}
