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
import static org.assertj.core.api.Assertions.assertThat;

class OperationalRiskIntegrationTest extends PostgresIntegrationTestBase {

    private static final UUID P1_ID = UUID.fromString("70000000-0000-0000-0000-000000000001");
    private static final UUID P2_ID = UUID.fromString("70000000-0000-0000-0000-000000000002");
    private static final UUID P3_ID = UUID.fromString("70000000-0000-0000-0000-000000000003");
    private static final UUID RECEIVER_P3_ID = UUID.fromString("70000000-0000-0000-0000-000000000004");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void createActors() {
        createActor(P1_ID, "RISK-P1", "P1");
        createActor(P2_ID, "RISK-P2", "P2");
        createActor(P3_ID, "RISK-P3", "P3");
        createActor(RECEIVER_P3_ID, "RISK-P3-RECEIVER", "P3");
    }

    @Test
    void unavailableExternalOperatingDataStaysPendingUntilSupplementedAndConfirmed() throws Exception {
        var shifts = activeShiftPair("SUMMARY-LAB");

        var pending = mockMvc.perform(post("/api/v1/operating-summaries")
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shiftId":"%s","sourceSystem":"POS-EXPORT","collectionMethod":"MANUAL",
                                 "sourceReference":"2026-09-10-close","collectedAt":"2026-09-10T12:10:00Z",
                                 "pendingSupplement":true,"note":"POS 导出延迟"}
                                """.formatted(shifts.currentShiftId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PENDING_SUPPLEMENT"))
                .andExpect(jsonPath("$.version").value(1))
                .andReturn();
        var summaryId = json(pending).path("id").asText();

        mockMvc.perform(patch("/api/v1/operating-summaries/{summaryId}", summaryId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"summaryData":{"revenue":"1280.00","waste":"12.00"},"pendingSupplement":false,
                                 "note":"已核对门店日报","version":1}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("RECORDED"))
                .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(post("/api/v1/operating-summaries/{summaryId}/confirm", summaryId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CONFIRMED"))
                .andExpect(jsonPath("$.version").value(3));

        assertThatAudit("OPERATING_SUMMARY_CONFIRMED", UUID.fromString(summaryId));
    }

    @Test
    void blockingIncidentNeedsAssignmentAndVerificationBeforeP2CanCloseShift() throws Exception {
        var shifts = activeShiftPair("INCIDENT-LAB");
        var incident = mockMvc.perform(post("/api/v1/incidents")
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shiftId":"%s","categoryCode":"FOOD_SAFETY","severity":"HIGH","blocking":true,
                                 "description":"冷藏设备温度异常"}
                                """.formatted(shifts.currentShiftId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("REPORTED"))
                .andReturn();
        var incidentId = json(incident).path("id").asText();

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/request-close", shifts.currentShiftId())
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(4));
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/close", shifts.currentShiftId())
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":4}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BLOCKING_INCIDENT"));

        mockMvc.perform(post("/api/v1/incidents/{incidentId}/acknowledge", incidentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACKNOWLEDGED"))
                .andExpect(jsonPath("$.version").value(2));
        mockMvc.perform(post("/api/v1/incidents/{incidentId}/assign", incidentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":2,"assigneeAccountId":"%s","dueAt":"2026-09-10T12:30:00Z",
                                 "controlMeasure":"停止使用设备并转移原料"}
                                """.formatted(P3_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.version").value(3));
        mockMvc.perform(post("/api/v1/incidents/{incidentId}/submit-verification", incidentId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":3,\"evidenceReference\":\"TEMP-LOG-20260910\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING_VERIFICATION"))
                .andExpect(jsonPath("$.version").value(4));
        mockMvc.perform(post("/api/v1/incidents/{incidentId}/close", incidentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":4}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"))
                .andExpect(jsonPath("$.version").value(5));

        mockMvc.perform(post("/api/v1/shifts/{shiftId}/close", shifts.currentShiftId())
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":4}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));
    }

    @Test
    void requiredHandoverMustBeAcceptedByItsReceivingStudentBeforeShiftClose() throws Exception {
        var shifts = activeShiftPair("HANDOVER-LAB");
        var handover = mockMvc.perform(post("/api/v1/handovers")
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shiftId":"%s","receivingShiftId":"%s","receivingAccountId":"%s",
                                 "requiredForClose":true,"content":{"uncompletedItems":"补录温度","materialRisk":"冰块不足"}}
                                """.formatted(shifts.currentShiftId(), shifts.nextShiftId(), RECEIVER_P3_ID)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn();
        var handoverId = json(handover).path("id").asText();

        mockMvc.perform(post("/api/v1/handovers/{handoverId}/submit", handoverId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUBMITTED"));
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/request-close", shifts.currentShiftId())
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":3}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/close", shifts.currentShiftId())
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":4}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("HANDOVER_REQUIRED"));

        mockMvc.perform(post("/api/v1/handovers/{handoverId}/accept", handoverId)
                        .with(user(RECEIVER_P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"))
                .andExpect(jsonPath("$.version").value(3));
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/close", shifts.currentShiftId())
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":4}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("CLOSED"));
    }

    @Test
    void riskRecordsCanBeReadOnlyByAuthorisedParticipantsOrScopedManagers() throws Exception {
        var shifts = activeShiftPair("RISK-READ-SCOPE");
        var summary = mockMvc.perform(post("/api/v1/operating-summaries")
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shiftId":"%s","sourceSystem":"POS-EXPORT","collectionMethod":"MANUAL",
                                 "sourceReference":"2026-09-10-close","collectedAt":"2026-09-10T12:10:00Z",
                                 "pendingSupplement":true}
                                """.formatted(shifts.currentShiftId())))
                .andExpect(status().isCreated()).andReturn();
        var summaryId = json(summary).path("id").asText();

        var incident = mockMvc.perform(post("/api/v1/incidents")
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shiftId":"%s","categoryCode":"EQUIPMENT","severity":"MEDIUM","blocking":false,
                                 "description":"封口机待维护"}
                                """.formatted(shifts.currentShiftId())))
                .andExpect(status().isCreated()).andReturn();
        var incidentId = json(incident).path("id").asText();

        var handover = mockMvc.perform(post("/api/v1/handovers")
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shiftId":"%s","receivingShiftId":"%s","receivingAccountId":"%s",
                                 "requiredForClose":false,"content":{"uncompletedItems":"设备保养"}}
                                """.formatted(shifts.currentShiftId(), shifts.nextShiftId(), RECEIVER_P3_ID)))
                .andExpect(status().isCreated()).andReturn();
        var handoverId = json(handover).path("id").asText();

        mockMvc.perform(get("/api/v1/operating-summaries").param("shiftId", shifts.currentShiftId())
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(summaryId));
        mockMvc.perform(get("/api/v1/incidents").param("shiftId", shifts.currentShiftId())
                        .with(user(P2_ID.toString()).roles("P2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(incidentId));
        mockMvc.perform(get("/api/v1/handovers").param("shiftId", shifts.currentShiftId())
                        .with(user(RECEIVER_P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(handoverId));

        mockMvc.perform(get("/api/v1/incidents").param("shiftId", shifts.currentShiftId())
                        .with(user(RECEIVER_P3_ID.toString()).roles("P3")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void scopedP2CanWaiveBlockingIncidentOnlyWithAnImmutableReasonAndAudit() throws Exception {
        var shifts = activeShiftPair("INCIDENT-WAIVER");
        var incident = mockMvc.perform(post("/api/v1/incidents")
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shiftId":"%s","categoryCode":"SERVICE","severity":"HIGH","blocking":true,
                                 "description":"高峰期排队超出服务阈值"}
                                """.formatted(shifts.currentShiftId())))
                .andExpect(status().isCreated()).andReturn();
        var incidentId = json(incident).path("id").asText();

        mockMvc.perform(post("/api/v1/incidents/{incidentId}/waive-blocking", incidentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"reason\":\"现场已启用人工分流，允许结束本班\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(incidentId))
                .andExpect(jsonPath("$.blocking").value(false))
                .andExpect(jsonPath("$.version").value(2));

        var waiverCount = jdbcTemplate.queryForObject("""
                select count(*) from ops_incident_blocking_waivers
                where incident_id = ? and reason = ? and waived_by_account_id = ?
                """, Integer.class, UUID.fromString(incidentId), "现场已启用人工分流，允许结束本班", P2_ID);
        assertThat(waiverCount).isEqualTo(1);
        assertThatAudit("INCIDENT_BLOCKING_WAIVED", UUID.fromString(incidentId));
    }

    @Test
    void handoverDraftCanBeRevisedWithVersionedHistoryByItsInitiator() throws Exception {
        var shifts = activeShiftPair("HANDOVER-REVISION");
        var handover = mockMvc.perform(post("/api/v1/handovers")
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shiftId":"%s","receivingShiftId":"%s","receivingAccountId":"%s",
                                 "requiredForClose":true,"content":{"uncompletedItems":"补录温度"}}
                                """.formatted(shifts.currentShiftId(), shifts.nextShiftId(), RECEIVER_P3_ID)))
                .andExpect(status().isCreated()).andReturn();
        var handoverId = json(handover).path("id").asText();

        mockMvc.perform(patch("/api/v1/handovers/{handoverId}", handoverId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":{\"uncompletedItems\":\"补录温度\",\"nextStep\":\"交给下午班\"},\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.version").value(2));

        var historyCount = jdbcTemplate.queryForObject("""
                select count(*) from ops_handover_history
                where handover_id = ? and event_type = 'HANDOVER_UPDATED'
                """, Integer.class, UUID.fromString(handoverId));
        assertThat(historyCount).isEqualTo(1);
        assertThatAudit("HANDOVER_UPDATED", UUID.fromString(handoverId));
    }

    @Test
    void onlyOriginalReporterCanEditAnUnacknowledgedIncidentAndItsActionsStayAppendOnly() throws Exception {
        var shifts = activeShiftPair("INCIDENT-EDIT");
        var incident = mockMvc.perform(post("/api/v1/incidents")
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shiftId":"%s","categoryCode":"SERVICE","severity":"LOW","blocking":false,
                                 "description":"等待时长偏高"}
                                """.formatted(shifts.currentShiftId())))
                .andExpect(status().isCreated()).andReturn();
        var incidentId = json(incident).path("id").asText();

        mockMvc.perform(patch("/api/v1/incidents/{incidentId}", incidentId)
                        .with(user(RECEIVER_P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryCode\":\"SERVICE\",\"severity\":\"MEDIUM\",\"blocking\":false,\"description\":\"擅自修改\",\"version\":1}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(patch("/api/v1/incidents/{incidentId}", incidentId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"categoryCode\":\"SERVICE\",\"severity\":\"MEDIUM\",\"blocking\":false,\"description\":\"已补充排队时长\",\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.severity").value("MEDIUM"))
                .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(post("/api/v1/incidents/{incidentId}/acknowledge", incidentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/incidents/{incidentId}/assign", incidentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":3,"assigneeAccountId":"%s","dueAt":"2026-09-10T12:30:00Z",
                                 "controlMeasure":"安排入口分流"}
                                """.formatted(P3_ID)))
                .andExpect(status().isOk());
        var actionCount = jdbcTemplate.queryForObject("""
                select count(*) from ops_incident_actions where incident_id = ? and action_type = 'CONTROL_MEASURE'
                """, Integer.class, UUID.fromString(incidentId));
        assertThat(actionCount).isEqualTo(1);
    }

    @Test
    void onlyHandoverInitiatorMaySubmitAndP2ApprovalIsLimitedToRequiredHandovers() throws Exception {
        var shifts = activeShiftPair("HANDOVER-AUTHOR");
        var optional = createHandover(shifts, false);
        mockMvc.perform(post("/api/v1/handovers/{handoverId}/submit", optional)
                        .with(user(RECEIVER_P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/handovers/{handoverId}/submit", optional)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/handovers/{handoverId}/accept", optional)
                        .with(user(RECEIVER_P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/handovers/{handoverId}/approve", optional)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":3}"))
                .andExpect(status().isConflict());
    }

    @Test
    void scopedP2CanReturnInsufficientIncidentVerificationBackToTheResolver() throws Exception {
        var shifts = activeShiftPair("INCIDENT-RETURN");
        var incident = mockMvc.perform(post("/api/v1/incidents")
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shiftId":"%s","categoryCode":"FOOD_SAFETY","severity":"HIGH","blocking":true,
                                 "description":"冷藏温度异常"}
                                """.formatted(shifts.currentShiftId())))
                .andExpect(status().isCreated()).andReturn();
        var incidentId = json(incident).path("id").asText();
        mockMvc.perform(post("/api/v1/incidents/{incidentId}/acknowledge", incidentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/incidents/{incidentId}/assign", incidentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":2,"assigneeAccountId":"%s","dueAt":"2026-09-10T12:30:00Z",
                                 "controlMeasure":"停止使用设备"}
                                """.formatted(P3_ID)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/incidents/{incidentId}/submit-verification", incidentId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":3,\"evidenceReference\":\"TEMP-LOG-1\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/v1/incidents/{incidentId}/return-verification", incidentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":4,\"reason\":\"温度日志缺少复测记录\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.version").value(5));
        assertThatAudit("INCIDENT_VERIFICATION_RETURNED", UUID.fromString(incidentId));
    }

    @Test
    void reopenedIncidentCanBeReassignedAndReturnToResolutionFlow() throws Exception {
        var shifts = activeShiftPair("INCIDENT-REOPEN");
        var incident = mockMvc.perform(post("/api/v1/incidents")
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shiftId":"%s","categoryCode":"EQUIPMENT","severity":"HIGH","blocking":true,
                                 "description":"制冰机漏水"}
                                """.formatted(shifts.currentShiftId())))
                .andExpect(status().isCreated()).andReturn();
        var incidentId = json(incident).path("id").asText();
        acknowledgeAssignVerifyAndClose(incidentId);
        mockMvc.perform(post("/api/v1/incidents/{incidentId}/reopen", incidentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":5,\"reason\":\"复查发现仍有渗水\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REOPENED"))
                .andExpect(jsonPath("$.version").value(6));
        mockMvc.perform(post("/api/v1/incidents/{incidentId}/assign", incidentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":6,"assigneeAccountId":"%s","dueAt":"2026-09-10T13:00:00Z",
                                 "controlMeasure":"停机并放置接水盘"}
                                """.formatted(P3_ID)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("IN_PROGRESS"))
                .andExpect(jsonPath("$.version").value(7));
    }

    private ShiftPair activeShiftPair(String storeCode) throws Exception {
        var setup = template(storeCode);
        grantP2Scope(setup.termId(), setup.storeId());
        var day = mockMvc.perform(post("/api/v1/operating-days")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","operatingDate":"2026-09-10","templateVersionId":"%s"}
                                """.formatted(setup.termId(), setup.storeId(), setup.templateId())))
                .andExpect(status().isCreated()).andReturn();
        var dayId = json(day).path("id").asText();
        var current = createShift(dayId, "MORNING", "2026-09-10T08:00:00Z", "2026-09-10T12:00:00Z", P3_ID);
        var next = createShift(dayId, "AFTERNOON", "2026-09-10T12:00:00Z", "2026-09-10T16:00:00Z", RECEIVER_P3_ID);
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/start", current)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(3));
        return new ShiftPair(current, next);
    }

    private String createHandover(ShiftPair shifts, boolean requiredForClose) throws Exception {
        var response = mockMvc.perform(post("/api/v1/handovers")
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"shiftId":"%s","receivingShiftId":"%s","receivingAccountId":"%s",
                                 "requiredForClose":%s,"content":{"uncompletedItems":"设备保养"}}
                                """.formatted(shifts.currentShiftId(), shifts.nextShiftId(), RECEIVER_P3_ID, requiredForClose)))
                .andExpect(status().isCreated()).andReturn();
        return json(response).path("id").asText();
    }

    private void acknowledgeAssignVerifyAndClose(String incidentId) throws Exception {
        mockMvc.perform(post("/api/v1/incidents/{incidentId}/acknowledge", incidentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/incidents/{incidentId}/assign", incidentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"version":2,"assigneeAccountId":"%s","dueAt":"2026-09-10T12:30:00Z",
                                 "controlMeasure":"停止使用设备"}
                                """.formatted(P3_ID)))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/incidents/{incidentId}/submit-verification", incidentId)
                        .with(user(P3_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":3,\"evidenceReference\":\"TEMP-LOG-REOPEN\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/incidents/{incidentId}/close", incidentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":4}"))
                .andExpect(status().isOk());
    }

    private String createShift(String dayId, String code, String startsAt, String endsAt, UUID assigneeId) throws Exception {
        var shift = mockMvc.perform(post("/api/v1/shifts")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"operatingDayId":"%s","code":"%s","name":"%s 班",
                                 "startsAt":"%s","endsAt":"%s"}
                                """.formatted(dayId, code, code, startsAt, endsAt)))
                .andExpect(status().isCreated()).andReturn();
        var shiftId = json(shift).path("id").asText();
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/assignments", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":\"%s\",\"roleCode\":\"BARISTA\"}".formatted(assigneeId)))
                .andExpect(status().isCreated());
        mockMvc.perform(post("/api/v1/shifts/{shiftId}/schedule", shiftId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk());
        return shiftId;
    }

    private TemplateSetup template(String storeCode) throws Exception {
        var term = mockMvc.perform(post("/api/v1/admin/terms").with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"TERM-%s","name":"%s 学期","startDate":"2026-09-01","endDate":"2027-01-20"}
                                """.formatted(storeCode, storeCode)))
                .andExpect(status().isCreated()).andReturn();
        var termId = json(term).path("id").asText();
        mockMvc.perform(post("/api/v1/admin/terms/{termId}/publish", termId).with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());
        var store = mockMvc.perform(post("/api/v1/admin/stores").with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"%s\",\"name\":\"%s 门店\"}".formatted(storeCode, storeCode)))
                .andExpect(status().isCreated()).andReturn();
        var storeId = json(store).path("id").asText();
        var template = mockMvc.perform(post("/api/v1/admin/template-versions").with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","templateCode":"DAILY-OPS","name":"日常运营模板",
                                 "effectiveFrom":"2026-09-01","configuration":{}}
                                """.formatted(termId, storeId)))
                .andExpect(status().isCreated()).andReturn();
        var templateId = json(template).path("id").asText();
        mockMvc.perform(post("/api/v1/admin/template-versions/{templateId}/publish", templateId)
                        .with(user(P1_ID.toString()).roles("P1")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk());
        return new TemplateSetup(termId, storeId, templateId);
    }

    private void grantP2Scope(String termId, String storeId) throws Exception {
        mockMvc.perform(post("/api/v1/admin/operation-scope-grants").with(user(P1_ID.toString()).roles("P1"))
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

    private record ShiftPair(String currentShiftId, String nextShiftId) {
    }
}
