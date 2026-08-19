package com.beverageops.identityaccess.adapter.in.web;

import com.beverageops.identityaccess.application.command.SubmitRegistrationCommand;
import com.beverageops.identityaccess.application.usecase.SubmitRegistrationUseCase;
import com.beverageops.identityaccess.domain.model.RegistrationResult;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth/registrations")
class RegistrationController {

    private final SubmitRegistrationUseCase registrations;

    RegistrationController(SubmitRegistrationUseCase registrations) {
        this.registrations = registrations;
    }

    @PostMapping
    ResponseEntity<RegistrationResponse> register(
            @RequestBody RegistrationRequest request,
            @RequestHeader(value = "X-Bootstrap-Claim", required = false) String bootstrapClaim) {
        var result = registrations.submit(new SubmitRegistrationCommand(
                request.loginId(), request.displayName(), bootstrapClaim));
        var response = new RegistrationResponse(result == RegistrationResult.BOOTSTRAP_ACTIVATED
                ? "bootstrapActivated" : "pending");
        return result == RegistrationResult.BOOTSTRAP_ACTIVATED
                ? ResponseEntity.status(201).body(response)
                : ResponseEntity.accepted().body(response);
    }

    record RegistrationRequest(String loginId, String displayName) {
    }

    record RegistrationResponse(String status) {
    }
}
