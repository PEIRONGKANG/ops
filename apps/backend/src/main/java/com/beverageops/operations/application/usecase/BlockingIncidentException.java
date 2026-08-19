package com.beverageops.operations.application.usecase;

public class BlockingIncidentException extends RuntimeException {
    public BlockingIncidentException(String message) {
        super(message);
    }
}
