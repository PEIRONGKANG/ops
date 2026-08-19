package com.beverageops.identityaccess.adapter.in.web;

import java.util.List;
import java.util.UUID;

import com.beverageops.identityaccess.application.command.AccountAdministrationCommand;
import com.beverageops.identityaccess.application.command.ApproveRegistrationCommand;
import com.beverageops.identityaccess.application.usecase.IdentityAdministrationUseCase;
import com.beverageops.identityaccess.domain.port.AccessTokenPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin")
class AdminIdentityController {

    private final IdentityAdministrationUseCase administration;

    AdminIdentityController(IdentityAdministrationUseCase administration) {
        this.administration = administration;
    }

    @GetMapping("/registration-requests")
    PendingRegistrationsResponse listPendingRegistrations(
            @RequestParam(defaultValue = "PENDING") String status) {
        if (!"PENDING".equals(status)) {
            throw new IllegalArgumentException("Only PENDING registration requests are available in phase one.");
        }
        var items = administration.listPendingRegistrations().stream()
                .map(request -> new PendingRegistrationResponse(
                        request.requestId(), request.loginId(), request.displayName()))
                .toList();
        return new PendingRegistrationsResponse(items);
    }

    @PostMapping("/registration-requests/{requestId}/approve")
    ResponseEntity<ApprovedRegistrationResponse> approve(
            @PathVariable UUID requestId,
            @RequestBody ApproveRegistrationRequest request,
            Authentication authentication) {
        var result = administration.approve(new ApproveRegistrationCommand(
                requestId, actorId(authentication), request.roles(), request.reason()));
        return ResponseEntity.status(HttpStatus.CREATED).body(new ApprovedRegistrationResponse(
                new AccountResponse(result.id(), result.loginId(), result.displayName(), result.roles().stream().map(Enum::name).toList()),
                result.temporaryPassword()));
    }

    @PostMapping("/registration-requests/{requestId}/reject")
    ResponseEntity<Void> reject(
            @PathVariable UUID requestId,
            @RequestBody ReasonRequest request,
            Authentication authentication) {
        administration.reject(requestId, actorId(authentication), request.reason());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/accounts/{accountId}/reset-password")
    IssuedTemporaryPasswordResponse resetPassword(
            @PathVariable UUID accountId,
            @RequestBody ReasonRequest request,
            Authentication authentication) {
        var result = administration.resetPassword(new AccountAdministrationCommand(accountId, actorId(authentication), request.reason()));
        return new IssuedTemporaryPasswordResponse(result.temporaryPassword());
    }

    @PostMapping("/accounts/{accountId}/disable")
    ResponseEntity<Void> disable(
            @PathVariable UUID accountId,
            @RequestBody ReasonRequest request,
            Authentication authentication) {
        administration.disable(new AccountAdministrationCommand(accountId, actorId(authentication), request.reason()));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/accounts/{accountId}/reactivate")
    IssuedTemporaryPasswordResponse reactivate(
            @PathVariable UUID accountId,
            @RequestBody ReasonRequest request,
            Authentication authentication) {
        var result = administration.reactivate(new AccountAdministrationCommand(accountId, actorId(authentication), request.reason()));
        return new IssuedTemporaryPasswordResponse(result.temporaryPassword());
    }

    private UUID actorId(Authentication authentication) {
        if (authentication.getPrincipal() instanceof AccessTokenPort.AuthenticatedToken token) {
            return token.accountId();
        }
        return UUID.fromString(authentication.getName());
    }

    record ApproveRegistrationRequest(List<String> roles, String reason) {
    }

    record ReasonRequest(String reason) {
    }

    record PendingRegistrationsResponse(List<PendingRegistrationResponse> items) {
    }

    record PendingRegistrationResponse(UUID id, String loginId, String displayName) {
    }

    record ApprovedRegistrationResponse(AccountResponse account, String temporaryPassword) {
    }

    record AccountResponse(UUID id, String loginId, String displayName, List<String> roles) {
    }

    record IssuedTemporaryPasswordResponse(String temporaryPassword) {
    }
}
