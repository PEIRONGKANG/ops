package com.beverageops.operations.adapter.in.web;

import java.io.IOException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.beverageops.identityaccess.domain.port.AccessTokenPort;
import com.beverageops.operations.application.usecase.OperationsSchedulingUseCase;
import com.beverageops.operations.application.usecase.ShiftExecutionUseCase;
import com.beverageops.operations.domain.port.EvidenceMediaStoragePort;
import com.beverageops.operations.domain.port.OperationsSchedulingRepository;
import com.beverageops.operations.domain.port.ShiftExecutionRepository;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
class OperationsSchedulingController {

    private final OperationsSchedulingUseCase scheduling;
    private final ShiftExecutionUseCase execution;
    private final EvidenceMediaStoragePort mediaStorage;

    OperationsSchedulingController(OperationsSchedulingUseCase scheduling, ShiftExecutionUseCase execution,
                                   EvidenceMediaStoragePort mediaStorage) {
        this.scheduling = scheduling;
        this.execution = execution;
        this.mediaStorage = mediaStorage;
    }

    @PostMapping("/admin/operation-scope-grants")
    ResponseEntity<ScopeGrantResponse> createScopeGrant(@RequestBody CreateScopeGrantRequest request,
                                                         Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(scopeGrant(scheduling.createScopeGrant(
                new OperationsSchedulingUseCase.CreateScopeGrantCommand(request.termId(), request.storeId(), request.accountId(),
                        request.roleCode(), actorId(authentication)))));
    }

    @PostMapping("/operating-days")
    ResponseEntity<OperatingDayResponse> createOperatingDay(@RequestBody CreateOperatingDayRequest request,
                                                            Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(operatingDay(scheduling.createOperatingDay(
                new OperationsSchedulingUseCase.CreateOperatingDayCommand(request.termId(), request.storeId(), request.operatingDate(),
                        request.templateVersionId(), actorId(authentication), hasRole(authentication, "P1")))));
    }

    @PatchMapping("/operating-days/{operatingDayId}")
    OperatingDayResponse updateOperatingDay(@PathVariable UUID operatingDayId, @RequestBody UpdateOperatingDayRequest request,
                                            Authentication authentication) {
        return operatingDay(scheduling.updateOperatingDay(operatingDayId,
                new OperationsSchedulingUseCase.UpdateOperatingDayCommand(request.operatingDate(), request.templateVersionId(),
                        request.version(), actorId(authentication), hasRole(authentication, "P1"))));
    }

    @GetMapping("/operating-days")
    List<OperatingDayResponse> listOperatingDays(@RequestParam UUID termId, @RequestParam UUID storeId,
                                                 @RequestParam(required = false) LocalDate operatingDate,
                                                 Authentication authentication) {
        return scheduling.operatingDays(actorId(authentication), hasRole(authentication, "P1"), termId, storeId, operatingDate)
                .stream().map(this::operatingDay).toList();
    }

    @GetMapping("/operating-days/{operatingDayId}")
    OperatingDayResponse operatingDay(@PathVariable UUID operatingDayId, Authentication authentication) {
        var day = scheduling.visibleOperatingDay(operatingDayId, actorId(authentication), hasRole(authentication, "P1"));
        return operatingDay(day);
    }

    @PostMapping("/shifts")
    ResponseEntity<ShiftResponse> createShift(@RequestBody CreateShiftRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(shift(scheduling.createShift(
                new OperationsSchedulingUseCase.CreateShiftCommand(request.operatingDayId(), request.code(), request.name(),
                        request.startsAt(), request.endsAt(), actorId(authentication), hasRole(authentication, "P1")))));
    }

    @GetMapping("/shifts")
    List<ShiftResponse> listShifts(@RequestParam UUID operatingDayId, Authentication authentication) {
        return scheduling.shifts(operatingDayId, actorId(authentication), hasRole(authentication, "P1"))
                .stream().map(this::shift).toList();
    }

    @GetMapping("/shifts/{shiftId}")
    ShiftResponse shift(@PathVariable UUID shiftId, Authentication authentication) {
        var shift = scheduling.visibleShift(shiftId, actorId(authentication), hasRole(authentication, "P1"));
        return shift(shift);
    }

