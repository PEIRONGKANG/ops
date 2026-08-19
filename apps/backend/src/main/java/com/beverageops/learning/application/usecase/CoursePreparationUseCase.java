package com.beverageops.learning.application.usecase;

import java.util.List;
import java.util.UUID;

import com.beverageops.governance.application.usecase.VersionConflictException;
import com.beverageops.identityaccess.application.usecase.ForbiddenException;
import com.beverageops.identityaccess.application.usecase.ResourceNotFoundException;
import com.beverageops.learning.domain.model.CourseResourceStatus;
import com.beverageops.learning.domain.port.CoursePreparationRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class CoursePreparationUseCase {

    private final CoursePreparationRepository course;
    private final ObjectMapper objectMapper;

    public CoursePreparationUseCase(CoursePreparationRepository course, ObjectMapper objectMapper) {
        this.course = course;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public CoursePreparationRepository.TeachingMaterial createMaterial(CreateMaterialCommand command) {
        teacherOrP1(command.actorId(), command.p1(), command.t1(), command.termId());
        requireWeek(command.termId(), command.teachingWeekId());
        var material = course.createMaterial(UUID.randomUUID(), command.termId(), command.teachingWeekId(),
                text(command.title(), "Title", 200), json(command.content(), "Content"), command.actorId());
        audit("TEACHING_MATERIAL_CREATED", "TEACHING_MATERIAL", material.id(), command.actorId(), null, null, material.version());
        return material;
    }

    @Transactional
    public CoursePreparationRepository.TeachingMaterial updateMaterial(UUID materialId, UpdateMaterialCommand command) {
        var current = material(materialId);
        teacherOrP1(command.actorId(), command.p1(), command.t1(), current.termId());
        version(current.version(), command.version());
        if (current.status() != CourseResourceStatus.DRAFT) {
            throw new IllegalStateException("A published teaching material cannot be changed in place.");
        }
        var updated = update(() -> course.updateMaterial(materialId, text(command.title(), "Title", 200),
                json(command.content(), "Content"), command.version()));
        audit("TEACHING_MATERIAL_UPDATED", "TEACHING_MATERIAL", materialId, command.actorId(), null,
                current.version(), updated.version());
        return updated;
    }

    @Transactional
    public CoursePreparationRepository.TeachingMaterial publishMaterial(UUID materialId, VersionCommand command) {
        var current = material(materialId);
        teacherOrP1(command.actorId(), command.p1(), command.t1(), current.termId());
        version(current.version(), command.version());
        if (current.status() != CourseResourceStatus.DRAFT) {
            throw new IllegalStateException("Only a draft teaching material can be published.");
        }
        var published = update(() -> course.publishMaterial(materialId, command.actorId(), command.version()));
        audit("TEACHING_MATERIAL_PUBLISHED", "TEACHING_MATERIAL", materialId, command.actorId(), null,
                current.version(), published.version());
        return published;
    }

    @Transactional
    public MaterialAcknowledgement acknowledgeMaterial(UUID materialId, UUID actorId, boolean p3) {
        if (!p3) {
            throw new ForbiddenException("Only a student can acknowledge teaching material.");
        }
        var material = material(materialId);
        if (material.status() != CourseResourceStatus.PUBLISHED) {
            throw new IllegalStateException("Only published teaching material can be acknowledged.");
        }
        requireStudent(material.termId(), actorId);
        course.acknowledgeMaterial(material.id(), material.termId(), actorId);
        audit("TEACHING_MATERIAL_ACKNOWLEDGED", "TEACHING_MATERIAL", material.id(), actorId, null, null, null);
        return new MaterialAcknowledgement(material.id(), material.termId(), actorId);
    }

    @Transactional
    public List<CoursePreparationRepository.TeachingMaterial> materials(UUID termId, ReadCommand command) {
        if (command.p3()) {
            requireStudent(termId, command.actorId());
            return course.findMaterials(termId, true);
        }
        teacherOrP1(command.actorId(), command.p1(), command.t1(), termId);
        return course.findMaterials(termId, false);
    }

    @Transactional(readOnly = true)
    public boolean materialAcknowledged(UUID materialId, UUID actorId, boolean p3) {
        if (!p3) return false;
        var current = course.findMaterial(materialId).orElseThrow(() -> new ResourceNotFoundException("Teaching material not found."));
        requireStudent(current.termId(), actorId);
        return course.isMaterialAcknowledged(materialId, actorId);
    }

    @Transactional
    public CoursePreparationRepository.CourseTask createTask(CreateTaskCommand command) {
        teacherOrP1(command.actorId(), command.p1(), command.t1(), command.termId());
        requireWeek(command.termId(), command.teachingWeekId());
        var task = course.createTask(UUID.randomUUID(), command.termId(), command.teachingWeekId(), text(command.title(), "Title", 200),
                text(command.instructions(), "Instructions", 4000), scopeType(command.scopeType()), command.actorId());
        audit("COURSE_TASK_CREATED", "COURSE_TASK", task.id(), command.actorId(), null, null, task.version());
        return task;
    }

    @Transactional
    public CoursePreparationRepository.CourseTask updateTask(UUID taskId, UpdateTaskCommand command) {
        var current = task(taskId);
        teacherOrP1(command.actorId(), command.p1(), command.t1(), current.termId());
        version(current.version(), command.version());
        if (current.status() != CourseResourceStatus.DRAFT) {
            throw new IllegalStateException("A published course task cannot be changed in place.");
        }
        var updated = update(() -> course.updateTask(taskId, text(command.title(), "Title", 200),
                text(command.instructions(), "Instructions", 4000), scopeType(command.scopeType()), command.version()));
        audit("COURSE_TASK_UPDATED", "COURSE_TASK", taskId, command.actorId(), null, current.version(), updated.version());
        return updated;
    }

    @Transactional
    public CoursePreparationRepository.CourseTask publishTask(UUID taskId, VersionCommand command) {
        var current = task(taskId);
        teacherOrP1(command.actorId(), command.p1(), command.t1(), current.termId());
        version(current.version(), command.version());
        if (current.status() != CourseResourceStatus.DRAFT) {
            throw new IllegalStateException("Only a draft course task can be published.");
        }
        var published = update(() -> course.publishTask(taskId, command.actorId(), command.version()));
        audit("COURSE_TASK_PUBLISHED", "COURSE_TASK", taskId, command.actorId(), null, current.version(), published.version());
        return published;
    }

    @Transactional
    public List<CoursePreparationRepository.CourseTask> tasks(UUID termId, ReadCommand command) {
        if (command.p3()) {
            requireStudent(termId, command.actorId());
            return course.findTasks(termId, true);
        }
        teacherOrP1(command.actorId(), command.p1(), command.t1(), termId);
        return course.findTasks(termId, false);
    }

    @Transactional
    public CoursePreparationRepository.CourseTaskSubmission submitTask(UUID taskId, SubmitTaskCommand command) {
        if (!command.p3()) {
            throw new ForbiddenException("Only a student can submit a course task.");
        }
        var task = task(taskId);
        if (task.status() != CourseResourceStatus.PUBLISHED) {
            throw new IllegalStateException("Only a published course task can receive submissions.");
        }
        requireStudent(task.termId(), command.actorId());
        var membership = course.findActiveTeamMembership(task.termId(), command.actorId());
        UUID teamId = null;
        if ("TEAM".equals(task.scopeType())) {
            teamId = membership.orElseThrow(() -> new ForbiddenException("A team membership is required for this task.")).teamId();
        } else {
            teamId = membership.map(CoursePreparationRepository.TeamMembership::teamId).orElse(null);
        }
        var submission = course.createSubmission(UUID.randomUUID(), task.id(), task.termId(), command.actorId(), teamId,
                course.nextSubmissionRevision(task.id(), command.actorId()), json(command.content(), "Content"));
        audit("COURSE_TASK_SUBMISSION_CREATED", "COURSE_TASK_SUBMISSION", submission.id(), command.actorId(), null, null,
                (long) submission.revision());
        return submission;
    }

    @Transactional
    public List<CoursePreparationRepository.CourseTaskSubmission> submissions(UUID taskId, UUID actorId, ReadCommand command) {
        var task = task(taskId);
        if (command.p3()) {
            requireStudent(task.termId(), actorId);
            if ("TEAM".equals(task.scopeType())) {
                var team = course.findActiveTeamMembership(task.termId(), actorId)
                        .orElseThrow(() -> new ForbiddenException("A team membership is required for this task."));
                return course.findSubmissionsForTeam(task.id(), team.teamId());
            }
            return course.findSubmissionsForStudent(task.id(), actorId);
        }
        teacherOrP1(actorId, command.p1(), command.t1(), task.termId());
        return course.findSubmissions(task.id());
    }

    @Transactional
    public CoursePreparationRepository.CreativeWork createCreativeWork(CreateCreativeWorkCommand command) {
        requireStudent(command.termId(), command.actorId());
        var membership = course.findActiveTeamMembership(command.termId(), command.actorId())
                .orElseThrow(() -> new ForbiddenException("A team membership is required for a creative work."));
        if (!membership.teamId().equals(command.teamId())) {
            throw new ForbiddenException("A creative work must belong to the student's team.");
        }
        requireWeek(command.termId(), command.teachingWeekId());
        var work = course.createCreativeWork(UUID.randomUUID(), command.termId(), command.teamId(), command.teachingWeekId(),
                text(command.title(), "Title", 200), json(command.content(), "Content"), command.actorId());
        audit("CREATIVE_WORK_CREATED", "CREATIVE_WORK", work.id(), command.actorId(), null, null, work.version());
        return work;
    }

    @Transactional
    public CoursePreparationRepository.CreativeWork updateCreativeWork(UUID workId, UpdateCreativeWorkCommand command) {
        var current = creativeWork(workId);
        requireStudent(current.termId(), command.actorId());
        requireTeamMember(current.termId(), current.teamId(), command.actorId());
        version(current.version(), command.version());
        if (current.status() != CourseResourceStatus.DRAFT) {
            throw new IllegalStateException("A published creative work cannot be changed in place.");
        }
        var updated = update(() -> course.updateCreativeWork(workId, text(command.title(), "Title", 200),
                json(command.content(), "Content"), command.actorId(), command.version()));
        audit("CREATIVE_WORK_UPDATED", "CREATIVE_WORK", workId, command.actorId(), null, current.version(), updated.version());
        return updated;
    }

    @Transactional
    public CoursePreparationRepository.CreativeWork publishCreativeWork(UUID workId, VersionCommand command) {
        var current = creativeWork(workId);
        teacherOrP1(command.actorId(), command.p1(), command.t1(), current.termId());
        version(current.version(), command.version());
        if (current.status() != CourseResourceStatus.DRAFT) {
            throw new IllegalStateException("Only a draft creative work can be published.");
        }
        var published = update(() -> course.publishCreativeWork(workId, command.actorId(), command.version()));
        audit("CREATIVE_WORK_PUBLISHED", "CREATIVE_WORK", workId, command.actorId(), null, current.version(), published.version());
        return published;
    }

    @Transactional
    public CoursePreparationRepository.CreativeWork creativeWork(UUID workId, ReadCommand command) {
        var work = creativeWork(workId);
        if (command.p3()) {
            requireStudent(work.termId(), command.actorId());
            requireTeamMember(work.termId(), work.teamId(), command.actorId());
        } else {
            teacherOrP1(command.actorId(), command.p1(), command.t1(), work.termId());
        }
        return work;
    }

    @Transactional(readOnly = true)
    public List<CoursePreparationRepository.CreativeWork> creativeWorks(UUID termId, ReadCommand command) {
        UUID teamId = null;
        if (command.p3()) {
            requireStudent(termId, command.actorId());
            teamId = course.findActiveTeamMembership(termId, command.actorId())
                    .orElseThrow(() -> new ForbiddenException("A team membership is required to view creative works.")).teamId();
        } else {
            teacherOrP1(command.actorId(), command.p1(), command.t1(), termId);
        }
        return course.findCreativeWorks(termId, teamId, false);
    }

    @Transactional
    public CoursePreparationRepository.CreativeWorkFeedback feedbackCreativeWork(UUID workId, FeedbackCommand command) {
        var work = creativeWork(workId);
        teacherOrP1(command.actorId(), command.p1(), command.t1(), work.termId());
        var revision = command.workRevision() == null ? work.currentRevision() : command.workRevision();
        course.findCreativeWorkVersion(work.id(), revision).orElseThrow(() -> new ResourceNotFoundException("Creative work revision not found."));
        var feedback = course.addCreativeWorkFeedback(UUID.randomUUID(), work.id(), revision, command.actorId(),
                text(command.comment(), "Comment", 4000));
        audit("CREATIVE_WORK_FEEDBACK_CREATED", "CREATIVE_WORK_FEEDBACK", feedback.id(), command.actorId(), null, null, null);
        return feedback;
    }

    @Transactional(readOnly = true)
    public List<CoursePreparationRepository.CreativeWorkFeedback> creativeWorkFeedback(UUID workId) {
        return course.findCreativeWorkFeedback(workId);
    }

    @Transactional
    public CoursePreparationRepository.Reflection createReflection(CreateReflectionCommand command) {
        requireStudent(command.termId(), command.actorId());
        requireWeek(command.termId(), command.teachingWeekId());
        var reflection = course.createReflection(UUID.randomUUID(), command.termId(), command.teachingWeekId(), command.actorId(),
                text(command.content(), "Content", 4000), text(command.improvementPlan(), "Improvement plan", 4000));
        audit("REFLECTION_CREATED", "REFLECTION", reflection.id(), command.actorId(), null, null, reflection.version());
        return reflection;
    }

    @Transactional
    public CoursePreparationRepository.Reflection updateReflection(UUID reflectionId, UpdateReflectionCommand command) {
        var current = reflection(reflectionId);
        requireStudent(current.termId(), command.actorId());
        if (!current.studentAccountId().equals(command.actorId())) {
            throw new ForbiddenException("Only the reflection owner can edit it.");
        }
        version(current.version(), command.version());
        var updated = update(() -> course.updateReflection(reflectionId, text(command.content(), "Content", 4000),
                text(command.improvementPlan(), "Improvement plan", 4000), command.version()));
        audit("REFLECTION_UPDATED", "REFLECTION", reflectionId, command.actorId(), null, current.version(), updated.version());
        return updated;
    }

    @Transactional
    public CoursePreparationRepository.Reflection reflection(UUID reflectionId, UUID actorId, boolean p3, boolean p1, boolean t1) {
        var reflection = reflection(reflectionId);
        if (p3) {
            if (!reflection.studentAccountId().equals(actorId)) throw new ForbiddenException("Only the reflection owner can view it.");
        } else teacherOrP1(actorId, p1, t1, reflection.termId());
        return reflection;
    }

    @Transactional(readOnly = true)
    public List<CoursePreparationRepository.Reflection> reflections(UUID actorId, boolean p3, boolean p1, boolean t1) {
        if (!p3) throw new ForbiddenException("Only students can view personal reflections.");
        return course.findReflectionsForStudent(actorId);
    }

    private CoursePreparationRepository.TeachingMaterial material(UUID id) {
        return course.lockMaterial(id).orElseThrow(() -> new ResourceNotFoundException("Teaching material not found."));
    }

    private CoursePreparationRepository.CourseTask task(UUID id) {
        return course.lockTask(id).orElseThrow(() -> new ResourceNotFoundException("Course task not found."));
    }

    private CoursePreparationRepository.CreativeWork creativeWork(UUID id) {
        return course.lockCreativeWork(id).orElseThrow(() -> new ResourceNotFoundException("Creative work not found."));
    }

    private CoursePreparationRepository.Reflection reflection(UUID id) {
        return course.lockReflection(id).orElseThrow(() -> new ResourceNotFoundException("Reflection not found."));
    }

    private void requireWeek(UUID termId, UUID weekId) {
        var week = course.findTeachingWeek(weekId).orElseThrow(() -> new ResourceNotFoundException("Teaching week not found."));
        if (!termId.equals(week.termId())) throw new ForbiddenException("The teaching week is outside the term.");
    }

    private void requireStudent(UUID termId, UUID accountId) {
        if (!course.isActiveStudent(termId, accountId)) throw new ForbiddenException("The account is not an active P3 student in this term.");
    }

    private void requireTeamMember(UUID termId, UUID teamId, UUID accountId) {
        var membership = course.findActiveTeamMembership(termId, accountId)
                .orElseThrow(() -> new ForbiddenException("A team membership is required."));
        if (!teamId.equals(membership.teamId())) throw new ForbiddenException("The account is outside the team's scope.");
    }

    private void teacherOrP1(UUID actorId, boolean p1, boolean t1, UUID termId) {
        if (p1) return;
        if (!t1 || !course.hasTeacherMembership(termId, actorId)) throw new ForbiddenException("Only a scoped T1 or P1 can perform this course operation.");
    }

    private void version(long actual, long expected) {
        if (actual != expected) throw new VersionConflictException("The resource has changed. Refresh and try again.");
    }

    private <T> T update(java.util.function.Supplier<T> action) {
        try { return action.get(); }
        catch (EmptyResultDataAccessException exception) { throw new VersionConflictException("The resource has changed. Refresh and try again."); }
    }

    private String scopeType(String value) {
        if (value == null || (!value.equals("INDIVIDUAL") && !value.equals("TEAM"))) throw new IllegalArgumentException("Scope type must be INDIVIDUAL or TEAM.");
        return value;
    }

    private String json(JsonNode value, String field) {
        if (value == null || !value.isObject()) throw new IllegalArgumentException(field + " must be a JSON object.");
        return value.toString();
    }

    private String text(String value, String field, int max) {
        if (value == null || value.isBlank() || value.trim().length() > max) throw new IllegalArgumentException(field + " must contain 1 to " + max + " characters.");
        return value.trim();
    }

    private void audit(String event, String resourceType, UUID resourceId, UUID actorId, String reason, Long previous, Long next) {
        course.appendAudit(event, resourceType, resourceId, actorId, reason, previous, next);
    }

    public record CreateMaterialCommand(UUID termId, UUID teachingWeekId, String title, JsonNode content, UUID actorId, boolean p1, boolean t1) {}
    public record UpdateMaterialCommand(String title, JsonNode content, long version, UUID actorId, boolean p1, boolean t1) {}
    public record VersionCommand(long version, UUID actorId, boolean p1, boolean t1) {}
    public record ReadCommand(UUID actorId, boolean p1, boolean t1, boolean p3) {}
    public record MaterialAcknowledgement(UUID materialId, UUID termId, UUID studentAccountId) {}
    public record CreateTaskCommand(UUID termId, UUID teachingWeekId, String title, String instructions, String scopeType, UUID actorId, boolean p1, boolean t1) {}
    public record UpdateTaskCommand(String title, String instructions, String scopeType, long version, UUID actorId, boolean p1, boolean t1) {}
    public record SubmitTaskCommand(JsonNode content, UUID actorId, boolean p3) {}
    public record CreateCreativeWorkCommand(UUID termId, UUID teamId, UUID teachingWeekId, String title, JsonNode content, UUID actorId) {}
    public record UpdateCreativeWorkCommand(String title, JsonNode content, long version, UUID actorId) {}
    public record FeedbackCommand(Integer workRevision, String comment, UUID actorId, boolean p1, boolean t1) {}
    public record CreateReflectionCommand(UUID termId, UUID teachingWeekId, String content, String improvementPlan, UUID actorId) {}
    public record UpdateReflectionCommand(String content, String improvementPlan, long version, UUID actorId) {}
}
