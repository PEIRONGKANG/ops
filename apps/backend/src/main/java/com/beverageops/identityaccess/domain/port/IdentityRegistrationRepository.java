package com.beverageops.identityaccess.domain.port;

import java.util.Optional;
import java.util.UUID;

import com.beverageops.identityaccess.domain.model.LoginId;

public interface IdentityRegistrationRepository {

    Optional<BootstrapState> lockBootstrap();

    void markBootstrapConsumed(UUID accountId);

    boolean createPendingRegistration(UUID accountId, UUID requestId, LoginId loginId, String displayName);

    void createBootstrapP1(UUID accountId, LoginId loginId, String displayName, String passwordHash);

    void appendEvent(String eventType, UUID subjectAccountId);

    record BootstrapState(boolean consumed) {
    }
}
