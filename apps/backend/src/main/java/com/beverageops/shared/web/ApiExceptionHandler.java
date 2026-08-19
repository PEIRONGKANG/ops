package com.beverageops.shared.web;

import com.beverageops.identityaccess.application.usecase.AuthenticationException;
import com.beverageops.identityaccess.application.usecase.ForbiddenException;
import com.beverageops.identityaccess.application.usecase.LoginInvalidException;
import com.beverageops.identityaccess.application.usecase.LoginThrottledException;
import com.beverageops.identityaccess.application.usecase.OriginInvalidException;
import com.beverageops.identityaccess.application.usecase.RefreshReusedException;
import com.beverageops.identityaccess.application.usecase.ResourceNotFoundException;
import com.beverageops.governance.application.usecase.VersionConflictException;
import com.beverageops.operations.application.usecase.AssignmentConflictException;
import com.beverageops.operations.application.usecase.ShiftConflictException;
import com.beverageops.operations.application.usecase.EvidenceRequiredException;
import com.beverageops.operations.application.usecase.KeyApprovalRequiredException;
import com.beverageops.operations.application.usecase.BlockingIncidentException;
import com.beverageops.operations.application.usecase.HandoverRequiredException;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
class ApiExceptionHandler {

    @ExceptionHandler(LoginInvalidException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleInvalidLogin(LoginInvalidException exception) {
        return error(HttpStatus.UNAUTHORIZED, "LOGIN_INVALID", exception.getMessage());
    }

    @ExceptionHandler(LoginThrottledException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleLoginThrottle(LoginThrottledException exception) {
        return error(HttpStatus.TOO_MANY_REQUESTS, "LOGIN_THROTTLED", exception.getMessage());
    }

    @ExceptionHandler(RefreshReusedException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleRefreshReuse(RefreshReusedException exception) {
        return error(HttpStatus.UNAUTHORIZED, "REFRESH_REUSED", exception.getMessage());
    }

    @ExceptionHandler(OriginInvalidException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleInvalidOrigin(OriginInvalidException exception) {
        return error(HttpStatus.FORBIDDEN, "ORIGIN_INVALID", exception.getMessage());
    }

    @ExceptionHandler(ForbiddenException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleForbidden(ForbiddenException exception) {
        return error(HttpStatus.FORBIDDEN, "FORBIDDEN", exception.getMessage());
    }

    @ExceptionHandler(AuthenticationException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleAuthentication(AuthenticationException exception) {
        return error(HttpStatus.UNAUTHORIZED, "UNAUTHORIZED", exception.getMessage());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleValidation(IllegalArgumentException exception) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", exception.getMessage());
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleMissingParameter(MissingServletRequestParameterException exception) {
        return error(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Required parameter '" + exception.getParameterName()
                + "' is missing.");
    }

    @ExceptionHandler(IllegalStateException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleState(IllegalStateException exception) {
        return error(HttpStatus.CONFLICT, "STATE_CONFLICT", exception.getMessage());
    }

    @ExceptionHandler(VersionConflictException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleVersionConflict(VersionConflictException exception) {
        return error(HttpStatus.CONFLICT, "VERSION_CONFLICT", exception.getMessage());
    }

    @ExceptionHandler(AssignmentConflictException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleAssignmentConflict(AssignmentConflictException exception) {
        return error(HttpStatus.CONFLICT, "ASSIGNMENT_CONFLICT", exception.getMessage());
    }

    @ExceptionHandler(ShiftConflictException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleShiftConflict(ShiftConflictException exception) {
        return error(HttpStatus.CONFLICT, "SHIFT_CONFLICT", exception.getMessage());
    }

    @ExceptionHandler(EvidenceRequiredException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleEvidenceRequired(EvidenceRequiredException exception) {
        return error(HttpStatus.CONFLICT, "EVIDENCE_REQUIRED", exception.getMessage());
    }

    @ExceptionHandler(KeyApprovalRequiredException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleKeyApprovalRequired(KeyApprovalRequiredException exception) {
        return error(HttpStatus.CONFLICT, "KEY_APPROVAL_REQUIRED", exception.getMessage());
    }

    @ExceptionHandler(BlockingIncidentException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleBlockingIncident(BlockingIncidentException exception) {
        return error(HttpStatus.CONFLICT, "BLOCKING_INCIDENT", exception.getMessage());
    }

    @ExceptionHandler(HandoverRequiredException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleHandoverRequired(HandoverRequiredException exception) {
        return error(HttpStatus.CONFLICT, "HANDOVER_REQUIRED", exception.getMessage());
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleNotFound(ResourceNotFoundException exception) {
        return error(HttpStatus.NOT_FOUND, "NOT_FOUND", exception.getMessage());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiErrorWriter.ApiError> handleMissingResource(NoResourceFoundException exception) {
        return error(HttpStatus.NOT_FOUND, "NOT_FOUND", "Resource not found.");
    }

    private ResponseEntity<ApiErrorWriter.ApiError> error(HttpStatus status, String code, String message) {
        return ResponseEntity.status(status).body(new ApiErrorWriter.ApiError(code, message, java.util.UUID.randomUUID().toString()));
    }
}
