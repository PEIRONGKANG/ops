package com.beverageops.identityaccess.application.usecase;

public class LoginInvalidException extends RuntimeException {

    public LoginInvalidException() {
        super("Login ID or password is invalid.");
    }
}
