package com.beverageops.operations.adapter.in.web;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import com.beverageops.identityaccess.domain.port.AccessTokenPort;
import com.beverageops.identityaccess.application.usecase.ForbiddenException;
import com.beverageops.operations.application.usecase.OperationsDashboardUseCase;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
class OperationsDashboardController {

    private final OperationsDashboardUseCase dashboard;

    OperationsDashboardController(OperationsDashboardUseCase dashboard) {
        this.dashboard = dashboard;
    }

    @GetMapping("/me/operations-dashboard")
    OperationsDashboardUseCase.PersonalDashboard personal(Authentication authentication) {
        return dashboard.personal(actorId(authentication));
    }

    @GetMapping("/operations/today")
    OperationsDashboardUseCase.OperationsToday today(Authentication authentication) {
        if (!hasRole(authentication, "P1") && !hasRole(authentication, "P2")) {
            throw new ForbiddenException("Only P2 or P1 can view the operations today dashboard.");
        }
        return dashboard.today(actorId(authentication), hasRole(authentication, "P1"));
    }

    private UUID actorId(Authentication authentication) {
        if (authentication.getPrincipal() instanceof AccessTokenPort.AuthenticatedToken token) {
            return token.accountId();
        }
        return UUID.fromString(authentication.getName());
    }

    private boolean hasRole(Authentication authentication, String role) {
        return authentication.getAuthorities().stream().anyMatch(authority -> authority.getAuthority().equals("ROLE_" + role));
    }
}
