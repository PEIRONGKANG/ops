package com.beverageops.identityaccess.application.usecase;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.UUID;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import com.beverageops.identityaccess.application.command.SubmitRegistrationCommand;
import com.beverageops.identityaccess.domain.model.LoginId;
import com.beverageops.identityaccess.domain.model.RegistrationResult;
import com.beverageops.identityaccess.domain.port.IdentityRegistrationRepository;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class SubmitRegistrationUseCase {

    private static final String CLAIM_HMAC_ALGORITHM = "HmacSHA256";

    private final IdentityRegistrationRepository registrations;
    private final IdentityAccessProperties properties;
    private final Argon2PasswordEncoder passwordEncoder;

    public SubmitRegistrationUseCase(
            IdentityRegistrationRepository registrations,
            IdentityAccessProperties properties,
            Argon2PasswordEncoder passwordEncoder) {
        this.registrations = registrations;
        this.properties = properties;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional
    public RegistrationResult submit(SubmitRegistrationCommand command) {
        var loginId = new LoginId(command.loginId());
        var displayName = normalizeDisplayName(command.displayName());
        var bootstrap = properties.bootstrap();

        if (loginId.value().equals(LoginId.normalize(bootstrap.p1LoginId()))) {
            return submitBootstrap(loginId, displayName, command.bootstrapClaim());
        }

        var accountId = UUID.randomUUID();
        if (registrations.createPendingRegistration(accountId, UUID.randomUUID(), loginId, displayName)) {
            registrations.appendEvent("REGISTRATION_SUBMITTED", accountId);
        }
        return RegistrationResult.PENDING;
    }

    private RegistrationResult submitBootstrap(LoginId loginId, String displayName, String submittedClaim) {
        var bootstrap = properties.bootstrap();
        if (!claimsMatch(submittedClaim, bootstrap.claimSecret(), bootstrap.temporaryPassword())) {
            // Do not create a pending account for the configured P1 identity.
            return RegistrationResult.PENDING;
        }

        var bootstrapState = registrations.lockBootstrap().orElseThrow(
                () -> new IllegalStateException("Bootstrap row is missing from the Flyway schema."));
        if (bootstrapState.consumed()) {
            return RegistrationResult.PENDING;
        }

        var accountId = UUID.randomUUID();
        registrations.createBootstrapP1(accountId, loginId, displayName,
                passwordEncoder.encode(bootstrap.temporaryPassword()));
        registrations.markBootstrapConsumed(accountId);
        registrations.appendEvent("BOOTSTRAP_P1_ACTIVATED", accountId);
        return RegistrationResult.BOOTSTRAP_ACTIVATED;
    }

    private boolean claimsMatch(String submittedClaim, String configuredClaim, String hmacKey) {
        if (submittedClaim == null || configuredClaim == null || hmacKey == null) {
            return false;
        }
        return MessageDigest.isEqual(hmac(submittedClaim, hmacKey), hmac(configuredClaim, hmacKey));
    }

    private byte[] hmac(String value, String key) {
        try {
            var mac = Mac.getInstance(CLAIM_HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), CLAIM_HMAC_ALGORITHM));
            return mac.doFinal(value.getBytes(StandardCharsets.UTF_8));
        } catch (Exception exception) {
            throw new IllegalStateException("Unable to validate bootstrap claim.", exception);
        }
    }

    private String normalizeDisplayName(String value) {
        if (value == null || value.trim().isEmpty() || value.trim().length() > 128) {
            throw new IllegalArgumentException("Display name must contain 1 to 128 characters.");
        }
        return value.trim();
    }
}
