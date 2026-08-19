package com.beverageops.learning.domain.port;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.learning.domain.model.CourseResourceStatus;

public interface CoursePreparationRepository {

    boolean isActiveStudent(UUID termId, UUID accountId);

    Optional<TeamMembership> findActiveTeamMembership(UUID termId, UUID accountId);

    Optional<TeachingWeek> findTeachingWeek(UUID teachingWeekId);

    boolean hasTeacherMembership(UUID termId, UUID accountId);

    TeachingMaterial createMaterial(UUID id, UUID termId, UUID teachingWeekId, String title, String contentJson, UUID actorId);

    Optional<TeachingMaterial> lockMaterial(UUID materialId);

    Optional<TeachingMaterial> findMaterial(UUID materialId);

    TeachingMaterial updateMaterial(UUID materialId, String title, String contentJson, long expectedVersion);

    TeachingMaterial publishMaterial(UUID materialId, UUID actorId, long expectedVersion);

    void acknowledgeMaterial(UUID materialId, UUID termId, UUID studentAccountId);

    boolean isMaterialAcknowledged(UUID materialId, UUID studentAccountId);

    List<TeachingMaterial> findMaterials(UUID termId, boolean publishedOnly);

    CourseTask createTask(UUID id, UUID termId, UUID teachingWeekId, String title, String instructions, String scopeType,
                          UUID actorId);

    Optional<CourseTask> lockTask(UUID taskId);

    CourseTask updateTask(UUID taskId, String title, String instructions, String scopeType, long expectedVersion);

    CourseTask publishTask(UUID taskId, UUID actorId, long expectedVersion);

    List<CourseTask> findTasks(UUID termId, boolean publishedOnly);

    int nextSubmissionRevision(UUID taskId, UUID studentAccountId);

    CourseTaskSubmission createSubmission(UUID id, UUID taskId, UUID termId, UUID studentAccountId, UUID teamId,
                                          int revision, String contentJson);

    List<CourseTaskSubmission> findSubmissionsForStudent(UUID taskId, UUID studentAccountId);

    List<CourseTaskSubmission> findSubmissionsForTeam(UUID taskId, UUID teamId);

    List<CourseTaskSubmission> findSubmissions(UUID taskId);

    CreativeWork createCreativeWork(UUID id, UUID termId, UUID teamId, UUID teachingWeekId, String title,
                                    String contentJson, UUID actorId);

    Optional<CreativeWork> lockCreativeWork(UUID creativeWorkId);

    Optional<CreativeWork> findCreativeWork(UUID creativeWorkId);

    CreativeWork updateCreativeWork(UUID creativeWorkId, String title, String contentJson, UUID actorId,
                                    long expectedVersion);

    CreativeWork publishCreativeWork(UUID creativeWorkId, UUID actorId, long expectedVersion);

    Optional<CreativeWorkVersion> findCreativeWorkVersion(UUID creativeWorkId, int revision);

    CreativeWorkFeedback addCreativeWorkFeedback(UUID id, UUID creativeWorkId, int workRevision, UUID teacherAccountId,
                                                 String comment);

    List<CreativeWorkFeedback> findCreativeWorkFeedback(UUID creativeWorkId);

    List<CreativeWork> findCreativeWorks(UUID termId, UUID teamId, boolean publishedOnly);

    Reflection createReflection(UUID id, UUID termId, UUID teachingWeekId, UUID studentAccountId, String content,
                                String improvementPlan);

    Optional<Reflection> lockReflection(UUID reflectionId);

    Reflection updateReflection(UUID reflectionId, String content, String improvementPlan, long expectedVersion);

    List<Reflection> findReflectionsForStudent(UUID studentAccountId);

    void appendAudit(String eventType, String resourceType, UUID resourceId, UUID actorId, String reason,
                     Long previousVersion, Long newVersion);

    record TeamMembership(UUID termId, UUID teamId) {
    }

    record TeachingWeek(UUID id, UUID termId, String phaseCode) {
    }

    record TeachingMaterial(UUID id, UUID termId, UUID teachingWeekId, String title, String contentJson,
                            CourseResourceStatus status, long version, UUID createdByAccountId,
                            OffsetDateTime createdAt, OffsetDateTime updatedAt) {
    }

    record CourseTask(UUID id, UUID termId, UUID teachingWeekId, String title, String instructions, String scopeType,
                      CourseResourceStatus status, long version, UUID createdByAccountId,
                      OffsetDateTime createdAt, OffsetDateTime updatedAt) {
    }

    record CourseTaskSubmission(UUID id, UUID taskId, UUID termId, UUID studentAccountId, UUID teamId, int revision,
                                String contentJson, String status, OffsetDateTime createdAt) {
    }

    record CreativeWork(UUID id, UUID termId, UUID teamId, UUID teachingWeekId, String title, String currentContentJson,
                        CourseResourceStatus status, int currentRevision, long version, UUID createdByAccountId,
                        OffsetDateTime createdAt, OffsetDateTime updatedAt) {
    }

    record CreativeWorkVersion(UUID id, UUID creativeWorkId, int revision, String contentJson, UUID createdByAccountId,
                               OffsetDateTime createdAt) {
    }

    record CreativeWorkFeedback(UUID id, UUID creativeWorkId, int workRevision, UUID teacherAccountId, String comment,
                                OffsetDateTime createdAt) {
    }

    record Reflection(UUID id, UUID termId, UUID teachingWeekId, UUID studentAccountId, String content,
                      String improvementPlan, String status, long version, OffsetDateTime createdAt,
                      OffsetDateTime updatedAt) {
    }
}
