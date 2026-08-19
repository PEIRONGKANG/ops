package com.beverageops.identityaccess.application.usecase;

public class RefreshReusedException extends RuntimeException {

    public RefreshReusedException() {
        super("The refresh session was already used or revoked.");
    }
}
