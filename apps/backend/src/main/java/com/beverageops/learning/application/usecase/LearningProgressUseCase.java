package com.beverageops.learning.application.usecase;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.beverageops.governance.application.usecase.VersionConflictException;
import com.beverageops.governance.domain.policy.CertificationRulePolicy;
import com.beverageops.identityaccess.application.usecase.ForbiddenException;
import com.beverageops.identityaccess.application.usecase.ResourceNotFoundException;
import com.beverageops.learning.domain.model.CertificationStatus;
import com.beverageops.learning.domain.model.RetrainingStatus;
import com.beverageops.learning.domain.port.LearningProgressRepository;
import com.beverageops.operations.application.usecase.EvidenceRequiredException;
import com.beverageops.shared.notification.application.event.OperationalNotificationRequested;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LearningProgressUseCase {

    private final LearningProgressRepository learning;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher events;

    public LearningProgressUseCase(LearningProgressRepository learning, ObjectMapper objectMapper, ApplicationEventPublisher events) {
        this.learning = learning;
        this.objectMapper = objectMapper;
        this.events = events;
    }

    @Transactional
    public LearningProgressRepository.Feedback createFeedback(CreateFeedbackCommand command) {
        requireT1OrP1(command.p1(), command.t1());
        require(command.studentAccountId(), "Student account");
        var scope = referenceScope(command.shiftId(), command.taskCompletionId(), command.incidentId(), command.evidenceId());
        requireTeacherScope(command.actorId(), command.p1(), scope.termId(), scope.storeId());
        requireStudentMembership(scope.termId(), command.studentAccountId());
        if (!learning.isStudentAssignedToShift(scope.shiftId(), command.studentAccountId())) {
            throw new ForbiddenException("The student is not assigned to the referenced shift.");
        }
        requireReferenceStudent(command.studentAccountId(), command.taskCompletionId(), command.incidentId(), command.evidenceId());
        var requiresRetraining = command.requiresRetraining();
        var dueAt = requiresRetraining ? requiredDate(command.retrainingDueAt(), "Retraining due time") : command.retrainingDueAt();
        var feedback = learning.createFeedback(UUID.randomUUID(), scope.termId(), scope.storeId(), command.studentAccountId(),
                scope.shiftId(), command.taskCompletionId(), command.incidentId(), command.evidenceId(),
                requiredText(command.observation(), "Observation", 2000), requiredText(command.recommendation(), "Recommendation", 2000),
                requiresRetraining, dueAt, command.actorId());
        learning.appendFeedbackHistory(feedback.id(), "FEEDBACK_CREATED", command.actorId(), null, null, feedback.version());
        audit("LEARNING_FEEDBACK_CREATED", "LEARNING_FEEDBACK", feedback.id(), command.actorId(), null, null, feedback.version());
        if (requiresRetraining) {
            var retraining = learning.createRetraining(UUID.randomUUID(), feedback.id(), feedback.termId(), feedback.storeId(),
                    feedback.studentAccountId(), dueAt, command.actorId());
            learning.appendRetrainingAction(retraining.id(), "RETRAINING_CREATED", command.actorId(), null, null,
                    RetrainingStatus.PENDING, null, retraining.version());
            audit("RETRAINING_CREATED", "RETRAINING", retraining.id(), command.actorId(), null, null, retraining.version());
            notify(command.studentAccountId(), "RETRAINING_ASSIGNED", "RETRAINING", retraining.id(), "需要完成补训",
                    "带教反馈要求你完成补训并提交过程证据。", command.actorId());
        }
        notify(command.studentAccountId(), "LEARNING_FEEDBACK_CREATED", "LEARNING_FEEDBACK", feedback.id(), "收到带教反馈",
                "请查看带教观察和改进建议。", command.actorId());
        return feedback;
    }

    @Transactional
    public LearningProgressRepository.Feedback updateFeedback(UUID feedbackId, UpdateFeedbackCommand command) {
        requireT1OrP1(command.p1(), command.t1());
        var feedback = feedback(feedbackId);
        requireTeacherScope(command.actorId(), command.p1(), feedback.termId(), feedback.storeId());
        requireVersion(feedback.version(), command.version());
        if (feedback.requiresRetraining() != command.requiresRetraining()) {
            throw new IllegalStateException("Changing the retraining requirement creates a new feedback record; it cannot rewrite history.");
        }
        var updated = learning.updateFeedback(feedback.id(), requiredText(command.observation(), "Observation", 2000),
                requiredText(command.recommendation(), "Recommendation", 2000), feedback.requiresRetraining(),
                feedback.requiresRetraining() ? requiredDate(command.retrainingDueAt(), "Retraining due time") : command.retrainingDueAt(),
                command.version());
        learning.appendFeedbackHistory(updated.id(), "FEEDBACK_UPDATED", command.actorId(), null, feedback.version(), updated.version());
        audit("LEARNING_FEEDBACK_UPDATED", "LEARNING_FEEDBACK", updated.id(), command.actorId(), null,
                feedback.version(), updated.version());
        return updated;
    }

    @Transactional(readOnly = true)
    public List<LearningProgressRepository.Feedback> feedback(UUID termId, UUID storeId, ReadCommand command) {
        requireT1OrP1(command.p1(), command.t1());
        requireTeacherScope(command.actorId(), command.p1(), termId, storeId);
        return learning.findFeedback(termId, storeId);
    }

    @Transactional(readOnly = true)
    public List<LearningProgressRepository.Feedback> myFeedback(UUID accountId, boolean p3) {
        if (!p3) {
            throw new ForbiddenException("Only a student can view personal feedback.");
        }
        return learning.findFeedbackForStudent(accountId);
    }

    @Transactional
    public LearningProgressRepository.Retraining createRetraining(CreateRetrainingCommand command) {
        requireT1OrP1(command.p1(), command.t1());
        require(command.feedbackId(), "Feedback");
        var feedback = feedback(command.feedbackId());
        requireTeacherScope(command.actorId(), command.p1(), feedback.termId(), feedback.storeId());
        if (learning.findRetrainingByFeedback(feedback.id()).isPresent()) {
            throw new IllegalStateException("This feedback already has a retraining record.");
        }
        var retraining = learning.createRetraining(UUID.randomUUID(), feedback.id(), feedback.termId(), feedback.storeId(),
                feedback.studentAccountId(), requiredDate(command.dueAt(), "Retraining due time"), command.actorId());
        learning.appendRetrainingAction(retraining.id(), "RETRAINING_CREATED", command.actorId(), null, null,
                RetrainingStatus.PENDING, null, retraining.version());
        audit("RETRAINING_CREATED", "RETRAINING", retraining.id(), command.actorId(), null, null, retraining.version());
        notify(feedback.studentAccountId(), "RETRAINING_ASSIGNED", "RETRAINING", retraining.id(), "需要完成补训",
                "带教老师已安排补训，请在截止时间前完成并提交证据。", command.actorId());
        return retraining;
    }

    @Transactional
    public LearningProgressRepository.Retraining updateRetraining(UUID retrainingId, UpdateRetrainingCommand command) {
        requireT1OrP1(command.p1(), command.t1());
        var retraining = retraining(retrainingId);
        requireTeacherScope(command.actorId(), command.p1(), retraining.termId(), retraining.storeId());
        requireVersion(retraining.version(), command.version());
        if (retraining.status() != RetrainingStatus.PENDING && retraining.status() != RetrainingStatus.RETRAIN_REQUIRED) {
            throw new IllegalStateException("Only pending retraining can have its due time changed.");
        }
        var updated = learning.updateRetrainingDueAt(retraining.id(), requiredDate(command.dueAt(), "Retraining due time"),
                command.version());
        learning.appendRetrainingAction(updated.id(), "RETRAINING_UPDATED", command.actorId(), null, retraining.status(),
                updated.status(), retraining.version(), updated.version());
        audit("RETRAINING_UPDATED", "RETRAINING", updated.id(), command.actorId(), null,
                retraining.version(), updated.version());
        return updated;
    }

    @Transactional
    public LearningProgressRepository.Retraining submitRetraining(UUID retrainingId, SubmitRetrainingCommand command) {
        var retraining = retraining(retrainingId);
        requireStudentOwner(command.actorId(), command.p3(), retraining.studentAccountId(), "Only the assigned student can submit retraining.");
        requireVersion(retraining.version(), command.version());
        if (retraining.status() != RetrainingStatus.PENDING && retraining.status() != RetrainingStatus.RETRAIN_REQUIRED) {
            throw new IllegalStateException("The retraining item is not available for submission.");
        }
        if (command.evidenceIds() == null || command.evidenceIds().isEmpty()) {
            throw new EvidenceRequiredException("Evidence is required before retraining can be submitted.");
        }
        for (var evidenceId : command.evidenceIds()) {
            require(evidenceId, "Evidence");
            var evidence = learning.findEvidenceReference(evidenceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Evidence not found."));
            if (!evidence.submittedByAccountId().equals(command.actorId())) {
                throw new ForbiddenException("Retraining evidence must be submitted by the assigned student.");
            }
            var evidenceScope = learning.findShiftScope(evidence.shiftId())
                    .orElseThrow(() -> new ResourceNotFoundException("Evidence shift not found."));
            if (!retraining.termId().equals(evidenceScope.termId()) || !retraining.storeId().equals(evidenceScope.storeId())) {
                throw new ForbiddenException("Retraining evidence must belong to the same term and store.");
            }
            var relatedStudent = evidence.taskStudentAccountId() == null ? evidence.submittedByAccountId()
                    : evidence.taskStudentAccountId();
            if (!retraining.studentAccountId().equals(relatedStudent)) {
                throw new ForbiddenException("Retraining evidence must be related to the assigned student.");
            }
        }
        var submitted = learning.transitionRetraining(retraining.id(), retraining.status(), RetrainingStatus.SUBMITTED, command.version());
        for (var evidenceId : command.evidenceIds()) {
            learning.linkRetrainingEvidence(retraining.id(), evidenceId, command.actorId());
        }
        learning.appendRetrainingAction(submitted.id(), "RETRAINING_SUBMITTED", command.actorId(), null, retraining.status(),
                submitted.status(), retraining.version(), submitted.version());
        audit("RETRAINING_SUBMITTED", "RETRAINING", submitted.id(), command.actorId(), null,
                retraining.version(), submitted.version());
        return submitted;
    }

    @Transactional
    public LearningProgressRepository.Retraining requestRetest(UUID retrainingId, ReasonVersionCommand command) {
        requireT1OrP1(command.p1(), command.t1());
        var retraining = retraining(retrainingId);
        requireTeacherScope(command.actorId(), command.p1(), retraining.termId(), retraining.storeId());
        requireVersion(retraining.version(), command.version());
        if (retraining.status() != RetrainingStatus.SUBMITTED) {
            throw new IllegalStateException("Only submitted retraining can be sent for retest.");
        }
        var requested = learning.transitionRetraining(retraining.id(), RetrainingStatus.SUBMITTED, RetrainingStatus.RETEST_PENDING,
                command.version());
        var reason = requiredText(command.reason(), "Retest reason", 2000);
        learning.appendRetrainingAction(requested.id(), "RETRAINING_RETEST_REQUESTED", command.actorId(), reason,
                retraining.status(), requested.status(), retraining.version(), requested.version());
        audit("RETRAINING_RETEST_REQUESTED", "RETRAINING", requested.id(), command.actorId(), reason,
                retraining.version(), requested.version());
        notify(retraining.studentAccountId(), "RETRAINING_RETEST_REQUESTED", "RETRAINING", retraining.id(), "需要参加复测",
                "补训材料已进入复测环节。", command.actorId());
        return requested;
    }

    @Transactional
    public LearningProgressRepository.Retraining recordRetest(UUID retrainingId, RetestCommand command) {
        requireT1OrP1(command.p1(), command.t1());
        var retraining = retraining(retrainingId);
        requireTeacherScope(command.actorId(), command.p1(), retraining.termId(), retraining.storeId());
        requireVersion(retraining.version(), command.version());
        if (retraining.status() != RetrainingStatus.RETEST_PENDING) {
            throw new IllegalStateException("Only retraining awaiting retest can receive a retest result.");
        }
        var next = command.passed() ? RetrainingStatus.PASSED : RetrainingStatus.RETRAIN_REQUIRED;
        var result = requiredText(command.result(), "Retest result", 2000);
        var recorded = learning.transitionRetraining(retraining.id(), RetrainingStatus.RETEST_PENDING, next, command.version());
        learning.appendRetrainingRetest(recorded.id(), command.passed(), result, command.actorId());
        learning.appendRetrainingAction(recorded.id(), "RETRAINING_RETEST_RECORDED", command.actorId(), result,
                retraining.status(), recorded.status(), retraining.version(), recorded.version());
        audit("RETRAINING_RETEST_RECORDED", "RETRAINING", recorded.id(), command.actorId(), result,
                retraining.version(), recorded.version());
        if (!command.passed()) {
            notify(retraining.studentAccountId(), "RETRAINING_REQUIRED", "RETRAINING", retraining.id(), "需要再次补训",
                    "复测暂未通过，请根据反馈完成再次补训。", command.actorId());
        }
        return recorded;
    }

    @Transactional(readOnly = true)
    public List<LearningProgressRepository.Retraining> retraining(UUID termId, UUID storeId, ReadCommand command) {
        if (command.p3()) {
            return learning.findRetrainingForStudent(command.actorId());
        }
        requireT1OrP1(command.p1(), command.t1());
        requireTeacherScope(command.actorId(), command.p1(), termId, storeId);
        return learning.findRetraining(termId, storeId);
    }

    @Transactional
    public LearningProgressRepository.Certification createCertification(CreateCertificationCommand command) {
        requireT1OrP1(command.p1(), command.t1());
        require(command.studentAccountId(), "Student account");
        var template = learning.findPublishedTemplateScope(command.templateVersionId())
                .orElseThrow(() -> new ResourceNotFoundException("Published template version not found."));
        requireTeacherScope(command.actorId(), command.p1(), template.termId(), template.storeId());
        requireStudentMembership(template.termId(), command.studentAccountId());
        var rule = learning.findCertificationRule(command.certificationRuleId())
                .orElseThrow(() -> new ResourceNotFoundException("Certification rule not found."));
        if (!rule.templateVersionId().equals(template.templateVersionId())) {
            throw new IllegalArgumentException("Certification rule must belong to the specified published template version.");
        }
        CertificationRulePolicy.parse(objectMapper, rule.configurationJson());
        var certification = learning.createCertification(UUID.randomUUID(), template.termId(), template.storeId(),
                command.studentAccountId(), template.templateVersionId(), rule.id(), ruleSnapshot(rule),
                optionalText(command.note(), "Note", 2000), command.actorId());
        learning.appendCertificationHistory(certification.id(), "CERTIFICATION_CREATED", command.actorId(), null, null,
                CertificationStatus.PENDING, null, certification.version());
        audit("CERTIFICATION_CREATED", "CERTIFICATION", certification.id(), command.actorId(), null, null, certification.version());
        notify(command.studentAccountId(), "CERTIFICATION_CREATED", "CERTIFICATION", certification.id(), "岗位认证待决定",
                "已建立岗位认证记录，等待授权角色给出结论。", command.actorId());
        return certification;
    }

    @Transactional
    public LearningProgressRepository.Certification updateCertification(UUID certificationId,
                                                                         UpdateCertificationCommand command) {
        requireT1OrP1(command.p1(), command.t1());
        var certification = certification(certificationId);
        requireTeacherScope(command.actorId(), command.p1(), certification.termId(), certification.storeId());
        requireVersion(certification.version(), command.version());
        if (certification.status() != CertificationStatus.PENDING) {
            throw new IllegalStateException("A decided certification is read-only.");
        }
        var updated = learning.updateCertificationNote(certification.id(), optionalText(command.note(), "Note", 2000),
                command.version());
        learning.appendCertificationHistory(updated.id(), "CERTIFICATION_UPDATED", command.actorId(), null,
                certification.status(), updated.status(), certification.version(), updated.version());
        audit("CERTIFICATION_UPDATED", "CERTIFICATION", updated.id(), command.actorId(), null,
                certification.version(), updated.version());
        return updated;
    }

    @Transactional
    public LearningProgressRepository.Certification decideCertification(UUID certificationId, DecideCertificationCommand command) {
        var certification = certification(certificationId);
        requireVersion(certification.version(), command.version());
        if (certification.status() != CertificationStatus.PENDING) {
            throw new IllegalStateException("A certification decision is immutable. Create a new certification record for a new decision.");
        }
        var policy = certificationPolicy(certification.ruleSnapshotJson());
        var authorizedRoles = policy.authorizedDecisionRoles();
        if (!command.p1() && !hasAnyRole(command, authorizedRoles)) {
            throw new ForbiddenException("You are not an authorized decision role for this certification rule.");
        }
        requireScopeForAnyDecisionRole(command, certification, authorizedRoles);
        UUID retestRetrainingId = null;
        if (command.approved()) {
            linkAndValidateCertificationEvidence(certification, command, policy);
            if (policy.retestRequired()) {
                require(command.retrainingId(), "Passed retraining");
                var prerequisite = retraining(command.retrainingId());
                if (prerequisite.status() != RetrainingStatus.PASSED
                        || !certification.termId().equals(prerequisite.termId())
                        || !certification.storeId().equals(prerequisite.storeId())
                        || !certification.studentAccountId().equals(prerequisite.studentAccountId())) {
                    throw new IllegalStateException("Certification approval requires the referenced passed retraining in the same scope.");
                }
                retestRetrainingId = prerequisite.id();
            }
        }
        var next = command.approved() ? CertificationStatus.CERTIFIED : CertificationStatus.NOT_CERTIFIED;
        var reason = requiredText(command.reason(), "Certification decision reason", 2000);
        var decided = learning.decideCertification(certification.id(), next, command.version());
        learning.appendCertificationDecision(decided.id(), command.approved(), reason, command.actorId(), retestRetrainingId,
                certification.version(), decided.version());
        learning.appendCertificationHistory(decided.id(), "CERTIFICATION_DECIDED", command.actorId(), reason,
                certification.status(), decided.status(), certification.version(), decided.version());
        audit("CERTIFICATION_DECIDED", "CERTIFICATION", decided.id(), command.actorId(), reason,
                certification.version(), decided.version());
        notify(certification.studentAccountId(), "CERTIFICATION_DECIDED", "CERTIFICATION", certification.id(), "岗位认证结果已发布",
                "请查看岗位认证结论和说明。", command.actorId());
        return decided;
    }

    @Transactional(readOnly = true)
    public List<LearningProgressRepository.Certification> certifications(UUID termId, UUID storeId, ReadCommand command) {
        if (command.p3()) {
            return learning.findCertificationsForStudent(command.actorId());
        }
        requireT1OrP1(command.p1(), command.t1());
        requireTeacherScope(command.actorId(), command.p1(), termId, storeId);
        return learning.findCertifications(termId, storeId);
    }

    @Transactional(readOnly = true)
    public LearningGrowth learningGrowth(UUID accountId, boolean p3) {
        if (!p3) {
            throw new ForbiddenException("Only a student can view personal learning growth.");
        }
        var feedback = learning.findFeedbackForStudent(accountId);
        var retraining = learning.findRetrainingForStudent(accountId);
        var certifications = learning.findCertificationsForStudent(accountId);
        var actions = new java.util.ArrayList<OpenAction>();
        retraining.stream().filter(item -> item.status() == RetrainingStatus.PENDING || item.status() == RetrainingStatus.RETRAIN_REQUIRED)
                .forEach(item -> actions.add(new OpenAction("RETRAINING", item.id(), item.status().name(), item.dueAt())));
        certifications.stream().filter(item -> item.status() == CertificationStatus.PENDING)
                .forEach(item -> actions.add(new OpenAction("CERTIFICATION", item.id(), item.status().name(), null)));
        return new LearningGrowth(feedback, retraining, certifications, actions);
    }

    private LearningProgressRepository.ShiftScope referenceScope(UUID shiftId, UUID taskCompletionId, UUID incidentId, UUID evidenceId) {
        if (shiftId == null && taskCompletionId == null && incidentId == null && evidenceId == null) {
            throw new IllegalArgumentException("Feedback must reference a shift, task, incident or evidence.");
        }
        UUID resolvedShiftId = shiftId;
        if (taskCompletionId != null) {
            var task = learning.findTaskReference(taskCompletionId)
                    .orElseThrow(() -> new ResourceNotFoundException("Task completion not found."));
            resolvedShiftId = mergeShiftReference(resolvedShiftId, task.shiftId(), "task completion");
        }
        if (incidentId != null) {
            var incident = learning.findIncidentReference(incidentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Incident not found."));
            resolvedShiftId = mergeShiftReference(resolvedShiftId, incident.shiftId(), "incident");
        }
        if (evidenceId != null) {
            var evidence = learning.findEvidenceReference(evidenceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Evidence not found."));
            resolvedShiftId = mergeShiftReference(resolvedShiftId, evidence.shiftId(), "evidence");
        }
        return learning.findShiftScope(resolvedShiftId).orElseThrow(() -> new ResourceNotFoundException("Shift not found."));
    }

    private UUID mergeShiftReference(UUID resolvedShiftId, UUID relatedShiftId, String referenceName) {
        if (resolvedShiftId != null && !resolvedShiftId.equals(relatedShiftId)) {
            throw new ForbiddenException("The " + referenceName + " does not belong to the referenced shift.");
        }
        return relatedShiftId;
    }

    private void requireReferenceStudent(UUID studentAccountId, UUID taskCompletionId, UUID incidentId, UUID evidenceId) {
        if (taskCompletionId != null) {
            var task = learning.findTaskReference(taskCompletionId)
                    .orElseThrow(() -> new ResourceNotFoundException("Task completion not found."));
            if (!studentAccountId.equals(task.studentAccountId())) {
                throw new ForbiddenException("The task completion is not assigned to the feedback student.");
            }
        }
        if (incidentId != null) {
            var incident = learning.findIncidentReference(incidentId)
                    .orElseThrow(() -> new ResourceNotFoundException("Incident not found."));
            if (!studentAccountId.equals(incident.reportedByAccountId()) && !studentAccountId.equals(incident.assigneeAccountId())) {
                throw new ForbiddenException("The incident is not related to the feedback student.");
            }
        }
        if (evidenceId != null) {
            var evidence = learning.findEvidenceReference(evidenceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Evidence not found."));
            var relatedStudent = evidence.taskStudentAccountId() == null ? evidence.submittedByAccountId()
                    : evidence.taskStudentAccountId();
            if (!studentAccountId.equals(relatedStudent)) {
                throw new ForbiddenException("The evidence is not related to the feedback student.");
            }
        }
    }

    private void requireTeacherScope(UUID actorId, boolean p1, UUID termId, UUID storeId) {
        if (p1) {
            return;
        }
        if (!learning.hasScope(actorId, "T1", termId, storeId)) {
            throw new ForbiddenException("You do not have T1 scope for this term and store.");
        }
    }

    private void requireScopeForAnyDecisionRole(DecideCertificationCommand command,
                                                LearningProgressRepository.Certification certification,
                                                Set<String> authorizedRoles) {
        if (command.p1()) {
            return;
        }
        for (var role : authorizedRoles) {
            if (hasRole(command, role) && learning.hasScope(command.actorId(), role, certification.termId(), certification.storeId())) {
                return;
            }
        }
        throw new ForbiddenException("You do not have scope for an authorized certification decision role.");
    }

    private boolean hasAnyRole(DecideCertificationCommand command, Set<String> roles) {
        return (roles.contains("T1") && command.t1()) || (roles.contains("P2") && command.p2());
    }

    private boolean hasRole(DecideCertificationCommand command, String role) {
        return (role.equals("T1") && command.t1()) || (role.equals("P2") && command.p2());
    }

    private CertificationRulePolicy certificationPolicy(String ruleSnapshotJson) {
        try {
            return CertificationRulePolicy.parse(objectMapper,
                    objectMapper.readTree(ruleSnapshotJson).path("configuration").toString());
        } catch (IllegalArgumentException | java.io.IOException exception) {
            throw new IllegalStateException("Certification rule snapshot is invalid.");
        }
    }

    private void linkAndValidateCertificationEvidence(LearningProgressRepository.Certification certification,
                                                      DecideCertificationCommand command,
                                                      CertificationRulePolicy policy) {
        var evidenceIds = command.evidenceIds() == null ? List.<UUID>of() : command.evidenceIds().stream().distinct().toList();
        for (var evidenceId : evidenceIds) {
            require(evidenceId, "Evidence");
            var evidence = learning.findEvidenceReference(evidenceId)
                    .orElseThrow(() -> new ResourceNotFoundException("Evidence not found."));
            var evidenceScope = learning.findShiftScope(evidence.shiftId())
                    .orElseThrow(() -> new ResourceNotFoundException("Evidence shift not found."));
            var relatedStudent = evidence.taskStudentAccountId() == null ? evidence.submittedByAccountId()
                    : evidence.taskStudentAccountId();
            if (!certification.studentAccountId().equals(relatedStudent)
                    || !certification.termId().equals(evidenceScope.termId())
                    || !certification.storeId().equals(evidenceScope.storeId())) {
                throw new ForbiddenException("Certification evidence must belong to the student and certification scope.");
            }
            learning.linkCertificationEvidence(certification.id(), evidenceId, command.actorId());
        }
        if (policy.evidenceRequired()
                && learning.countCertificationEvidence(certification.id()) < policy.minimumEvidenceCount()) {
            throw new EvidenceRequiredException("Certification approval requires the configured amount of evidence.");
        }
    }

    private String ruleSnapshot(LearningProgressRepository.CertificationRule rule) {
        try {
            var snapshot = objectMapper.createObjectNode();
            snapshot.put("id", rule.id().toString());
            snapshot.put("code", rule.code());
            snapshot.put("name", rule.name());
            snapshot.set("configuration", objectMapper.readTree(rule.configurationJson()));
            return objectMapper.writeValueAsString(snapshot);
        } catch (Exception exception) {
            throw new IllegalStateException("Certification rule configuration is invalid.");
        }
    }

    private void requireStudentMembership(UUID termId, UUID studentAccountId) {
        if (!learning.isActiveStudent(termId, studentAccountId)) {
            throw new ForbiddenException("The account is not an active P3 student in this term.");
        }
    }

    private LearningProgressRepository.Feedback feedback(UUID feedbackId) {
        return learning.lockFeedback(feedbackId).orElseThrow(() -> new ResourceNotFoundException("Feedback not found."));
    }

    private LearningProgressRepository.Retraining retraining(UUID retrainingId) {
        return learning.lockRetraining(retrainingId).orElseThrow(() -> new ResourceNotFoundException("Retraining not found."));
    }

    private LearningProgressRepository.Certification certification(UUID certificationId) {
        return learning.lockCertification(certificationId).orElseThrow(() -> new ResourceNotFoundException("Certification not found."));
    }

    private void requireT1OrP1(boolean p1, boolean t1) {
        if (!p1 && !t1) {
            throw new ForbiddenException("Only T1 or P1 can perform this learning operation.");
        }
    }

    private void requireStudentOwner(UUID actorId, boolean p3, UUID studentId, String message) {
        if (!p3 || !actorId.equals(studentId)) {
            throw new ForbiddenException(message);
        }
    }

    private void requireVersion(long actual, long expected) {
        if (actual != expected) {
            throw new VersionConflictException("The resource has changed. Refresh and try again.");
        }
    }

    private void audit(String eventType, String resourceType, UUID resourceId, UUID actorId, String reason,
                       Long previousVersion, Long newVersion) {
        learning.appendAudit(eventType, resourceType, resourceId, actorId, reason, previousVersion, newVersion);
    }

    private void notify(UUID recipientAccountId, String eventType, String resourceType, UUID resourceId, String title,
                        String message, UUID actorAccountId) {
        events.publishEvent(new OperationalNotificationRequested(recipientAccountId, eventType, resourceType, resourceId,
                title, message, actorAccountId));
    }

    private void require(Object value, String name) {
        if (value == null) {
            throw new IllegalArgumentException(name + " is required.");
        }
    }

    private OffsetDateTime requiredDate(OffsetDateTime value, String name) {
        if (value == null) {
            throw new IllegalArgumentException(name + " is required.");
        }
        return value;
    }

    private String requiredText(String value, String field, int maxLength) {
        if (value == null || value.trim().isEmpty() || value.trim().length() > maxLength) {
            throw new IllegalArgumentException(field + " must contain 1 to " + maxLength + " characters.");
        }
        return value.trim();
    }

    private String optionalText(String value, String field, int maxLength) {
        return value == null || value.isBlank() ? null : requiredText(value, field, maxLength);
    }

    public record CreateFeedbackCommand(UUID studentAccountId, UUID shiftId, UUID taskCompletionId, UUID incidentId,
                                        UUID evidenceId, String observation, String recommendation, boolean requiresRetraining,
                                        OffsetDateTime retrainingDueAt, UUID actorId, boolean p1, boolean t1) {
    }

    public record UpdateFeedbackCommand(String observation, String recommendation, boolean requiresRetraining,
                                        OffsetDateTime retrainingDueAt, long version, UUID actorId, boolean p1, boolean t1) {
    }

    public record SubmitRetrainingCommand(long version, List<UUID> evidenceIds, UUID actorId, boolean p3) {
    }

    public record CreateRetrainingCommand(UUID feedbackId, OffsetDateTime dueAt, UUID actorId, boolean p1, boolean t1) {
    }

    public record UpdateRetrainingCommand(OffsetDateTime dueAt, long version, UUID actorId, boolean p1, boolean t1) {
    }

    public record ReasonVersionCommand(long version, String reason, UUID actorId, boolean p1, boolean t1) {
    }

    public record RetestCommand(long version, boolean passed, String result, UUID actorId, boolean p1, boolean t1) {
    }

    public record CreateCertificationCommand(UUID studentAccountId, UUID templateVersionId, UUID certificationRuleId,
                                              String note, UUID actorId, boolean p1, boolean t1) {
    }

    public record UpdateCertificationCommand(String note, long version, UUID actorId, boolean p1, boolean t1) {
    }

    public record DecideCertificationCommand(long version, boolean approved, String reason, List<UUID> evidenceIds,
                                              UUID retrainingId, UUID actorId, boolean p1, boolean p2, boolean t1) {
    }

    public record ReadCommand(UUID actorId, boolean p1, boolean t1, boolean p3) {
    }

    public record OpenAction(String actionType, UUID resourceId, String status, OffsetDateTime dueAt) {
    }

    public record LearningGrowth(List<LearningProgressRepository.Feedback> feedback,
                                 List<LearningProgressRepository.Retraining> retraining,
                                 List<LearningProgressRepository.Certification> certifications,
                                 List<OpenAction> openActions) {
    }
}
