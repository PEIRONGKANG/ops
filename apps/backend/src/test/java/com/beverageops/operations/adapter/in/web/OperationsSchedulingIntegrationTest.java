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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class OperationsSchedulingIntegrationTest extends PostgresIntegrationTestBase {

    private static final UUID P1_ID = UUID.fromString("50000000-0000-0000-0000-000000000001");
    private static final UUID P2_ID = UUID.fromString("50000000-0000-0000-0000-000000000002");
    private static final UUID P3_ID = UUID.fromString("50000000-0000-0000-0000-000000000003");
    private static final UUID OTHER_P3_ID = UUID.fromString("50000000-0000-0000-0000-000000000004");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void createActors() {
        createActor(P1_ID, "OPS-P1", "P1");
        createActor(P2_ID, "OPS-P2", "P2");
        createActor(P3_ID, "OPS-P3", "P3");
        createActor(OTHER_P3_ID, "OPS-P3-OTHER", "P3");
    }

    @Test
    void scopedP2CanSchedulePublishedTemplateAndP3CanRunOnlyTheirAssignedShift() throws Exception {
        var setup = publishedTemplate("MAIN-LAB", "主实训门店", "DAILY-OPS", "日常运营模板");
        grantP2Scope(setup.termId(), setup.storeId());

        var operatingDay = mockMvc.perform(post("/api/v1/operating-days")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","operatingDate":"2026-09-02","templateVersionId":"%s"}
                                """.formatted(setup.termId(), setup.storeId(), setup.templateId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.templateRevision").value(1))
                .andReturn();
        var operatingDayId = json(operatingDay).path("id").asText();

        var shift = mockMvc.perform(post("/api/v1/shifts")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operatingDayId":"%s","code":"MORNING","name":"上午班",
                                 "startsAt":"2026-09-02T08:00:00Z","endsAt":"2026-09-02T12:00:00Z"}
                                """.formatted(operatingDayId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.version").value(1))
                .andReturn();
        var shiftId = json(shift).path("id").asText();

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/assignments", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"accountId":"%s","roleCode":"BARISTA","reason":"本周轮值"}
                                """.formatted(P3_ID)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ASSIGNED"));

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/schedule", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{" + "\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SCHEDULED"))
                .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(get("/api/v1/me/shifts")
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].shiftId").value(shiftId))
                .andExpect(jsonPath("$[0].roleCode").value("BARISTA"));

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/start", shiftId)
                        .with(user(OTHER_P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/start", shiftId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.version").value(3));

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/request-close", shiftId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("KEY_APPROVAL_PENDING"))
                .andExpect(jsonPath("$.version").value(4));

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/close", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":4}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.version").value(5));

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/reopen", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":5,\"reason\":\"发现闭店资料遗漏\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REOPENED"))
                .andExpect(jsonPath("$.version").value(6));

        assertThatAudit("SHIFT_REOPENED", UUID.fromString(shiftId));
    }

    @Test
    void assignmentConflictsAndUnscopedStoresAreRejectedWithoutTrustingRequestIds() throws Exception {
        var main = publishedTemplate("MAIN-LAB", "主实训门店", "DAILY-OPS", "日常运营模板");
        var second = publishedTemplate("SECOND-LAB", "第二实训门店", "DAILY-OPS", "第二门店运营模板");
        var unscoped = publishedTemplate("UNSCOPED-LAB", "未授权门店", "DAILY-OPS", "未授权运营模板");
        grantP2Scope(main.termId(), main.storeId());
        grantP2Scope(second.termId(), second.storeId());

        mockMvc.perform(post("/api/v1/operating-days")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","operatingDate":"2026-09-03","templateVersionId":"%s"}
                                """.formatted(unscoped.termId(), unscoped.storeId(), unscoped.templateId())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        var firstShiftId = createScheduledShift(main, "2026-09-03T08:00:00Z", "2026-09-03T12:00:00Z");
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/assignments", firstShiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":\"%s\",\"roleCode\":\"BARISTA\"}".formatted(P3_ID)))
                .andExpect(status().isCreated());

        var secondShiftId = createDraftShift(second, "2026-09-03T08:00:00Z", "2026-09-03T12:00:00Z");
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/assignments", secondShiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":\"%s\",\"roleCode\":\"BARISTA\"}".formatted(P3_ID)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ASSIGNMENT_CONFLICT"));
    }

    @Test
    void cancellingAShiftRequiresReasonAndRetainsTheCancelledRecord() throws Exception {
        var setup = publishedTemplate("CANCEL-LAB", "取消测试门店", "DAILY-OPS", "日常运营模板");
        grantP2Scope(setup.termId(), setup.storeId());
        var shiftId = createDraftShift(setup, "2026-09-04T08:00:00Z", "2026-09-04T12:00:00Z");

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/cancel", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/cancel", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"reason\":\"门店设备检修\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.cancellationReason").value("门店设备检修"));

        mockMvc.perform(get("/api/v1/shifts/{shiftId}", shiftId)
                        .with(user(P2_ID.toString()).roles("P2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"));
    }

    @Test
    void assignmentChangesRequireReasonsAndKeepAnImmutableChangeTrail() throws Exception {
        var setup = publishedTemplate("ASSIGNMENT-PATCH-LAB", "岗位调整测试门店", "DAILY-OPS", "日常运营模板");
        grantP2Scope(setup.termId(), setup.storeId());
        var shiftId = createDraftShift(setup, "2026-09-05T08:00:00Z", "2026-09-05T12:00:00Z");
        var created = mockMvc.perform(post("/api/v1/shifts/{shiftId}/assignments", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":\"%s\",\"roleCode\":\"BARISTA\",\"reason\":\"首次定岗\"}".formatted(P3_ID)))
                .andExpect(status().isCreated())
                .andReturn();
        var assignmentId = json(created).path("id").asText();

        mockMvc.perform(patch("/api/v1/shifts/{shiftId}/assignments", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"assignmentId":"%s","roleCode":"CASHIER","reason":"轮换收银岗位","version":1}
                                """.formatted(assignmentId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ASSIGNED"))
                .andExpect(jsonPath("$.roleCode").value("CASHIER"))
                .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(patch("/api/v1/shifts/{shiftId}/assignments", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"assignmentId\":\"%s\",\"cancelled\":true,\"version\":2}".formatted(assignmentId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        mockMvc.perform(patch("/api/v1/shifts/{shiftId}/assignments", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"assignmentId":"%s","cancelled":true,"reason":"学生临时病假","version":2}
                                """.formatted(assignmentId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CANCELLED"))
                .andExpect(jsonPath("$.version").value(3));

        var historyCount = jdbcTemplate.queryForObject("""
                select count(*) from ops_assignment_change_history where assignment_id = ?
                """, Integer.class, UUID.fromString(assignmentId));
        org.assertj.core.api.Assertions.assertThat(historyCount).isEqualTo(3);
        assertThatAudit("SHIFT_ASSIGNMENT_CANCELLED", UUID.fromString(assignmentId));
    }

    @Test
    void operatingDayCanBeChangedOnlyBeforeShiftsAndStoreShiftTimesCannotOverlap() throws Exception {
        var setup = publishedTemplate("PATCH-LAB", "修改测试门店", "DAILY-OPS", "日常运营模板");
        grantP2Scope(setup.termId(), setup.storeId());
        var operatingDay = mockMvc.perform(post("/api/v1/operating-days")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","operatingDate":"2026-09-05","templateVersionId":"%s"}
                                """.formatted(setup.termId(), setup.storeId(), setup.templateId())))
                .andExpect(status().isCreated())
                .andReturn();
        var operatingDayId = json(operatingDay).path("id").asText();

        mockMvc.perform(patch("/api/v1/operating-days/{operatingDayId}", operatingDayId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"operatingDate\":\"2026-09-06\",\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.operatingDate").value("2026-09-06"))
                .andExpect(jsonPath("$.version").value(2));

        var firstShift = mockMvc.perform(post("/api/v1/shifts")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operatingDayId":"%s","code":"MORNING","name":"上午班",
                                 "startsAt":"2026-09-06T08:00:00Z","endsAt":"2026-09-06T12:00:00Z"}
                                """.formatted(operatingDayId)))
                .andExpect(status().isCreated())
                .andReturn();

        mockMvc.perform(post("/api/v1/shifts")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operatingDayId":"%s","code":"OVERLAP","name":"重叠班",
                                 "startsAt":"2026-09-06T10:00:00Z","endsAt":"2026-09-06T14:00:00Z"}
                                """.formatted(operatingDayId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("SHIFT_CONFLICT"));

        mockMvc.perform(patch("/api/v1/operating-days/{operatingDayId}", operatingDayId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"operatingDate\":\"2026-09-07\",\"version\":2}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STATE_CONFLICT"));

        org.assertj.core.api.Assertions.assertThat(json(firstShift).path("id").asText()).isNotBlank();
    }

    private TemplateSetup publishedTemplate(String storeCode, String storeName, String templateCode, String templateName)
            throws Exception {
        var term = mockMvc.perform(post("/api/v1/admin/terms")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"TERM-%s","name":"%s 学期","startDate":"2026-09-01","endDate":"2027-01-20"}
                                """.formatted(storeCode, storeName)))
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
                        .content("{\"code\":\"%s\",\"name\":\"%s\"}".formatted(storeCode, storeName)))
                .andExpect(status().isCreated())
                .andReturn();
        var storeId = json(store).path("id").asText();
        var template = mockMvc.perform(post("/api/v1/admin/template-versions")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","templateCode":"%s","name":"%s",
                                 "effectiveFrom":"2026-09-01","configuration":{"roles":[{"code":"BARISTA","name":"吧台"}],"tasks":[]}}
                                """.formatted(termId, storeId, templateCode, templateName)))
                .andExpect(status().isCreated())
                .andReturn();
        var templateId = json(template).path("id").asText();
        mockMvc.perform(post("/api/v1/admin/template-versions/{templateId}/publish", templateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk());
        return new TemplateSetup(termId, storeId, templateId);
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

    private String createScheduledShift(TemplateSetup setup, String startsAt, String endsAt) throws Exception {
        var shiftId = createDraftShift(setup, startsAt, endsAt);
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/assignments", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":\"%s\",\"roleCode\":\"SUPPORT\"}".formatted(OTHER_P3_ID)))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/schedule", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk());
        return shiftId;
    }

    private String createDraftShift(TemplateSetup setup, String startsAt, String endsAt) throws Exception {
        var day = mockMvc.perform(post("/api/v1/operating-days")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","operatingDate":"2026-09-03","templateVersionId":"%s"}
                                """.formatted(setup.termId(), setup.storeId(), setup.templateId())))
                .andExpect(status().isCreated())
                .andReturn();
        var dayId = json(day).path("id").asText();
        var shift = mockMvc.perform(post("/api/v1/shifts")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operatingDayId":"%s","code":"SHIFT-%s","name":"测试班次",
                                 "startsAt":"%s","endsAt":"%s"}
                                """.formatted(dayId, UUID.randomUUID().toString().substring(0, 8), startsAt, endsAt)))
                .andExpect(status().isCreated())
                .andReturn();
        return json(shift).path("id").asText();
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
}
