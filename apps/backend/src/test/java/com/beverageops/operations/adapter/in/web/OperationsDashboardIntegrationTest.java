package com.beverageops.operations.adapter.in.web;

import java.time.LocalDate;
import java.time.ZoneOffset;
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

class OperationsDashboardIntegrationTest extends PostgresIntegrationTestBase {

    private static final UUID P1_ID = UUID.fromString("82000000-0000-0000-0000-000000000001");
    private static final UUID P2_ID = UUID.fromString("82000000-0000-0000-0000-000000000002");
    private static final UUID P3_ID = UUID.fromString("82000000-0000-0000-0000-000000000003");
    private static final UUID OTHER_P3_ID = UUID.fromString("82000000-0000-0000-0000-000000000004");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void createActors() {
        createActor(P1_ID, "DASH-P1", "P1");
        createActor(P2_ID, "DASH-P2", "P2");
        createActor(P3_ID, "DASH-P3", "P3");
        createActor(OTHER_P3_ID, "DASH-P3-OTHER", "P3");
    }

    @Test
    void p3DashboardUsesOnlyTheAuthenticatedStudentsAssignmentsAndP2TodayUsesOnlyGrantedStoreScope() throws Exception {
        var today = LocalDate.now(ZoneOffset.UTC);
        var scoped = publishedTemplate("DASH-SCOPED", today);
        var unscoped = publishedTemplate("DASH-UNSCOPED", today);
        grantP2Scope(scoped.termId(), scoped.storeId());

        var scopedDayId = createOperatingDay(scoped, today, P2_ID, "P2");
        var ownShiftId = createShiftForDay(scopedDayId, today, "MORNING", P3_ID, P2_ID, "P2");
        var otherShiftId = createShiftForDay(scopedDayId, today, "AFTERNOON", OTHER_P3_ID, P2_ID, "P2");
        var unscopedDayId = createOperatingDay(unscoped, today, P1_ID, "P1");
        var unscopedShiftId = createShiftForDay(unscopedDayId, today, "EVENING", OTHER_P3_ID, P1_ID, "P1");

        mockMvc.perform(get("/api/v1/me/operations-dashboard")
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignedShifts[0].shiftId").value(ownShiftId))
                .andExpect(jsonPath("$.assignedShifts.length()").value(1));

        mockMvc.perform(get("/api/v1/me/operations-dashboard")
                        .with(user(OTHER_P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.assignedShifts.length()").value(2));

        mockMvc.perform(get("/api/v1/operations/today")
                        .with(user(P2_ID.toString()).roles("P2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.draftShifts.length()").value(2))
                .andExpect(jsonPath("$.draftShifts[0].id").value(ownShiftId))
                .andExpect(jsonPath("$.draftShifts[1].id").value(otherShiftId));

        mockMvc.perform(get("/api/v1/operations/today")
                        .with(user(P2_ID.toString()).roles("P2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.draftShifts[?(@.id == '%s')]".formatted(unscopedShiftId)).isEmpty());

        mockMvc.perform(get("/api/v1/operations/today")
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    private Scope publishedTemplate(String storeCode, LocalDate date) throws Exception {
        var term = mockMvc.perform(post("/api/v1/admin/terms")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"TERM-%s","name":"%s 学期","startDate":"%s","endDate":"%s"}
                                """.formatted(storeCode, storeCode, date.minusDays(1), date.plusDays(30))))
                .andExpect(status().isCreated()).andReturn();
        var termId = json(term).path("id").asText();
        mockMvc.perform(post("/api/v1/admin/terms/{termId}/publish", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());
        var store = mockMvc.perform(post("/api/v1/admin/stores")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"%s\",\"name\":\"%s 门店\"}".formatted(storeCode, storeCode)))
                .andExpect(status().isCreated()).andReturn();
        var storeId = json(store).path("id").asText();
        var template = mockMvc.perform(post("/api/v1/admin/template-versions")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","templateCode":"DAILY-OPS","name":"日常运营模板",
                                 "effectiveFrom":"%s","configuration":{}}
                                """.formatted(termId, storeId, date)))
                .andExpect(status().isCreated()).andReturn();
        var templateId = json(template).path("id").asText();
        mockMvc.perform(post("/api/v1/admin/template-versions/{templateId}/publish", templateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());
        return new Scope(termId, storeId, templateId);
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

    private String createOperatingDay(Scope scope, LocalDate date, UUID actorId, String role) throws Exception {
        var day = mockMvc.perform(post("/api/v1/operating-days")
                        .with(user(actorId.toString()).roles(role))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","operatingDate":"%s","templateVersionId":"%s"}
                                """.formatted(scope.termId(), scope.storeId(), date, scope.templateId())))
                .andExpect(status().isCreated()).andReturn();
        return json(day).path("id").asText();
    }

    private String createShiftForDay(String dayId, LocalDate date, String code, UUID assigneeId, UUID actorId, String role)
            throws Exception {
        var startsAt = switch (code) {
            case "MORNING" -> "08:00:00Z";
            case "AFTERNOON" -> "12:00:00Z";
            default -> "16:00:00Z";
        };
        var endsAt = switch (code) {
            case "MORNING" -> "12:00:00Z";
            case "AFTERNOON" -> "16:00:00Z";
            default -> "20:00:00Z";
        };
        var shift = mockMvc.perform(post("/api/v1/shifts")
                        .with(user(actorId.toString()).roles(role))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operatingDayId":"%s","code":"%s","name":"%s 班",
                                 "startsAt":"%sT%s","endsAt":"%sT%s"}
                                """.formatted(dayId, code, code, date, startsAt, date, endsAt)))
                .andExpect(status().isCreated()).andReturn();
        var shiftId = json(shift).path("id").asText();
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/assignments", shiftId)
                        .with(user(actorId.toString()).roles(role))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":\"%s\",\"roleCode\":\"BARISTA\"}".formatted(assigneeId)))
                .andExpect(status().isCreated());
        return shiftId;
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

    private record Scope(String termId, String storeId, String templateId) {
    }
}
