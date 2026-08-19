package com.beverageops.identityaccess.application.command;

import java.util.UUID;

public record AccountAdministrationCommand(UUID accountId, UUID actorId, String reason) {
}
