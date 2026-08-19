package com.beverageops.learning.adapter.in.web;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.beverageops.identityaccess.domain.port.AccessTokenPort;
import com.beverageops.learning.application.usecase.CoursePreparationUseCase;
import com.beverageops.learning.domain.port.CoursePreparationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
class CoursePreparationController {

    private final CoursePreparationUseCase course;
    private final ObjectMapper objectMapper;

    CoursePreparationController(CoursePreparationUseCase course, ObjectMapper objectMapper) {
        this.course = course;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/teaching-materials")
    ResponseEntity<MaterialResponse> createMaterial(@RequestBody CreateMaterialRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(material(course.createMaterial(
                new CoursePreparationUseCase.CreateMaterialCommand(request.termId(), request.teachingWeekId(), request.title(),
                        request.content(), actor(authentication), p1(authentication), t1(authentication)))));
    }

    @PatchMapping("/teaching-materials/{materialId}")
    MaterialResponse updateMaterial(@PathVariable UUID materialId, @RequestBody UpdateMaterialRequest request,
                                    Authentication authentication) {
        return material(course.updateMaterial(materialId, new CoursePreparationUseCase.UpdateMaterialCommand(request.title(),
                request.content(), request.version(), actor(authentication), p1(authentication), t1(authentication))));
    }

    @PostMapping("/teaching-materials/{materialId}/publish")
    MaterialResponse publishMaterial(@PathVariable UUID materialId, @RequestBody VersionRequest request,
                                     Authentication authentication) {
        return material(course.publishMaterial(materialId, version(request, authentication)));
    }

    @PostMapping("/teaching-materials/{materialId}/acknowledgements")
    ResponseEntity<MaterialAcknowledgementResponse> acknowledgeMaterial(@PathVariable UUID materialId, Authentication authentication) {
        var acknowledgement = course.acknowledgeMaterial(materialId, actor(authentication), p3(authentication));
        return ResponseEntity.status(HttpStatus.CREATED).body(new MaterialAcknowledgementResponse(acknowledgement.materialId(),
                acknowledgement.termId(), acknowledgement.studentAccountId()));
    }

    @GetMapping("/teaching-materials")
    List<MaterialResponse> materials(@RequestParam UUID termId, Authentication authentication) {
        return course.materials(termId, read(authentication)).stream().map(item -> material(item, authentication)).toList();
    }

    @PostMapping("/course-tasks")
    ResponseEntity<CourseTaskResponse> createTask(@RequestBody CreateTaskRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(task(course.createTask(new CoursePreparationUseCase.CreateTaskCommand(
                request.termId(), request.teachingWeekId(), request.title(), request.instructions(), request.scopeType(), actor(authentication),
                p1(authentication), t1(authentication)))));
    }

    @PatchMapping("/course-tasks/{taskId}")
    CourseTaskResponse updateTask(@PathVariable UUID taskId, @RequestBody UpdateTaskRequest request, Authentication authentication) {
        return task(course.updateTask(taskId, new CoursePreparationUseCase.UpdateTaskCommand(request.title(), request.instructions(),
                request.scopeType(), request.version(), actor(authentication), p1(authentication), t1(authentication))));
    }

    @PostMapping("/course-tasks/{taskId}/publish")
    CourseTaskResponse publishTask(@PathVariable UUID taskId, @RequestBody VersionRequest request, Authentication authentication) {
        return task(course.publishTask(taskId, version(request, authentication)));
    }

    @GetMapping("/course-tasks")
    List<CourseTaskResponse> tasks(@RequestParam UUID termId, Authentication authentication) {
        return course.tasks(termId, read(authentication)).stream().map(this::task).toList();
    }

    @PostMapping("/course-tasks/{taskId}/submissions")
    ResponseEntity<CourseTaskSubmissionResponse> submitTask(@PathVariable UUID taskId, @RequestBody SubmitTaskRequest request,
                                                             Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(submission(course.submitTask(taskId,
                new CoursePreparationUseCase.SubmitTaskCommand(request.content(), actor(authentication), p3(authentication)))));
    }

    @GetMapping("/course-tasks/{taskId}/submissions")
    List<CourseTaskSubmissionResponse> submissions(@PathVariable UUID taskId, Authentication authentication) {
        return course.submissions(taskId, actor(authentication), read(authentication)).stream().map(this::submission).toList();
    }

    @PostMapping("/creative-works")
    ResponseEntity<CreativeWorkResponse> createCreativeWork(@RequestBody CreateCreativeWorkRequest request, Authentication authentication) {
        if (!p3(authentication)) throw new com.beverageops.identityaccess.application.usecase.ForbiddenException("Only a student can create a creative work.");
        return ResponseEntity.status(HttpStatus.CREATED).body(work(course.createCreativeWork(
                new CoursePreparationUseCase.CreateCreativeWorkCommand(request.termId(), request.teamId(), request.teachingWeekId(),
                        request.title(), request.content(), actor(authentication)))));
    }

    @PatchMapping("/creative-works/{workId}")
    CreativeWorkResponse updateCreativeWork(@PathVariable UUID workId, @RequestBody UpdateCreativeWorkRequest request,
                                            Authentication authentication) {
        if (!p3(authentication)) throw new com.beverageops.identityaccess.application.usecase.ForbiddenException("Only a student can update a creative work.");
        return work(course.updateCreativeWork(workId, new CoursePreparationUseCase.UpdateCreativeWorkCommand(request.title(),
                request.content(), request.version(), actor(authentication))));
    }

    @PostMapping("/creative-works/{workId}/publish")
    CreativeWorkResponse publishCreativeWork(@PathVariable UUID workId, @RequestBody VersionRequest request, Authentication authentication) {
        return work(course.publishCreativeWork(workId, version(request, authentication)));
    }

    @PostMapping("/creative-works/{workId}/feedback")
    ResponseEntity<CreativeWorkFeedbackResponse> feedbackCreativeWork(@PathVariable UUID workId,
                                                                       @RequestBody CreativeWorkFeedbackRequest request,
                                                                       Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(feedback(course.feedbackCreativeWork(workId,
                new CoursePreparationUseCase.FeedbackCommand(request.workRevision(), request.comment(), actor(authentication),
                        p1(authentication), t1(authentication)))));
    }

    @GetMapping("/creative-works/{workId}/feedback")
    List<CreativeWorkFeedbackResponse> creativeWorkFeedback(@PathVariable UUID workId, Authentication authentication) {
        course.creativeWork(workId, read(authentication));
        return course.creativeWorkFeedback(workId).stream().map(this::feedback).toList();
    }

    @GetMapping("/creative-works/{workId}")
    CreativeWorkResponse creativeWork(@PathVariable UUID workId, Authentication authentication) {
        return work(course.creativeWork(workId, read(authentication)));
    }

    @GetMapping("/creative-works")
    List<CreativeWorkResponse> creativeWorks(@RequestParam UUID termId, Authentication authentication) {
        return course.creativeWorks(termId, read(authentication)).stream().map(this::work).toList();
    }

    @PostMapping("/reflections")
    ResponseEntity<ReflectionResponse> createReflection(@RequestBody CreateReflectionRequest request, Authentication authentication) {
        if (!p3(authentication)) throw new com.beverageops.identityaccess.application.usecase.ForbiddenException("Only a student can create a reflection.");
        return ResponseEntity.status(HttpStatus.CREATED).body(reflection(course.createReflection(
                new CoursePreparationUseCase.CreateReflectionCommand(request.termId(), request.teachingWeekId(), request.content(),
                        request.improvementPlan(), actor(authentication)))));
    }

    @PatchMapping("/reflections/{reflectionId}")
    ReflectionResponse updateReflection(@PathVariable UUID reflectionId, @RequestBody UpdateReflectionRequest request,
                                        Authentication authentication) {
        if (!p3(authentication)) throw new com.beverageops.identityaccess.application.usecase.ForbiddenException("Only a student can update a reflection.");
        return reflection(course.updateReflection(reflectionId, new CoursePreparationUseCase.UpdateReflectionCommand(request.content(),
                request.improvementPlan(), request.version(), actor(authentication))));
    }

    @GetMapping("/reflections/{reflectionId}")
    ReflectionResponse reflection(@PathVariable UUID reflectionId, Authentication authentication) {
        return reflection(course.reflection(reflectionId, actor(authentication), p3(authentication), p1(authentication), t1(authentication)));
    }

    @GetMapping("/reflections")
    List<ReflectionResponse> reflections(Authentication authentication) {
        return course.reflections(actor(authentication), p3(authentication), p1(authentication), t1(authentication)).stream()
                .map(this::reflection).toList();
    }

    private CoursePreparationUseCase.VersionCommand version(VersionRequest request, Authentication authentication) {
        return new CoursePreparationUseCase.VersionCommand(request.version(), actor(authentication), p1(authentication), t1(authentication));
    }

    private CoursePreparationUseCase.ReadCommand read(Authentication authentication) {
        return new CoursePreparationUseCase.ReadCommand(actor(authentication), p1(authentication), t1(authentication), p3(authentication));
    }

    private UUID actor(Authentication authentication) {
        if (authentication.getPrincipal() instanceof AccessTokenPort.AuthenticatedToken token) return token.accountId();
        return UUID.fromString(authentication.getName());
    }

    private boolean p1(Authentication authentication) { return role(authentication, "P1"); }
    private boolean t1(Authentication authentication) { return role(authentication, "T1"); }
    private boolean p3(Authentication authentication) { return role(authentication, "P3"); }
    private boolean role(Authentication authentication, String role) {
        return authentication.getAuthorities().stream().anyMatch(item -> item.getAuthority().equals("ROLE_" + role));
    }

    private MaterialResponse material(CoursePreparationRepository.TeachingMaterial value) { return material(value, (Authentication) null); }
    private MaterialResponse material(CoursePreparationRepository.TeachingMaterial value, Authentication authentication) {
        return new MaterialResponse(value.id(), value.termId(), value.teachingWeekId(), value.title(), json(value.contentJson()),
                value.status().name(), authentication != null && course.materialAcknowledged(value.id(), actor(authentication), p3(authentication)),
                value.version(), value.createdAt(), value.updatedAt());
    }
    private CourseTaskResponse task(CoursePreparationRepository.CourseTask value) {
        return new CourseTaskResponse(value.id(), value.termId(), value.teachingWeekId(), value.title(), value.instructions(), value.scopeType(),
                value.status().name(), value.version(), value.createdAt(), value.updatedAt());
    }
    private CourseTaskSubmissionResponse submission(CoursePreparationRepository.CourseTaskSubmission value) {
        return new CourseTaskSubmissionResponse(value.id(), value.taskId(), value.termId(), value.studentAccountId(), value.teamId(),
                value.revision(), json(value.contentJson()), value.status(), value.createdAt());
    }
    private CreativeWorkResponse work(CoursePreparationRepository.CreativeWork value) {
        return new CreativeWorkResponse(value.id(), value.termId(), value.teamId(), value.teachingWeekId(), value.title(),
                json(value.currentContentJson()), value.status().name(), value.currentRevision(), value.version(), value.createdAt(), value.updatedAt());
    }
    private CreativeWorkFeedbackResponse feedback(CoursePreparationRepository.CreativeWorkFeedback value) {
        return new CreativeWorkFeedbackResponse(value.id(), value.creativeWorkId(), value.workRevision(), value.teacherAccountId(),
                value.comment(), value.createdAt());
    }
    private ReflectionResponse reflection(CoursePreparationRepository.Reflection value) {
        return new ReflectionResponse(value.id(), value.termId(), value.teachingWeekId(), value.studentAccountId(), value.content(),
                value.improvementPlan(), value.status(), value.version(), value.createdAt(), value.updatedAt());
    }
    private JsonNode json(String source) {
        try { return objectMapper.readTree(source); }
        catch (Exception exception) { throw new IllegalStateException("Course resource JSON is invalid."); }
    }

    record CreateMaterialRequest(UUID termId, UUID teachingWeekId, String title, JsonNode content) {}
    record UpdateMaterialRequest(String title, JsonNode content, long version) {}
    record VersionRequest(long version) {}
    record CreateTaskRequest(UUID termId, UUID teachingWeekId, String title, String instructions, String scopeType) {}
    record UpdateTaskRequest(String title, String instructions, String scopeType, long version) {}
    record SubmitTaskRequest(JsonNode content) {}
    record CreateCreativeWorkRequest(UUID termId, UUID teamId, UUID teachingWeekId, String title, JsonNode content) {}
    record UpdateCreativeWorkRequest(String title, JsonNode content, long version) {}
    record CreativeWorkFeedbackRequest(Integer workRevision, String comment) {}
    record CreateReflectionRequest(UUID termId, UUID teachingWeekId, String content, String improvementPlan) {}
    record UpdateReflectionRequest(String content, String improvementPlan, long version) {}
    record MaterialResponse(UUID id, UUID termId, UUID teachingWeekId, String title, JsonNode content, String status,
                            boolean acknowledged, long version, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
    record MaterialAcknowledgementResponse(UUID materialId, UUID termId, UUID studentAccountId) {}
    record CourseTaskResponse(UUID id, UUID termId, UUID teachingWeekId, String title, String instructions, String scopeType,
                              String status, long version, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
    record CourseTaskSubmissionResponse(UUID id, UUID taskId, UUID termId, UUID studentAccountId, UUID teamId, int revision,
                                        JsonNode content, String status, OffsetDateTime createdAt) {}
    record CreativeWorkResponse(UUID id, UUID termId, UUID teamId, UUID teachingWeekId, String title, JsonNode content, String status,
                                int currentRevision, long version, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
    record CreativeWorkFeedbackResponse(UUID id, UUID creativeWorkId, int workRevision, UUID teacherAccountId, String comment,
                                        OffsetDateTime createdAt) {}
    record ReflectionResponse(UUID id, UUID termId, UUID teachingWeekId, UUID studentAccountId, String content,
                              String improvementPlan, String status, long version, OffsetDateTime createdAt, OffsetDateTime updatedAt) {}
}
