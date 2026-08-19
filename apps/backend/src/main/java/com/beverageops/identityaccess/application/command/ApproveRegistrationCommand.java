package com.beverageops.identityaccess.application.command;

import java.util.List;
import java.util.UUID;

public record ApproveRegistrationCommand(UUID registrationRequestId, UUID actorId, List<String> roles, String reason) {
}
