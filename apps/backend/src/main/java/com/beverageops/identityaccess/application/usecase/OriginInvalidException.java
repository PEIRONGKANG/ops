package com.beverageops.identityaccess.application.usecase;

public class OriginInvalidException extends RuntimeException {

    public OriginInvalidException() {
        super("The browser origin is not allowed for this operation.");
    }
}