    @PostMapping("/shifts/{shiftId}/assignments")
    ResponseEntity<AssignmentResponse> createAssignment(@PathVariable UUID shiftId, @RequestBody CreateAssignmentRequest request,
                                                        Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(assignment(scheduling.createAssignment(shiftId,
                new OperationsSchedulingUseCase.CreateAssignmentCommand(request.accountId(), request.roleCode(), request.reason(),
                        actorId(authentication), hasRole(authentication, "P1")))));
    }

    @PatchMapping("/shifts/{shiftId}/assignments")
    AssignmentResponse updateAssignment(@PathVariable UUID shiftId, @RequestBody UpdateAssignmentRequest request,
                                        Authentication authentication) {
        return assignment(scheduling.updateAssignment(shiftId, new OperationsSchedulingUseCase.UpdateAssignmentCommand(
                request.assignmentId(), request.roleCode(), request.cancelled(), request.reason(), request.version(),
                actorId(authentication), hasRole(authentication, "P1"))));
    }

    @GetMapping("/shifts/{shiftId}/assignments")
    List<AssignmentResponse> listAssignments(@PathVariable UUID shiftId, Authentication authentication) {
        return scheduling.assignments(shiftId, actorId(authentication), hasRole(authentication, "P1"))
                .stream().map(this::assignment).toList();
    }

    @GetMapping("/shifts/{shiftId}/tasks")
    List<TaskCompletionResponse> tasks(@PathVariable UUID shiftId, Authentication authentication) {
        return execution.tasks(shiftId, actorId(authentication), hasRole(authentication, "P1"), hasRole(authentication, "P2"),
                hasRole(authentication, "P3")).stream().map(this::task).toList();
    }

    @GetMapping("/shifts/{shiftId}/milestones")
    List<MilestoneResponse> milestones(@PathVariable UUID shiftId, Authentication authentication) {
        return execution.milestones(shiftId, actorId(authentication), hasRole(authentication, "P1"), hasRole(authentication, "P2"),
                hasRole(authentication, "P3")).stream().map(this::milestone).toList();
    }

    @PostMapping("/task-completions/{taskCompletionId}/submit")
    TaskCompletionResponse submitTask(@PathVariable UUID taskCompletionId, @RequestBody VersionRequest request,
                                      Authentication authentication) {
        return task(execution.submitTask(taskCompletionId, executionVersion(request.version(), authentication)));
    }

    @PostMapping("/task-completions/{taskCompletionId}/return")
    TaskCompletionResponse returnTask(@PathVariable UUID taskCompletionId, @RequestBody ReasonVersionRequest request,
                                      Authentication authentication) {
        return task(execution.returnTask(taskCompletionId, executionReasonVersion(request.version(), request.reason(), authentication)));
    }

    @PostMapping("/task-completions/{taskCompletionId}/accept")
    TaskCompletionResponse acceptTask(@PathVariable UUID taskCompletionId, @RequestBody VersionRequest request,
                                      Authentication authentication) {
        return task(execution.acceptTask(taskCompletionId, executionVersion(request.version(), authentication)));
    }

    @PostMapping("/task-completions/{taskCompletionId}/withdraw")
    TaskCompletionResponse withdrawTask(@PathVariable UUID taskCompletionId, @RequestBody ReasonVersionRequest request,
                                        Authentication authentication) {
        return task(execution.withdrawTask(taskCompletionId, executionReasonVersion(request.version(), request.reason(), authentication)));
    }

    @PostMapping("/milestone-submissions/{milestoneSubmissionId}/submit")
    MilestoneResponse submitMilestone(@PathVariable UUID milestoneSubmissionId, @RequestBody VersionRequest request,
                                      Authentication authentication) {
        return milestone(execution.submitMilestone(milestoneSubmissionId, executionVersion(request.version(), authentication)));
    }

    @PostMapping("/milestone-submissions/{milestoneSubmissionId}/approve")
    MilestoneResponse approveMilestone(@PathVariable UUID milestoneSubmissionId, @RequestBody VersionRequest request,
                                       Authentication authentication) {
        return milestone(execution.approveMilestone(milestoneSubmissionId, executionVersion(request.version(), authentication)));
    }

