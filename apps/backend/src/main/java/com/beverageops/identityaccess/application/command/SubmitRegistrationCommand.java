package com.beverageops.identityaccess.application.command;

public record SubmitRegistrationCommand(String loginId, String displayName, String bootstrapClaim) {
}
