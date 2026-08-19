package com.beverageops.operations.adapter.in.web;

import java.util.UUID;

import com.beverageops.support.PostgresIntegrationTestBase;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ShiftExecutionIntegrationTest extends PostgresIntegrationTestBase {

    private static final UUID P1_ID = UUID.fromString("60000000-0000-0000-0000-000000000001");
    private static final UUID P2_ID = UUID.fromString("60000000-0000-0000-0000-000000000002");
    private static final UUID P3_ID = UUID.fromString("60000000-0000-0000-0000-000000000003");
    private static final UUID OTHER_P3_ID = UUID.fromString("60000000-0000-0000-0000-000000000004");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void createActors() {
        createActor(P1_ID, "EXEC-P1", "P1");
        createActor(P2_ID, "EXEC-P2", "P2");
        createActor(P3_ID, "EXEC-P3", "P3");
        createActor(OTHER_P3_ID, "EXEC-P3-OTHER", "P3");
    }

    @Test
    void assignedStudentNeedsEvidenceAndP2ReturnCreatesAnImmutableTaskHistory() throws Exception {
        var shift = scheduledExecutionShift("TASK-LAB", "2026-09-08T08:00:00Z", "2026-09-08T12:00:00Z");
        var taskId = personalTask(shift.shiftId());

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/start", shift.shiftId())
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"));

        mockMvc.perform(post("/api/v1/task-completions/{taskId}/submit", taskId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVIDENCE_REQUIRED"));

        mockMvc.perform(post("/api/v1/task-completions/{taskId}/submit", taskId)
                        .with(user(OTHER_P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/v1/evidence")
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"taskCompletionId":"%s","kind":"TEXT","textContent":"已完成开店卫生检查",
                                 "occurredAt":"2026-09-08T08:20:00Z"}
                                """.formatted(taskId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.kind").value("TEXT"))
                .andExpect(jsonPath("$.version").value(1));

        mockMvc.perform(post("/api/v1/task-completions/{taskId}/submit", taskId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(post("/api/v1/task-completions/{taskId}/return", taskId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        mockMvc.perform(post("/api/v1/task-completions/{taskId}/return", taskId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2,\"reason\":\"请补充检查说明\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RETURNED"))
                .andExpect(jsonPath("$.version").value(3));

        mockMvc.perform(post("/api/v1/task-completions/{taskId}/submit", taskId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.version").value(4));

        mockMvc.perform(post("/api/v1/task-completions/{taskId}/accept", taskId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":4}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.version").value(5));

        var historyCount = jdbcTemplate.queryForObject("""
                select count(*) from ops_task_completion_history where task_completion_id = ?
                """, Integer.class, UUID.fromString(taskId));
        org.assertj.core.api.Assertions.assertThat(historyCount).isEqualTo(5);
        assertThatAudit("TASK_COMPLETION_ACCEPTED", UUID.fromString(taskId));
    }

    @Test
    void requiredMilestoneMustBeApprovedBeforeP2CanCloseTheShift() throws Exception {
        var shift = scheduledExecutionShift("MILESTONE-LAB", "2026-09-09T08:00:00Z", "2026-09-09T12:00:00Z");

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/start", shift.shiftId())
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/request-close", shift.shiftId())
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("KEY_APPROVAL_PENDING"))
                .andExpect(jsonPath("$.version").value(4));

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/close", shift.shiftId())
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":4}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("KEY_APPROVAL_REQUIRED"));

        var milestoneId = personalMilestone(shift.shiftId());
        mockMvc.perform(post("/api/v1/milestone-submissions/{milestoneId}/submit", milestoneId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("EVIDENCE_REQUIRED"));

        mockMvc.perform(post("/api/v1/evidence")
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"milestoneSubmissionId":"%s","kind":"EXTERNAL_LINK",
                                 "externalUrl":"https://example.invalid/close-check","occurredAt":"2026-09-09T11:50:00Z"}
                                """.formatted(milestoneId)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/milestone-submissions/{milestoneId}/submit", milestoneId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(post("/api/v1/milestone-submissions/{milestoneId}/approve", milestoneId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.version").value(3));

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/close", shift.shiftId())
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":4}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));

        var decisionCount = jdbcTemplate.queryForObject("""
                select count(*) from ops_milestone_decisions where milestone_submission_id = ? and decision = 'APPROVED'
                """, Integer.class, UUID.fromString(milestoneId));
        org.assertj.core.api.Assertions.assertThat(decisionCount).isEqualTo(1);
    }

    private ShiftSetup scheduledExecutionShift(String storeCode, String startsAt, String endsAt) throws Exception {
        var setup = executionTemplate(storeCode);
        grantP2Scope(setup.termId(), setup.storeId());
        var day = mockMvc.perform(post("/api/v1/operating-days")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","operatingDate":"2026-09-08","templateVersionId":"%s"}
                                """.formatted(setup.termId(), setup.storeId(), setup.templateId())))
                .andExpect(status().isCreated())
                .andReturn();
        var dayId = json(day).path("id").asText();
        var createdShift = mockMvc.perform(post("/api/v1/shifts")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operatingDayId":"%s","code":"MORNING","name":"上午班",
                                 "startsAt":"%s","endsAt":"%s"}
                                """.formatted(dayId, startsAt, endsAt)))
                .andExpect(status().isCreated())
                .andReturn();
        var shiftId = json(createdShift).path("id").asText();
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/assignments", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":\"%s\",\"roleCode\":\"BARISTA\"}".formatted(P3_ID)))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/schedule", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SCHEDULED"));
        return new ShiftSetup(shiftId);
    }

    private TemplateSetup executionTemplate(String storeCode) throws Exception {
        var term = mockMvc.perform(post("/api/v1/admin/terms")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"TERM-%s","name":"%s 学期","startDate":"2026-09-01","endDate":"2027-01-20"}
                                """.formatted(storeCode, storeCode)))
                .andExpect(status().isCreated())
                .andReturn();
        var termId = json(term).path("id").asText();
        mockMvc.perform(post("/api/v1/admin/terms/{termId}/publish", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk());
        var store = mockMvc.perform(post("/api/v1/admin/stores")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"%s\",\"name\":\"%s 门店\"}".formatted(storeCode, storeCode)))
                .andExpect(status().isCreated())
                .andReturn();
        var storeId = json(store).path("id").asText();
        var template = mockMvc.perform(post("/api/v1/admin/template-versions")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","templateCode":"DAILY-OPS","name":"日常运营模板",
                                 "effectiveFrom":"2026-09-01","configuration":{"roles":[{"code":"BARISTA","name":"吧台"}]}}
                                """.formatted(termId, storeId)))
                .andExpect(status().isCreated())
                .andReturn();
        var templateId = json(template).path("id").asText();
        mockMvc.perform(post("/api/v1/admin/template-versions/{templateId}/sop-tasks", templateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"OPENING_CHECK","name":"开店卫生检查",
                                 "configuration":{"roleCode":"BARISTA","evidenceRequired":true,"requiresP2Acceptance":true}}
                                """))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/admin/template-versions/{templateId}/milestones", templateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"CLOSING_RELEASE","name":"闭店关键签核",
                                 "configuration":{"required":true,"evidenceRequired":true}}
                                """))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/admin/template-versions/{templateId}/publish", templateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk());
        return new TemplateSetup(termId, storeId, templateId);
    }

    private String personalTask(String shiftId) throws Exception {
        var response = mockMvc.perform(get("/api/v1/shifts/{shiftId}/tasks", shiftId)
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].roleCode").value("BARISTA"))
                .andReturn();
        return json(response).get(0).path("id").asText();
    }

    private String personalMilestone(String shiftId) throws Exception {
        var response = mockMvc.perform(get("/api/v1/shifts/{shiftId}/milestones", shiftId)
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value("CLOSING_RELEASE"))
                .andReturn();
        return json(response).get(0).path("id").asText();
    }

    private void grantP2Scope(String termId, String storeId) throws Exception {
        mockMvc.perform(post("/api/v1/admin/operation-scope-grants")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","accountId":"%s","roleCode":"P2"}
                                """.formatted(termId, storeId, P2_ID)))
                .andExpect(status().isCreated());
    }

    private void assertThatAudit(String eventType, UUID resourceId) {
        var count = jdbcTemplate.queryForObject("""
                select count(*) from audit_events where event_type = ? and resource_id = ?
                """, Integer.class, eventType, resourceId);
        org.assertj.core.api.Assertions.assertThat(count).isEqualTo(1);
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

    private record TemplateSetup(String termId, String storeId, String templateId) {
    }

    private record ShiftSetup(String shiftId) {
    }
}