    @PostMapping("/milestone-submissions/{milestoneSubmissionId}/return")
    MilestoneResponse returnMilestone(@PathVariable UUID milestoneSubmissionId, @RequestBody ReasonVersionRequest request,
                                      Authentication authentication) {
        return milestone(execution.returnMilestone(milestoneSubmissionId,
                executionReasonVersion(request.version(), request.reason(), authentication)));
    }

    @PostMapping("/evidence")
    ResponseEntity<EvidenceResponse> createEvidence(@RequestBody CreateEvidenceRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(evidence(execution.createEvidence(
                new ShiftExecutionUseCase.CreateEvidenceCommand(request.taskCompletionId(), request.milestoneSubmissionId(),
                        request.kind(), request.textContent(), request.externalUrl(), request.referenceValue(), request.occurredAt(),
                        actorId(authentication), hasRole(authentication, "P1"), hasRole(authentication, "P2"),
                        hasRole(authentication, "P3")))));
    }

    @PostMapping(value = "/evidence/{evidenceId}/files", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<EvidenceFileResponse> uploadEvidenceFile(@PathVariable UUID evidenceId, @RequestParam("file") MultipartFile file,
                                                             Authentication authentication) throws IOException {
        return ResponseEntity.status(HttpStatus.CREATED).body(evidenceFile(execution.uploadEvidenceFile(evidenceId,
                evidenceFileUpload(file, authentication))));
    }

    @GetMapping("/evidence/{evidenceId}/files")
    List<EvidenceFileResponse> evidenceFiles(@PathVariable UUID evidenceId, Authentication authentication) {
        return execution.evidenceFiles(evidenceId, evidenceFileActor(authentication)).stream().map(this::evidenceFile).toList();
    }

    @GetMapping("/evidence/{evidenceId}/files/current")
    ResponseEntity<?> downloadEvidenceFile(@PathVariable UUID evidenceId,
                                           @org.springframework.web.bind.annotation.RequestHeader(value = HttpHeaders.RANGE,
                                                   required = false) String range,
                                           Authentication authentication) throws IOException {
        var current = execution.currentEvidenceFileForRead(evidenceId, evidenceFileActor(authentication));
        if (current.mediaType().rangeSupported() && range != null) {
            return rangedVideo(current, range);
        }
        var length = mediaStorage.size(current.relativePath());
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(current.originalFilename()))
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .contentType(MediaType.parseMediaType(current.detectedMimeType()))
                .contentLength(length)
                .body(new InputStreamResource(mediaStorage.open(current.relativePath())));
    }

