package com.beverageops.operations.infrastructure.media;

public class EvidenceMediaValidationException extends IllegalArgumentException {

    public EvidenceMediaValidationException(String message) {
        super(message);
    }

    public EvidenceMediaValidationException(String message, Throwable cause) {
        super(message, cause);
    }
}
