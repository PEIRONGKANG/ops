package com.beverageops.identityaccess.application.usecase;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

import com.beverageops.identityaccess.application.command.AccountAdministrationCommand;
import com.beverageops.identityaccess.application.command.ApproveRegistrationCommand;
import com.beverageops.identityaccess.domain.model.RoleCode;
import com.beverageops.identityaccess.domain.port.IdentityAdministrationRepository;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class IdentityAdministrationUseCase {

    private final IdentityAdministrationRepository administration;
    private final TemporaryPasswordGenerator passwords;
    private final Argon2PasswordEncoder passwordEncoder;

    public IdentityAdministrationUseCase(
            IdentityAdministrationRepository administration,
            TemporaryPasswordGenerator passwords,
            Argon2PasswordEncoder passwordEncoder) {
        this.administration = administration;
        this.passwords = passwords;
        this.passwordEncoder = passwordEncoder;
    }

    @Transactional(readOnly = true)
    public List<IdentityAdministrationRepository.PendingRegistration> listPendingRegistrations() {
        return administration.findRegistrationsByStatus("PENDING");
    }

    @Transactional(readOnly = true)
    public List<IdentityAdministrationRepository.AccountSummary> listAccounts(String status) {
        return administration.findAccountSummaries(normalizedStatus(status));
    }

    @Transactional
    public IssuedAccount approve(ApproveRegistrationCommand command) {
        var registration = administration.lockPendingRegistration(command.registrationRequestId())
                .orElseThrow(() -> new ResourceNotFoundException("Registration request is not pending."));
        var roles = parseAssignableRoles(command.roles());
        var temporaryPassword = passwords.generate();
        var reason = requireReason(command.reason());
        administration.approveRegistration(registration.requestId(), registration.accountId(), command.actorId(),
                passwordEncoder.encode(temporaryPassword), roles, reason);
        administration.appendEvent("REGISTRATION_APPROVED", command.actorId(), registration.accountId(), reason);
        return new IssuedAccount(registration.accountId(), registration.loginId(), registration.displayName(), roles, temporaryPassword);
    }

    @Transactional
    public void reject(UUID registrationRequestId, UUID actorId, String reason) {
        var registration = administration.lockPendingRegistration(registrationRequestId)
                .orElseThrow(() -> new ResourceNotFoundException("Registration request is not pending."));
        var verifiedReason = requireReason(reason);
        administration.rejectRegistration(registration.requestId(), actorId, verifiedReason);
        administration.appendEvent("REGISTRATION_REJECTED", actorId, registration.accountId(), verifiedReason);
    }

    @Transactional
    public IssuedTemporaryPassword resetPassword(AccountAdministrationCommand command) {
        var account = requireActiveAccount(command.accountId());
        var temporaryPassword = passwords.generate();
        var reason = requireReason(command.reason());
        administration.resetPassword(account.accountId(), passwordEncoder.encode(temporaryPassword),
                "PASSWORD_RESET", "PASSWORD_RESET");
        administration.appendEvent("PASSWORD_RESET", command.actorId(), account.accountId(), reason);
        return new IssuedTemporaryPassword(temporaryPassword);
    }

    @Transactional
    public void disable(AccountAdministrationCommand command) {
        var account = requireActiveAccount(command.accountId());
        var reason = requireReason(command.reason());
        administration.disableAccount(account.accountId(), "ACCOUNT_DISABLED");
        administration.appendEvent("ACCOUNT_DISABLED", command.actorId(), account.accountId(), reason);
    }

    @Transactional
    public IssuedTemporaryPassword reactivate(AccountAdministrationCommand command) {
        var account = administration.lockAccount(command.accountId())
                .orElseThrow(() -> new ResourceNotFoundException("Account not found."));
        if (!"DISABLED".equals(account.status())) {
            throw new IllegalStateException("Only disabled accounts can be reactivated.");
        }
        var reason = requireReason(command.reason());
        var temporaryPassword = passwords.generate();
        administration.reactivateAccount(account.accountId(), passwordEncoder.encode(temporaryPassword), "ACCOUNT_REACTIVATED");
        administration.appendEvent("ACCOUNT_REACTIVATED", command.actorId(), account.accountId(), reason);
        return new IssuedTemporaryPassword(temporaryPassword);
    }

    private IdentityAdministrationRepository.ManagedAccount requireActiveAccount(UUID accountId) {
        var account = administration.lockAccount(accountId)
                .orElseThrow(() -> new ResourceNotFoundException("Account not found."));
        if (!"ACTIVE".equals(account.status())) {
            throw new IllegalStateException("Account must be active for this action.");
        }
        return account;
    }

    private List<RoleCode> parseAssignableRoles(List<String> requestedRoles) {
        if (requestedRoles == null || requestedRoles.isEmpty()) {
            throw new IllegalArgumentException("At least one role is required.");
        }
        var roles = requestedRoles.stream()
                .map(role -> RoleCode.valueOf(role.toUpperCase(Locale.ROOT)))
                .distinct()
                .toList();
        if (roles.contains(RoleCode.EXTERNAL_REVIEWER)) {
            throw new IllegalArgumentException("External reviewer cannot be assigned in phase one.");
        }
        return roles;
    }

    private String requireReason(String reason) {
        if (reason == null || reason.trim().isEmpty() || reason.trim().length() > 500) {
            throw new IllegalArgumentException("A reason of 1 to 500 characters is required.");
        }
        return reason.trim();
    }

    private String normalizedStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        var normalized = status.trim().toUpperCase(Locale.ROOT);
        if (!normalized.equals("PENDING") && !normalized.equals("ACTIVE") && !normalized.equals("DISABLED")) {
            throw new IllegalArgumentException("Account status is unsupported.");
        }
        return normalized;
    }

    public record IssuedAccount(UUID id, String loginId, String displayName, List<RoleCode> roles, String temporaryPassword) {
    }

    public record IssuedTemporaryPassword(String temporaryPassword) {
    }
}