    @PostMapping(value = "/evidence/{evidenceId}/files/replace", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    EvidenceFileResponse replaceEvidenceFile(@PathVariable UUID evidenceId, @RequestParam("file") MultipartFile file,
                                             @RequestParam("reason") String reason, Authentication authentication) throws IOException {
        return evidenceFile(execution.replaceEvidenceFile(evidenceId, reason, evidenceFileUpload(file, authentication)));
    }

    @PostMapping(value = "/evidence/{evidenceId}/files/withdraw", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    EvidenceFileResponse withdrawEvidenceFile(@PathVariable UUID evidenceId, @RequestParam("reason") String reason,
                                              Authentication authentication) {
        return evidenceFile(execution.withdrawEvidenceFile(evidenceId, reason, evidenceFileActor(authentication)));
    }

    @PostMapping("/shifts/{shiftId}/schedule")
    ShiftResponse schedule(@PathVariable UUID shiftId, @RequestBody VersionRequest request, Authentication authentication) {
        return shift(scheduling.scheduleShift(shiftId, new OperationsSchedulingUseCase.VersionCommand(request.version(),
                actorId(authentication), hasRole(authentication, "P1"))));
    }

    @PostMapping("/shifts/{shiftId}/start")
    ShiftResponse start(@PathVariable UUID shiftId, @RequestBody VersionRequest request, Authentication authentication) {
        return shift(scheduling.startShift(shiftId, new OperationsSchedulingUseCase.VersionCommand(request.version(),
                actorId(authentication), hasRole(authentication, "P1")), hasRole(authentication, "P1")));
    }

    @PostMapping("/shifts/{shiftId}/request-close")
    ShiftResponse requestClose(@PathVariable UUID shiftId, @RequestBody VersionRequest request, Authentication authentication) {
        return shift(scheduling.requestClose(shiftId, new OperationsSchedulingUseCase.VersionCommand(request.version(),
                actorId(authentication), hasRole(authentication, "P1")), hasRole(authentication, "P1")));
    }

    @PostMapping("/shifts/{shiftId}/close")
    ShiftResponse close(@PathVariable UUID shiftId, @RequestBody VersionRequest request, Authentication authentication) {
        return shift(scheduling.closeShift(shiftId, new OperationsSchedulingUseCase.VersionCommand(request.version(),
                actorId(authentication), hasRole(authentication, "P1"))));
    }

    @PostMapping("/shifts/{shiftId}/reopen")
    ShiftResponse reopen(@PathVariable UUID shiftId, @RequestBody ReasonVersionRequest request, Authentication authentication) {
        return shift(scheduling.reopenShift(shiftId, new OperationsSchedulingUseCase.ReasonVersionCommand(request.version(),
                request.reason(), actorId(authentication), hasRole(authentication, "P1"))));
    }

    @PostMapping("/shifts/{shiftId}/cancel")
    ShiftResponse cancel(@PathVariable UUID shiftId, @RequestBody ReasonVersionRequest request, Authentication authentication) {
        return shift(scheduling.cancelShift(shiftId, new OperationsSchedulingUseCase.ReasonVersionCommand(request.version(),
                request.reason(), actorId(authentication), hasRole(authentication, "P1"))));
    }

    @GetMapping("/me/shifts")
    List<PersonalShiftResponse> personalShifts(Authentication authentication) {
        return scheduling.personalShifts(actorId(authentication)).stream().map(this::personalShift).toList();
    }

    @GetMapping("/me/shifts/{shiftId}")
    PersonalShiftResponse personalShift(@PathVariable UUID shiftId, Authentication authentication) {
        return scheduling.personalShifts(actorId(authentication)).stream()
                .filter(shift -> shift.shiftId().equals(shiftId))
                .findFirst()
                .map(this::personalShift)
                .orElseThrow(() -> new com.beverageops.identityaccess.application.usecase.ResourceNotFoundException("Shift not found."));
    }

    private UUID actorId(Authentication authentication) {
        if (authentication.getPrincipal() instanceof AccessTokenPort.AuthenticatedToken token) {
            return token.accountId();
        }
        return UUID.fromString(authentication.getName());
    }

    private boolean hasRole(Authentication authentication, String role) {
        return authentication.getAuthorities().stream().anyMatch(authority -> authority.getAuthority().equals("ROLE_" + role));
    }

    private ScopeGrantResponse scopeGrant(OperationsSchedulingRepository.ScopeGrant grant) {
        return new ScopeGrantResponse(grant.id(), grant.termId(), grant.storeId(), grant.accountId(), grant.roleCode(), grant.createdAt());
    }

    private OperatingDayResponse operatingDay(OperationsSchedulingRepository.OperatingDay day) {
        return new OperatingDayResponse(day.id(), day.termId(), day.storeId(), day.operatingDate(), day.templateVersionId(),
                day.templateRevision(), day.status().name(), day.version(), day.updatedAt());
    }

    private ShiftResponse shift(OperationsSchedulingRepository.Shift shift) {
        return new ShiftResponse(shift.id(), shift.operatingDayId(), shift.termId(), shift.storeId(), shift.operatingDate(),
                shift.code(), shift.name(), shift.startsAt(), shift.endsAt(), shift.status().name(), shift.cancellationReason(),
                shift.version(), shift.updatedAt());
    }

    private AssignmentResponse assignment(OperationsSchedulingRepository.Assignment assignment) {
        return new AssignmentResponse(assignment.id(), assignment.shiftId(), assignment.accountId(), assignment.roleCode(),
                assignment.status().name(), assignment.version(), assignment.updatedAt());
    }

    private TaskCompletionResponse task(ShiftExecutionRepository.TaskCompletion task) {
        return new TaskCompletionResponse(task.id(), task.shiftId(), task.assignmentId(), task.code(), task.name(), task.roleCode(),
                task.evidenceRequired(), task.p2AcceptanceRequired(), task.status().name(), task.version(), task.updatedAt());
    }

    private MilestoneResponse milestone(ShiftExecutionRepository.MilestoneSubmission milestone) {
        return new MilestoneResponse(milestone.id(), milestone.shiftId(), milestone.code(), milestone.name(), milestone.required(),
                milestone.evidenceRequired(), milestone.status().name(), milestone.version(), milestone.updatedAt());
    }

    private EvidenceResponse evidence(ShiftExecutionRepository.Evidence evidence) {
        return new EvidenceResponse(evidence.id(), evidence.shiftId(), evidence.taskCompletionId(), evidence.milestoneSubmissionId(),
                evidence.kind().name(), evidence.occurredAt(), evidence.submittedByAccountId(), evidence.version(), evidence.updatedAt());
    }

    private EvidenceFileResponse evidenceFile(ShiftExecutionRepository.EvidenceFileVersion file) {
        return new EvidenceFileResponse(file.id(), file.evidenceId(), file.fileVersion(), file.relativePath(),
                file.originalFilename(), file.mediaType().mimeType(), file.detectedMimeType(), file.byteSize(), file.sha256(),
                file.status().name(), file.reason(), file.createdAt(), file.purgeAfter(), file.purgedAt(), file.purgeResult());
    }

    private ShiftExecutionUseCase.EvidenceFileUploadCommand evidenceFileUpload(MultipartFile file,
                                                                                 Authentication authentication) throws IOException {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Evidence file must not be empty.");
        }
        return new ShiftExecutionUseCase.EvidenceFileUploadCommand(file.getOriginalFilename(), file.getContentType(),
                file.getInputStream(), actorId(authentication), hasRole(authentication, "P1"), hasRole(authentication, "P2"),
                hasRole(authentication, "P3"));
    }

    private ShiftExecutionUseCase.EvidenceFileActor evidenceFileActor(Authentication authentication) {
        return new ShiftExecutionUseCase.EvidenceFileActor(actorId(authentication), hasRole(authentication, "P1"),
                hasRole(authentication, "P2"), hasRole(authentication, "P3"));
    }

    private ResponseEntity<?> rangedVideo(ShiftExecutionRepository.EvidenceFileVersion file, String range) {
        var length = mediaStorage.size(file.relativePath());
        var requested = parseRange(range, length);
        if (requested == null) {
            return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    .header(HttpHeaders.CONTENT_RANGE, "bytes */" + length)
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .header(HttpHeaders.CACHE_CONTROL, "no-store")
                    .build();
        }
        var responseLength = requested.end() - requested.start() + 1;
        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .header(HttpHeaders.CONTENT_DISPOSITION, contentDisposition(file.originalFilename()))
                .header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CONTENT_RANGE, "bytes " + requested.start() + "-" + requested.end() + "/" + length)
                .contentType(MediaType.parseMediaType(file.detectedMimeType()))
                .contentLength(responseLength)
                .body(new InputStreamResource(mediaStorage.open(file.relativePath(), requested.start(), responseLength)));
    }

