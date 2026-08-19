package com.beverageops.operations.application.usecase;

public class ShiftConflictException extends RuntimeException {

    public ShiftConflictException(String message) {
        super(message);
    }
}
