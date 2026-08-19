package com.beverageops.identityaccess.domain.port;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.identityaccess.domain.model.RoleCode;

public interface IdentityAdministrationRepository {

    List<PendingRegistration> findRegistrationsByStatus(String status);

    Optional<PendingRegistration> lockPendingRegistration(UUID registrationRequestId);

    Optional<ManagedAccount> lockAccount(UUID accountId);

    void approveRegistration(UUID registrationRequestId, UUID accountId, UUID actorId, String passwordHash, List<RoleCode> roles,
                             String reason);

    void rejectRegistration(UUID registrationRequestId, UUID actorId, String reason);

    void resetPassword(UUID accountId, String passwordHash, String eventType, String revokeReason);

    void disableAccount(UUID accountId, String revokeReason);

    void reactivateAccount(UUID accountId, String passwordHash, String revokeReason);

    void appendEvent(String eventType, UUID actorId, UUID subjectAccountId, String reason);

    record PendingRegistration(UUID requestId, UUID accountId, String loginId, String displayName) {
    }

    record ManagedAccount(UUID accountId, String loginId, String displayName, String status) {
    }
}