    private ByteRange parseRange(String range, long length) {
        if (range == null || !range.startsWith("bytes=") || range.contains(",")) {
            return null;
        }
        var values = range.substring("bytes=".length()).split("-", -1);
        if (values.length != 2 || values[0].isBlank()) {
            return null;
        }
        try {
            long start = Long.parseLong(values[0]);
            long end = values[1].isBlank() ? length - 1L : Long.parseLong(values[1]);
            if (start < 0 || start >= length || end < start) {
                return null;
            }
            return new ByteRange(start, Math.min(end, length - 1L));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private String contentDisposition(String originalFilename) {
        return "attachment; filename=\"" + originalFilename.replace("\"", "") + "\"";
    }

    private ShiftExecutionUseCase.VersionCommand executionVersion(long version, Authentication authentication) {
        return new ShiftExecutionUseCase.VersionCommand(version, actorId(authentication), hasRole(authentication, "P1"),
                hasRole(authentication, "P2"), hasRole(authentication, "P3"));
    }

    private ShiftExecutionUseCase.ReasonVersionCommand executionReasonVersion(long version, String reason,
                                                                                Authentication authentication) {
        return new ShiftExecutionUseCase.ReasonVersionCommand(version, reason, actorId(authentication),
                hasRole(authentication, "P1"), hasRole(authentication, "P2"), hasRole(authentication, "P3"));
    }

    private PersonalShiftResponse personalShift(OperationsSchedulingRepository.PersonalShift shift) {
        return new PersonalShiftResponse(shift.shiftId(), shift.operatingDayId(), shift.termId(), shift.storeId(),
                shift.operatingDate(), shift.shiftCode(), shift.shiftName(), shift.startsAt(), shift.endsAt(),
                shift.shiftStatus().name(), shift.roleCode(), shift.assignmentStatus().name(), shift.shiftVersion());
    }

    record CreateScopeGrantRequest(UUID termId, UUID storeId, UUID accountId, String roleCode) {
    }

    record CreateOperatingDayRequest(UUID termId, UUID storeId, LocalDate operatingDate, UUID templateVersionId) {
    }

    record UpdateOperatingDayRequest(LocalDate operatingDate, UUID templateVersionId, long version) {
    }

    record CreateShiftRequest(UUID operatingDayId, String code, String name, OffsetDateTime startsAt, OffsetDateTime endsAt) {
    }

    record CreateAssignmentRequest(UUID accountId, String roleCode, String reason) {
    }

    record UpdateAssignmentRequest(UUID assignmentId, String roleCode, Boolean cancelled, String reason, long version) {
    }

    record CreateEvidenceRequest(UUID taskCompletionId, UUID milestoneSubmissionId, String kind, String textContent,
                                 String externalUrl, String referenceValue, OffsetDateTime occurredAt) {
    }

    record VersionRequest(long version) {
    }

    record ReasonVersionRequest(long version, String reason) {
    }

    record ScopeGrantResponse(UUID id, UUID termId, UUID storeId, UUID accountId, String roleCode, OffsetDateTime createdAt) {
    }

    record OperatingDayResponse(UUID id, UUID termId, UUID storeId, LocalDate operatingDate, UUID templateVersionId,
                                int templateRevision, String status, long version, OffsetDateTime updatedAt) {
    }

    record ShiftResponse(UUID id, UUID operatingDayId, UUID termId, UUID storeId, LocalDate operatingDate, String code,
                         String name, OffsetDateTime startsAt, OffsetDateTime endsAt, String status,
                         String cancellationReason, long version, OffsetDateTime updatedAt) {
    }

    record AssignmentResponse(UUID id, UUID shiftId, UUID accountId, String roleCode, String status, long version,
                              OffsetDateTime updatedAt) {
    }

    record TaskCompletionResponse(UUID id, UUID shiftId, UUID assignmentId, String code, String name, String roleCode,
                                  boolean evidenceRequired, boolean p2AcceptanceRequired, String status, long version,
                                  OffsetDateTime updatedAt) {
    }

    record MilestoneResponse(UUID id, UUID shiftId, String code, String name, boolean required, boolean evidenceRequired,
                             String status, long version, OffsetDateTime updatedAt) {
    }

    record EvidenceResponse(UUID id, UUID shiftId, UUID taskCompletionId, UUID milestoneSubmissionId, String kind,
                            OffsetDateTime occurredAt, UUID submittedByAccountId, long version, OffsetDateTime updatedAt) {
    }

    record EvidenceFileResponse(UUID id, UUID evidenceId, long fileVersion, String relativePath, String originalFilename,
                                String declaredMimeType, String detectedMimeType, long byteSize, String sha256, String status,
                                String reason, OffsetDateTime createdAt, OffsetDateTime purgeAfter, OffsetDateTime purgedAt,
                                String purgeResult) {
    }

    private record ByteRange(long start, long end) {
    }

    record PersonalShiftResponse(UUID shiftId, UUID operatingDayId, UUID termId, UUID storeId, LocalDate operatingDate,
                                 String shiftCode, String shiftName, OffsetDateTime startsAt, OffsetDateTime endsAt,
                                 String shiftStatus, String roleCode, String assignmentStatus, long shiftVersion) {
    }
}
