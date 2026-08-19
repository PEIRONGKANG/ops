package com.beverageops.shared.realtime;

import java.security.Principal;
import java.util.List;
import java.util.UUID;

import com.beverageops.identityaccess.domain.port.AccessTokenPort;

record AuthenticatedOperationsPrincipal(AccessTokenPort.AuthenticatedToken token, List<String> roles) implements Principal {

    @Override
    public String getName() {
        return token.accountId().toString();
    }

    UUID accountId() {
        return token.accountId();
    }
}
