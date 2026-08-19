package com.beverageops.identityaccess.application.usecase;

public class LoginThrottledException extends RuntimeException {

    public LoginThrottledException() {
        super("Too many login attempts. Try again later.");
    }
}
