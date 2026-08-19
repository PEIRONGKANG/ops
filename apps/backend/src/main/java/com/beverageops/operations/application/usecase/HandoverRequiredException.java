package com.beverageops.operations.application.usecase;

public class HandoverRequiredException extends RuntimeException {
    public HandoverRequiredException(String message) {
        super(message);
    }
}
