package com.beverageops.operations.application.usecase;

public class KeyApprovalRequiredException extends RuntimeException {
    public KeyApprovalRequiredException(String message) {
        super(message);
    }
}
