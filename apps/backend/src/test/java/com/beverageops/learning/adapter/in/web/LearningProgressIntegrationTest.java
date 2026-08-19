package com.beverageops.learning.adapter.in.web;

import java.time.LocalDate;
import java.util.UUID;

import com.beverageops.support.PostgresIntegrationTestBase;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class LearningProgressIntegrationTest extends PostgresIntegrationTestBase {

    private static final UUID P1_ID = UUID.fromString("91000000-0000-0000-0000-000000000001");
    private static final UUID T1_ID = UUID.fromString("91000000-0000-0000-0000-000000000002");
    private static final UUID UNSCOPED_T1_ID = UUID.fromString("91000000-0000-0000-0000-000000000003");
    private static final UUID P3_ID = UUID.fromString("91000000-0000-0000-0000-000000000004");
    private static final UUID OTHER_P3_ID = UUID.fromString("91000000-0000-0000-0000-000000000005");
    private static final UUID P2_ID = UUID.fromString("91000000-0000-0000-0000-000000000006");
    private static final UUID UNASSIGNED_P3_ID = UUID.fromString("91000000-0000-0000-0000-000000000007");
    private static final UUID NON_STUDENT_MEMBER_ID = UUID.fromString("91000000-0000-0000-0000-000000000008");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void createActors() {
        createActor(P1_ID, "LEARNING-P1", "P1");
        createActor(T1_ID, "LEARNING-T1", "T1");
        createActor(UNSCOPED_T1_ID, "LEARNING-T1-UNSCOPED", "T1");
        createActor(P3_ID, "LEARNING-P3", "P3");
        createActor(OTHER_P3_ID, "LEARNING-P3-OTHER", "P3");
        createActor(P2_ID, "LEARNING-P2", "P2");
        createActor(UNASSIGNED_P3_ID, "LEARNING-P3-UNASSIGNED", "P3");
        createActor(NON_STUDENT_MEMBER_ID, "LEARNING-NON-STUDENT", "T1");
    }

    @Test
    void scopedT1CanRecordShiftFeedbackButStudentsOnlySeeTheirOwnFeedback() throws Exception {
        var scope = learningScope("FEEDBACK");
        grantScope(scope, T1_ID, "T1");

        mockMvc.perform(post("/api/v1/feedback")
                        .with(user(UNSCOPED_T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","shiftId":"%s","observation":"制作顺序不稳定",
                                 "recommendation":"按开店检查表复盘","requiresRetraining":false}
                                """.formatted(P3_ID, scope.shiftId())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        var feedback = mockMvc.perform(post("/api/v1/feedback")
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","shiftId":"%s","observation":"制作顺序不稳定",
                                 "recommendation":"按开店检查表复盘","requiresRetraining":false}
                                """.formatted(P3_ID, scope.shiftId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.studentAccountId").value(P3_ID.toString()))
                .andExpect(jsonPath("$.shiftId").value(scope.shiftId()))
                .andExpect(jsonPath("$.version").value(1))
                .andReturn();
        var feedbackId = json(feedback).path("id").asText();

        mockMvc.perform(get("/api/v1/feedback").param("termId", scope.termId()).param("storeId", scope.storeId())
                        .with(user(T1_ID.toString()).roles("T1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(feedbackId));

        mockMvc.perform(get("/api/v1/me/feedback").with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(feedbackId));
        mockMvc.perform(get("/api/v1/me/feedback").with(user(OTHER_P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        assertThatAudit("LEARNING_FEEDBACK_CREATED", UUID.fromString(feedbackId));
    }

    @Test
    void retrainingRequiresStudentEvidenceAndFollowsTheConfiguredLifecycle() throws Exception {
        var scope = learningScope("RETRAINING");
        grantScope(scope, T1_ID, "T1");
        var feedbackId = createRetrainingFeedback(scope);
        var retraining = mockMvc.perform(get("/api/v1/retraining").with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].feedbackId").value(feedbackId))
                .andExpect(jsonPath("$[0].status").value("PENDING"))
                .andReturn();
        var retrainingId = json(retraining).at("/0/id").asText();

        mockMvc.perform(post("/api/v1/retraining/{retrainingId}/submit", retrainingId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"evidenceIds\":[]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVIDENCE_REQUIRED"));

        var evidenceId = createStudentEvidence(scope);
        mockMvc.perform(post("/api/v1/retraining/{retrainingId}/submit", retrainingId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"evidenceIds\":[\"%s\"]}".formatted(evidenceId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(post("/api/v1/retraining/{retrainingId}/request-retest", retrainingId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2,\"reason\":\"请现场复测出品流程\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RETEST_PENDING"))
                .andExpect(jsonPath("$.version").value(3));

        mockMvc.perform(post("/api/v1/retraining/{retrainingId}/record-retest", retrainingId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":3,\"passed\":false,\"result\":\"仍需再次练习计量与出品顺序\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RETRAIN_REQUIRED"))
                .andExpect(jsonPath("$.version").value(4));

        assertThatAudit("RETRAINING_RETEST_RECORDED", UUID.fromString(retrainingId));
        var retests = jdbcTemplate.queryForObject("select count(*) from learning_retraining_retests where retraining_id = ?",
                Integer.class, UUID.fromString(retrainingId));
        assertThat(retests).isEqualTo(1);
    }

    @Test
    void retrainingEvidenceMayComeFromALaterShiftInTheSameTermAndStore() throws Exception {
        var original = learningScope("RETRAINING-LATER-A", "T1", LocalDate.of(2026, 9, 10));
        var later = additionalLearningScope(original, "RETRAINING-LATER-B", LocalDate.of(2026, 9, 17));
        grantScope(original, T1_ID, "T1");
        var feedbackId = createRetrainingFeedback(original);
        var retraining = mockMvc.perform(get("/api/v1/retraining").with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk()).andReturn();
        var retrainingId = json(retraining).at("/0/id").asText();
        var evidenceId = createStudentEvidence(later);

        mockMvc.perform(post("/api/v1/retraining/{retrainingId}/submit", retrainingId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"evidenceIds\":[\"%s\"]}".formatted(evidenceId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.feedbackId").value(feedbackId))
                .andExpect(jsonPath("$.status").value("SUBMITTED"));
    }

    @Test
    void certificationSnapshotsAPublishedRuleAndOnlyItsConfiguredRoleCanMakeOneImmutableDecision() throws Exception {
        var scope = learningScope("CERTIFICATION");
        grantScope(scope, T1_ID, "T1");
        var ruleId = scope.certificationRuleId();

        var certification = mockMvc.perform(post("/api/v1/certifications")
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","templateVersionId":"%s","certificationRuleId":"%s",
                                 "note":"完成吧台岗位观察"}
                                """.formatted(P3_ID, scope.templateId(), ruleId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.ruleSnapshot.code").value("BARISTA-BASIC"))
                .andReturn();
        var certificationId = json(certification).path("id").asText();

        var evidenceId = createStudentEvidence(scope);
        mockMvc.perform(post("/api/v1/certifications/{certificationId}/decide", certificationId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"approved\":true,\"reason\":\"复测符合已配置标准\",\"evidenceIds\":[\"%s\"]}"
                                .formatted(evidenceId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CERTIFIED"))
                .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(post("/api/v1/certifications/{certificationId}/decide", certificationId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2,\"approved\":false,\"reason\":\"不能覆盖原结论\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STATE_CONFLICT"));

        assertThatAudit("CERTIFICATION_DECIDED", UUID.fromString(certificationId));
        var decisions = jdbcTemplate.queryForObject("select count(*) from learning_certification_decisions where certification_id = ?",
                Integer.class, UUID.fromString(certificationId));
        assertThat(decisions).isEqualTo(1);
    }

    @Test
    void certificationApprovalEnforcesConfiguredEvidenceAndRetestRequirements() throws Exception {
        var evidenceScope = learningScope("CERT-EVIDENCE", "T1", LocalDate.of(2026, 9, 10), true, 1, false);
        grantScope(evidenceScope, T1_ID, "T1");
        var evidenceCertificationId = createCertification(evidenceScope, P3_ID, T1_ID, "T1");

        mockMvc.perform(post("/api/v1/certifications/{certificationId}/decide", evidenceCertificationId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"approved\":true,\"reason\":\"缺少证据不得通过\",\"evidenceIds\":[]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVIDENCE_REQUIRED"));

        var retestScope = learningScope("CERT-RETEST", "T1", LocalDate.of(2026, 9, 12), false, 0, true);
        grantScope(retestScope, T1_ID, "T1");
        var retestCertificationId = createCertification(retestScope, P3_ID, T1_ID, "T1");
        mockMvc.perform(post("/api/v1/certifications/{certificationId}/decide", retestCertificationId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"approved\":true,\"reason\":\"未引用通过的复测\",\"evidenceIds\":[]}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        createRetrainingFeedback(retestScope);
        var retraining = mockMvc.perform(get("/api/v1/retraining").with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andReturn();
        var retrainingId = json(retraining).at("/0/id").asText();
        var evidenceId = createStudentEvidence(retestScope);
        mockMvc.perform(post("/api/v1/retraining/{retrainingId}/submit", retrainingId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"evidenceIds\":[\"%s\"]}".formatted(evidenceId)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/retraining/{retrainingId}/request-retest", retrainingId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2,\"reason\":\"补训证据已复核\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/retraining/{retrainingId}/record-retest", retrainingId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":3,\"passed\":true,\"result\":\"复测通过\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PASSED"));

        mockMvc.perform(post("/api/v1/certifications/{certificationId}/decide", retestCertificationId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"approved\":true,\"reason\":\"已完成同范围复测\",\"evidenceIds\":[],\"retrainingId\":\"%s\"}"
                                .formatted(retrainingId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CERTIFIED"));
        assertThat(jdbcTemplate.queryForObject("""
                select retraining_id from learning_certification_decisions where certification_id = ?
                """, UUID.class, UUID.fromString(retestCertificationId))).isEqualTo(UUID.fromString(retrainingId));
    }

    @Test
    void databaseRejectsCertificationDecisionsWhoseRetestBelongsToAnotherStudentOrScope() throws Exception {
        var first = learningScope("CERT-DECISION-FK-A", "T1", LocalDate.of(2026, 9, 10), false, 0, true);
        var second = learningScope("CERT-DECISION-FK-B", "T1", LocalDate.of(2026, 9, 12), false, 0, true);
        grantScope(first, T1_ID, "T1");
        var certificationId = UUID.fromString(createCertification(first, P3_ID, T1_ID, "T1"));
        var foreignRetrainingId = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into learning_retraining
                    (id, feedback_id, term_id, store_id, student_account_id, status, created_by_account_id)
                values (?, ?, ?, ?, ?, 'PASSED', ?)
                """, foreignRetrainingId, createFeedbackRecord(second, OTHER_P3_ID), UUID.fromString(second.termId()),
                UUID.fromString(second.storeId()), OTHER_P3_ID, T1_ID);

        assertThatThrownBy(() -> jdbcTemplate.update("""
                insert into learning_certification_decisions
                    (id, certification_id, approved, reason, decided_by_account_id, retraining_id, previous_version, new_version)
                values (?, ?, true, 'Direct write must preserve certification scope', ?, ?, 1, 2)
                """, UUID.randomUUID(), certificationId, T1_ID, foreignRetrainingId))
                .hasMessageContaining("Certification retest is outside the certification student or scope");
    }

    @Test
    void studentGrowthCombinesOnlyTheAuthenticatedStudentsFeedbackCertificationsAndOpenActions() throws Exception {
        var scope = learningScope("GROWTH");
        grantScope(scope, T1_ID, "T1");
        createRetrainingFeedback(scope);
        var ruleId = scope.certificationRuleId();
        mockMvc.perform(post("/api/v1/certifications")
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","templateVersionId":"%s","certificationRuleId":"%s",
                                 "note":"待认证"}
                                """.formatted(P3_ID, scope.templateId(), ruleId)))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/me/learning-growth").with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.feedback.length()").value(1))
                .andExpect(jsonPath("$.retraining.length()").value(1))
                .andExpect(jsonPath("$.certifications.length()").value(1))
                .andExpect(jsonPath("$.openActions.length()").value(2))
                .andExpect(jsonPath("$.openActions[0].actionType").value("RETRAINING"))
                .andExpect(jsonPath("$.openActions[1].actionType").value("CERTIFICATION"));

        mockMvc.perform(get("/api/v1/me/learning-growth").with(user(OTHER_P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.feedback").isEmpty())
                .andExpect(jsonPath("$.retraining").isEmpty())
                .andExpect(jsonPath("$.certifications").isEmpty())
                .andExpect(jsonPath("$.openActions").isEmpty());
    }

    @Test
    void teachersCanCreateAndPatchRetrainingAndPendingCertificationNotes() throws Exception {
        var scope = learningScope("LEARNING_PATCHES");
        grantScope(scope, T1_ID, "T1");
        var feedback = mockMvc.perform(post("/api/v1/feedback")
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","shiftId":"%s","observation":"需要复习萃取参数",
                                 "recommendation":"安排一次专项补训","requiresRetraining":false}
                                """.formatted(P3_ID, scope.shiftId())))
                .andExpect(status().isCreated())
                .andReturn();
        var feedbackId = json(feedback).path("id").asText();

        var retraining = mockMvc.perform(post("/api/v1/retraining")
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"feedbackId":"%s","dueAt":"2026-09-25T12:00:00Z"}
                                """.formatted(feedbackId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andExpect(jsonPath("$.version").value(1))
                .andReturn();
        var retrainingId = json(retraining).path("id").asText();

        mockMvc.perform(patch("/api/v1/retraining/{retrainingId}", retrainingId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"dueAt\":\"2026-09-26T12:00:00Z\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dueAt").value("2026-09-26T12:00:00Z"))
                .andExpect(jsonPath("$.version").value(2));

        var certification = mockMvc.perform(post("/api/v1/certifications")
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","templateVersionId":"%s","certificationRuleId":"%s","note":"初始观察"}
                                """.formatted(P3_ID, scope.templateId(), scope.certificationRuleId())))
                .andExpect(status().isCreated())
                .andReturn();
        var certificationId = json(certification).path("id").asText();
        mockMvc.perform(patch("/api/v1/certifications/{certificationId}", certificationId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"note\":\"已完成吧台观察，等待决定\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.note").value("已完成吧台观察，等待决定"))
                .andExpect(jsonPath("$.version").value(2));
    }

    @Test
    void feedbackRejectsEvidenceFromAnotherShift() throws Exception {
        var first = learningScope("REFERENCE_A");
        var second = learningScope("REFERENCE_B", "T1", LocalDate.of(2026, 9, 12));
        grantScope(first, T1_ID, "T1");
        grantScope(second, T1_ID, "T1");
        var evidenceId = createStudentEvidence(first);

        mockMvc.perform(post("/api/v1/feedback")
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","shiftId":"%s","evidenceId":"%s",
                                 "observation":"跨班次证据","recommendation":"不应被接受","requiresRetraining":false}
                                """.formatted(P3_ID, second.shiftId(), evidenceId)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void configuredP2CanMakeCertificationDecisionWithinItsScope() throws Exception {
        var scope = learningScope("CERTIFICATION_P2", "P2");
        grantScope(scope, P2_ID, "P2");
        var certification = mockMvc.perform(post("/api/v1/certifications")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","templateVersionId":"%s","certificationRuleId":"%s","note":"待 P2 决定"}
                                """.formatted(P3_ID, scope.templateId(), scope.certificationRuleId())))
                .andExpect(status().isCreated())
                .andReturn();
        var certificationId = json(certification).path("id").asText();
        var evidenceId = createStudentEvidence(scope);

        mockMvc.perform(post("/api/v1/certifications/{certificationId}/decide", certificationId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"approved\":true,\"reason\":\"P2 已完成现场确认\",\"evidenceIds\":[\"%s\"]}"
                                .formatted(evidenceId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CERTIFIED"));
    }

    @Test
    void certificationDecisionRequiresConfiguredRoleScopeAndBecomesReadOnly() throws Exception {
        var scope = learningScope("CERT-AUTH", "P2", LocalDate.of(2026, 9, 10), false, 0, false);
        var certificationId = createCertification(scope, P3_ID, P1_ID, "P1");

        mockMvc.perform(post("/api/v1/certifications/{certificationId}/decide", certificationId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"approved\":true,\"reason\":\"未配置的角色\",\"evidenceIds\":[]}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/certifications/{certificationId}/decide", certificationId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"approved\":true,\"reason\":\"无范围的 P2\",\"evidenceIds\":[]}"))
                .andExpect(status().isForbidden());

        grantScope(scope, P2_ID, "P2");
        mockMvc.perform(post("/api/v1/certifications/{certificationId}/decide", certificationId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"approved\":false,\"reason\":\"当前未达到标准\",\"evidenceIds\":[]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("NOT_CERTIFIED"));
        mockMvc.perform(patch("/api/v1/certifications/{certificationId}", certificationId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2,\"note\":\"不得改写决定后的记录\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STATE_CONFLICT"));
    }

    @Test
    void learningRecordsRejectActiveMembersWhoAreNotP3Students() throws Exception {
        var scope = learningScope("NON-STUDENT");
        grantScope(scope, T1_ID, "T1");
        createMembership(scope.termId(), NON_STUDENT_MEMBER_ID);
        assignStudent(scope.shiftId(), NON_STUDENT_MEMBER_ID);

        mockMvc.perform(post("/api/v1/feedback")
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","shiftId":"%s","observation":"不是学生账号",
                                 "recommendation":"不得建立学习记录","requiresRetraining":false}
                                """.formatted(NON_STUDENT_MEMBER_ID, scope.shiftId())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mockMvc.perform(post("/api/v1/certifications")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","templateVersionId":"%s","certificationRuleId":"%s"}
                                """.formatted(NON_STUDENT_MEMBER_ID, scope.templateId(), scope.certificationRuleId())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void learningMutationsRejectStaleVersionsAndEvidenceForAnotherStudent() throws Exception {
        var scope = learningScope("LEARNING_CONFLICTS");
        grantScope(scope, T1_ID, "T1");
        var feedback = mockMvc.perform(post("/api/v1/feedback")
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","shiftId":"%s","observation":"需要补充练习",
                                 "recommendation":"按要求提交补训证据","requiresRetraining":true,
                                 "retrainingDueAt":"2026-09-20T12:00:00Z"}
                                """.formatted(P3_ID, scope.shiftId())))
                .andExpect(status().isCreated())
                .andReturn();
        var feedbackId = json(feedback).path("id").asText();
        var retraining = mockMvc.perform(get("/api/v1/retraining").with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andReturn();
        var retrainingId = json(retraining).at("/0/id").asText();

        mockMvc.perform(patch("/api/v1/feedback/{feedbackId}", feedbackId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":2,"observation":"过期修改","recommendation":"刷新后重试",
                                 "requiresRetraining":true,"retrainingDueAt":"2026-09-21T12:00:00Z"}
                                """))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));

        var otherEvidence = createStudentEvidence(scope, OTHER_P3_ID);
        mockMvc.perform(post("/api/v1/retraining/{retrainingId}/submit", retrainingId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"evidenceIds\":[\"%s\"]}".formatted(otherEvidence)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void feedbackAndRetestRequireAnAssignedStudentAndTeacherRole() throws Exception {
        var scope = learningScope("LEARNING_AUTHORISATION");
        grantScope(scope, T1_ID, "T1");
        grantScope(scope, P2_ID, "T1");

        mockMvc.perform(post("/api/v1/feedback")
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","shiftId":"%s","observation":"未参与该班次",
                                 "recommendation":"不得建立班次反馈","requiresRetraining":false}
                                """.formatted(UNASSIGNED_P3_ID, scope.shiftId())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        var feedbackId = createRetrainingFeedback(scope);
        var retraining = mockMvc.perform(get("/api/v1/retraining").with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk()).andReturn();
        var retrainingId = json(retraining).at("/0/id").asText();
        var evidenceId = createStudentEvidence(scope);
        mockMvc.perform(post("/api/v1/retraining/{retrainingId}/submit", retrainingId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"evidenceIds\":[\"%s\"]}".formatted(evidenceId)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/retraining/{retrainingId}/request-retest", retrainingId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2,\"reason\":\"不能借用 T1 范围\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        assertThat(feedbackId).isNotBlank();
    }

    @Test
    void feedbackCanInferItsShiftFromAValidatedTaskReference() throws Exception {
        var scope = learningScope("TASK_REFERENCE");
        grantScope(scope, T1_ID, "T1");
        var taskId = taskId(scope, P3_ID);

        mockMvc.perform(post("/api/v1/feedback")
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","taskCompletionId":"%s","observation":"任务观察",
                                 "recommendation":"按任务标准复盘","requiresRetraining":false}
                                """.formatted(P3_ID, taskId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.shiftId").value(scope.shiftId()))
                .andExpect(jsonPath("$.taskCompletionId").value(taskId.toString()));
    }

    private String createRetrainingFeedback(LearningScope scope) throws Exception {
        var feedback = mockMvc.perform(post("/api/v1/feedback")
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","shiftId":"%s","observation":"清洁消毒遗漏关键点",
                                 "recommendation":"完成食品安全补训并提交记录","requiresRetraining":true,
                                 "retrainingDueAt":"2026-09-20T12:00:00Z"}
                                """.formatted(P3_ID, scope.shiftId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.requiresRetraining").value(true))
                .andReturn();
        return json(feedback).path("id").asText();
    }

    private UUID createFeedbackRecord(LearningScope scope, UUID studentAccountId) {
        var feedbackId = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into learning_feedback
                    (id, term_id, store_id, student_account_id, shift_id, observation, recommendation,
                     requires_retraining, status, created_by_account_id)
                values (?, ?, ?, ?, ?, '直接写入测试反馈', '用于验证数据库关联边界', false, 'OPEN', ?)
                """, feedbackId, UUID.fromString(scope.termId()), UUID.fromString(scope.storeId()), studentAccountId,
                UUID.fromString(scope.shiftId()), T1_ID);
        return feedbackId;
    }

    private LearningScope learningScope(String code) throws Exception {
        return learningScope(code, "T1", LocalDate.of(2026, 9, 10));
    }

    private LearningScope learningScope(String code, String authorizedDecisionRole) throws Exception {
        return learningScope(code, authorizedDecisionRole, LocalDate.of(2026, 9, 10));
    }

    private LearningScope learningScope(String code, String authorizedDecisionRole, LocalDate operatingDate) throws Exception {
        return learningScope(code, authorizedDecisionRole, operatingDate, true, 1, false);
    }

    private LearningScope learningScope(String code, String authorizedDecisionRole, LocalDate operatingDate,
                                        boolean evidenceRequired, int minimumEvidenceCount,
                                        boolean retestRequired) throws Exception {
        var term = mockMvc.perform(post("/api/v1/admin/terms")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"TERM-%s","name":"%s 学期","startDate":"2026-09-01","endDate":"2027-01-20"}
                                """.formatted(code, code)))
                .andExpect(status().isCreated()).andReturn();
        var termId = json(term).path("id").asText();
        mockMvc.perform(post("/api/v1/admin/terms/{termId}/publish", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());

        var store = mockMvc.perform(post("/api/v1/admin/stores")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"%s\",\"name\":\"%s 门店\"}".formatted(code, code)))
                .andExpect(status().isCreated()).andReturn();
        var storeId = json(store).path("id").asText();

        var template = mockMvc.perform(post("/api/v1/admin/template-versions")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","templateCode":"DAILY-OPS","name":"日常运营模板",
                                 "effectiveFrom":"2026-09-01","configuration":{}}
                                """.formatted(termId, storeId)))
                .andExpect(status().isCreated()).andReturn();
        var templateId = json(template).path("id").asText();

        mockMvc.perform(post("/api/v1/admin/template-versions/{templateId}/sop-tasks", templateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"CLEAN","name":"清洁消毒","configuration":{"roleCode":"BARISTA","evidenceRequired":false}}
                                """))
                .andExpect(status().isCreated());
        var certificationRule = mockMvc.perform(post("/api/v1/admin/template-versions/{templateId}/certification-rules", templateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"BARISTA-BASIC","name":"吧台基础认证",
                                 "configuration":{"authorizedDecisionRoles":["%s"],"evidenceRequired":%s,
                                                  "minimumEvidenceCount":%s,"retestRequired":%s}}
                                """.formatted(authorizedDecisionRole, evidenceRequired, minimumEvidenceCount, retestRequired)))
                .andExpect(status().isCreated()).andReturn();
        var certificationRuleId = json(certificationRule).path("id").asText();
        mockMvc.perform(post("/api/v1/admin/template-versions/{templateId}/publish", templateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());

        createMembership(termId, P3_ID);
        createMembership(termId, OTHER_P3_ID);
        createMembership(termId, UNASSIGNED_P3_ID);
        var day = mockMvc.perform(post("/api/v1/operating-days")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","operatingDate":"%s","templateVersionId":"%s"}
                                """.formatted(termId, storeId, operatingDate, templateId)))
                .andExpect(status().isCreated()).andReturn();
        var dayId = json(day).path("id").asText();
        var shift = mockMvc.perform(post("/api/v1/shifts")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operatingDayId":"%s","code":"MORNING","name":"上午班",
                                 "startsAt":"%sT08:00:00Z","endsAt":"%sT12:00:00Z"}
                                """.formatted(dayId, operatingDate, operatingDate)))
                .andExpect(status().isCreated()).andReturn();
        var shiftId = json(shift).path("id").asText();
        assignStudent(shiftId, P3_ID);
        assignStudent(shiftId, OTHER_P3_ID);
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/schedule", shiftId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());
        return new LearningScope(termId, storeId, templateId, shiftId, certificationRuleId);
    }

    private LearningScope additionalLearningScope(LearningScope original, String code, LocalDate operatingDate) throws Exception {
        var day = mockMvc.perform(post("/api/v1/operating-days")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","operatingDate":"%s","templateVersionId":"%s"}
                                """.formatted(original.termId(), original.storeId(), operatingDate, original.templateId())))
                .andExpect(status().isCreated()).andReturn();
        var dayId = json(day).path("id").asText();
        var shift = mockMvc.perform(post("/api/v1/shifts")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operatingDayId":"%s","code":"%s","name":"后续专项练习",
                                 "startsAt":"%sT08:00:00Z","endsAt":"%sT12:00:00Z"}
                                """.formatted(dayId, code, operatingDate, operatingDate)))
                .andExpect(status().isCreated()).andReturn();
        var shiftId = json(shift).path("id").asText();
        assignStudent(shiftId, P3_ID);
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/schedule", shiftId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());
        return new LearningScope(original.termId(), original.storeId(), original.templateId(), shiftId,
                original.certificationRuleId());
    }

    private String createCertification(LearningScope scope, UUID studentId, UUID actorId, String role) throws Exception {
        var result = mockMvc.perform(post("/api/v1/certifications")
                        .with(user(actorId.toString()).roles(role))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"studentAccountId":"%s","templateVersionId":"%s","certificationRuleId":"%s"}
                                """.formatted(studentId, scope.templateId(), scope.certificationRuleId())))
                .andExpect(status().isCreated()).andReturn();
        return json(result).path("id").asText();
    }

    private void assignStudent(String shiftId, UUID accountId) throws Exception {
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/assignments", shiftId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":\"%s\",\"roleCode\":\"BARISTA\"}".formatted(accountId)))
                .andExpect(status().isCreated());
    }

    private void createMembership(String termId, UUID accountId) throws Exception {
        mockMvc.perform(post("/api/v1/admin/terms/{termId}/memberships", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":\"%s\"}".formatted(accountId)))
                .andExpect(status().isCreated());
    }

    private void grantScope(LearningScope scope, UUID accountId, String roleCode) throws Exception {
        mockMvc.perform(post("/api/v1/admin/operation-scope-grants")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","accountId":"%s","roleCode":"%s"}
                                """.formatted(scope.termId(), scope.storeId(), accountId, roleCode)))
                .andExpect(status().isCreated());
    }

    private String createStudentEvidence(LearningScope scope) throws Exception {
        return createStudentEvidence(scope, P3_ID);
    }

    private String createStudentEvidence(LearningScope scope, UUID studentAccountId) throws Exception {
        var taskId = taskId(scope, studentAccountId);
        var evidence = mockMvc.perform(post("/api/v1/evidence")
                        .with(user(studentAccountId.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"taskCompletionId":"%s","kind":"TEXT","textContent":"已完成消毒流程复训记录",
                                 "occurredAt":"2026-09-11T10:00:00Z"}
                                """.formatted(taskId)))
                .andExpect(status().isCreated()).andReturn();
        return json(evidence).path("id").asText();
    }

    private UUID taskId(LearningScope scope, UUID studentAccountId) {
        return jdbcTemplate.queryForObject("""
                select tc.id from ops_task_completions tc
                join ops_shift_assignments a on a.id = tc.assignment_id
                where tc.shift_id = ? and a.account_id = ?
                """, UUID.class, UUID.fromString(scope.shiftId()), studentAccountId);
    }

    private void assertThatAudit(String eventType, UUID resourceId) {
        var count = jdbcTemplate.queryForObject("""
                select count(*) from audit_events where event_type = ? and resource_id = ?
                """, Integer.class, eventType, resourceId);
        assertThat(count).isEqualTo(1);
    }

    private JsonNode json(org.springframework.test.web.servlet.MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private void createActor(UUID id, String loginId, String role) {
        jdbcTemplate.update("""
                insert into iam_accounts (id, login_id, display_name, status, password_hash)
                values (?, ?, ?, 'ACTIVE', '$argon2id$placeholder')
                """, id, loginId, loginId);
        jdbcTemplate.update("""
                insert into iam_role_assignments (id, account_id, role_code)
                values (?, ?, ?)
                """, UUID.randomUUID(), id, role);
    }

    private record LearningScope(String termId, String storeId, String templateId, String shiftId, String certificationRuleId) {
    }
}
