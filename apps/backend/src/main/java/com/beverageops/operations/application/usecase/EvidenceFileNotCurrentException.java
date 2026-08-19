package com.beverageops.operations.application.usecase;

public class EvidenceFileNotCurrentException extends IllegalStateException {

    public EvidenceFileNotCurrentException(String message) {
        super(message);
    }
}
