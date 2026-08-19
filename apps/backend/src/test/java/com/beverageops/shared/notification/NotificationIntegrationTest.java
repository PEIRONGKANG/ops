package com.beverageops.shared.notification;

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

class NotificationIntegrationTest extends PostgresIntegrationTestBase {

    private static final UUID P1_ID = UUID.fromString("81000000-0000-0000-0000-000000000001");
    private static final UUID P2_ID = UUID.fromString("81000000-0000-0000-0000-000000000002");
    private static final UUID P3_ID = UUID.fromString("81000000-0000-0000-0000-000000000003");
    private static final UUID OTHER_P3_ID = UUID.fromString("81000000-0000-0000-0000-000000000004");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void createActors() {
        createActor(P1_ID, "NOTIFY-P1", "P1");
        createActor(P2_ID, "NOTIFY-P2", "P2");
        createActor(P3_ID, "NOTIFY-P3", "P3");
        createActor(OTHER_P3_ID, "NOTIFY-P3-OTHER", "P3");
    }

    @Test
    void assignmentCreatesANotificationOnlyForTheAssignedStudentAndOnlyTheyCanMarkItRead() throws Exception {
        var scope = publishedTemplate();
        grantP2Scope(scope.termId(), scope.storeId());
        var shiftId = createDraftShift(scope);

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/assignments", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":\"%s\",\"roleCode\":\"BARISTA\",\"reason\":\"本周轮值\"}".formatted(P3_ID)))
                .andExpect(status().isCreated());

        var notification = mockMvc.perform(get("/api/v1/notifications")
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].eventType").value("SHIFT_ASSIGNMENT_CREATED"))
                .andExpect(jsonPath("$[0].resourceType").value("SHIFT_ASSIGNMENT"))
                .andExpect(jsonPath("$[0].readAt").isEmpty())
                .andReturn();
        var notificationId = json(notification).path(0).path("id").asText();

        mockMvc.perform(get("/api/v1/notifications")
                        .with(user(OTHER_P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(post("/api/v1/notifications/{notificationId}/read", notificationId)
                        .with(user(OTHER_P3_ID.toString()).roles("P3")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mockMvc.perform(post("/api/v1/notifications/{notificationId}/read", notificationId)
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readAt").isNotEmpty());
    }

    @Test
    void recipientCanMarkAllOwnUnreadNotificationsReadWithoutChangingAnotherStudentsNotifications() throws Exception {
        var scope = publishedTemplate();
        grantP2Scope(scope.termId(), scope.storeId());
        var shiftId = createDraftShift(scope);
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/assignments", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":\"%s\",\"roleCode\":\"BARISTA\"}".formatted(P3_ID)))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/assignments", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":\"%s\",\"roleCode\":\"CASHIER\"}".formatted(OTHER_P3_ID)))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/v1/notifications/read-all")
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.updatedCount").value(1));

        mockMvc.perform(get("/api/v1/notifications")
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].readAt").isNotEmpty());
        mockMvc.perform(get("/api/v1/notifications")
                        .with(user(OTHER_P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].readAt").isEmpty());
    }

    private Scope publishedTemplate() throws Exception {
        var term = mockMvc.perform(post("/api/v1/admin/terms")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"TERM-NOTIFY\",\"name\":\"通知学期\",\"startDate\":\"2026-09-01\",\"endDate\":\"2027-01-20\"}"))
                .andExpect(status().isCreated()).andReturn();
        var termId = json(term).path("id").asText();
        mockMvc.perform(post("/api/v1/admin/terms/{termId}/publish", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());

        var store = mockMvc.perform(post("/api/v1/admin/stores")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"NOTIFY-LAB\",\"name\":\"通知实训门店\"}"))
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

    private String createDraftShift(Scope scope) throws Exception {
        var day = mockMvc.perform(post("/api/v1/operating-days")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","operatingDate":"2026-09-02","templateVersionId":"%s"}
                                """.formatted(scope.termId(), scope.storeId(), scope.templateId())))
                .andExpect(status().isCreated()).andReturn();
        var dayId = json(day).path("id").asText();
        var shift = mockMvc.perform(post("/api/v1/shifts")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operatingDayId":"%s","code":"MORNING","name":"上午班",
                                 "startsAt":"2026-09-02T08:00:00Z","endsAt":"2026-09-02T12:00:00Z"}
                                """.formatted(dayId)))
                .andExpect(status().isCreated()).andReturn();
        return json(shift).path("id").asText();
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
