package com.beverageops.operations.application.usecase;

public class EvidenceRequiredException extends RuntimeException {
    public EvidenceRequiredException(String message) {
        super(message);
    }
}
