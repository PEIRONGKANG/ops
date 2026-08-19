package com.beverageops.learning.adapter.in.web;

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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class CoursePreparationIntegrationTest extends PostgresIntegrationTestBase {

    private static final UUID P1_ID = UUID.fromString("92000000-0000-0000-0000-000000000001");
    private static final UUID T1_ID = UUID.fromString("92000000-0000-0000-0000-000000000002");
    private static final UUID P3_A_ID = UUID.fromString("92000000-0000-0000-0000-000000000003");
    private static final UUID P3_B_ID = UUID.fromString("92000000-0000-0000-0000-000000000004");
    private static final UUID P3_OTHER_TEAM_ID = UUID.fromString("92000000-0000-0000-0000-000000000005");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void createActors() {
        createActor(P1_ID, "COURSE-P1", "P1");
        createActor(T1_ID, "COURSE-T1", "T1");
        createActor(P3_A_ID, "COURSE-P3-A", "P3");
        createActor(P3_B_ID, "COURSE-P3-B", "P3");
        createActor(P3_OTHER_TEAM_ID, "COURSE-P3-OTHER", "P3");
    }

    @Test
    void publishedMaterialCanBeAcknowledgedByTermStudentButDraftCannot() throws Exception {
        var scope = courseScope("MATERIAL");
        var material = mockMvc.perform(post("/api/v1/teaching-materials")
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","teachingWeekId":"%s","title":"食品安全上岗资料",
                                 "content":{"kind":"TEXT","body":"完成学习后才可上岗"}}
                                """.formatted(scope.termId(), scope.preparationWeekId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn();
        var materialId = json(material).path("id").asText();

        mockMvc.perform(post("/api/v1/teaching-materials/{materialId}/acknowledgements", materialId)
                        .with(user(P3_A_ID.toString()).roles("P3")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STATE_CONFLICT"));

        mockMvc.perform(post("/api/v1/teaching-materials/{materialId}/publish", materialId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(post("/api/v1/teaching-materials/{materialId}/acknowledgements", materialId)
                        .with(user(P3_A_ID.toString()).roles("P3")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.materialId").value(materialId));

        mockMvc.perform(get("/api/v1/teaching-materials").param("termId", scope.termId())
                        .with(user(P3_A_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].acknowledged").value(true));
        assertThatAudit("TEACHING_MATERIAL_PUBLISHED", UUID.fromString(materialId));
    }

    @Test
    void courseTaskSubmissionIsPrivateToItsStudentAndKeepsVersionedHistory() throws Exception {
        var scope = courseScope("TASK");
        var task = createAndPublishTask(scope, "市场调研任务", "INDIVIDUAL");
        var taskId = json(task).path("id").asText();

        var submission = mockMvc.perform(post("/api/v1/course-tasks/{taskId}/submissions", taskId)
                        .with(user(P3_A_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":{\"market\":\"校园午间冷饮需求\",\"sourceReference\":\"SURVEY-001\"}}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.revision").value(1))
                .andExpect(jsonPath("$.status").value("SUBMITTED"))
                .andReturn();
        var submissionId = json(submission).path("id").asText();

        mockMvc.perform(get("/api/v1/course-tasks/{taskId}/submissions", taskId)
                        .with(user(P3_B_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(post("/api/v1/course-tasks/{taskId}/submissions", taskId)
                        .with(user(P3_A_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"content\":{\"market\":\"校园午间冷饮需求（补充）\"}}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.revision").value(2));

        assertThat(jdbcTemplate.queryForObject("select count(*) from learning_course_task_submissions where task_id = ?",
                Integer.class, UUID.fromString(taskId))).isEqualTo(2);
        assertThatAudit("COURSE_TASK_SUBMISSION_CREATED", UUID.fromString(submissionId));
    }

    @Test
    void teamCreativeWorkSupportsTeacherFeedbackButCrossTeamReadAndPostPublishEditsAreDenied() throws Exception {
        var scope = courseScope("CREATIVE");
        var work = mockMvc.perform(post("/api/v1/creative-works")
                        .with(user(P3_A_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","teamId":"%s","teachingWeekId":"%s","title":"桂香冷萃",
                                 "content":{"idea":"桂花与冷萃组合","recipe":["冷萃咖啡","桂花糖浆"],
                                            "specialMaterialList":["干桂花"],"posterReference":"object://poster-v1"}}
                                """.formatted(scope.termId(), scope.teamAId(), scope.creativeWeekId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.currentRevision").value(1))
                .andReturn();
        var workId = json(work).path("id").asText();

        mockMvc.perform(get("/api/v1/creative-works").param("termId", scope.termId())
                        .with(user(P3_B_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(workId));

        mockMvc.perform(get("/api/v1/creative-works").param("termId", scope.termId())
                        .with(user(P3_OTHER_TEAM_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isEmpty());

        mockMvc.perform(get("/api/v1/creative-works/{workId}", workId)
                        .with(user(P3_OTHER_TEAM_ID.toString()).roles("P3")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mockMvc.perform(post("/api/v1/creative-works/{workId}/feedback", workId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"comment\":\"补充甜度与成本测算\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.comment").value("补充甜度与成本测算"));

        mockMvc.perform(patch("/api/v1/creative-works/{workId}", workId)
                        .with(user(P3_B_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"title\":\"桂香冷萃（改良）\",\"content\":{\"idea\":\"补充甜度测试\"}}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentRevision").value(2))
                .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(post("/api/v1/creative-works/{workId}/publish", workId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));

        mockMvc.perform(patch("/api/v1/creative-works/{workId}", workId)
                        .with(user(P3_A_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":3,\"title\":\"不得改写\",\"content\":{\"idea\":\"不得改写\"}}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STATE_CONFLICT"));

        assertThat(jdbcTemplate.queryForObject("select count(*) from learning_creative_work_versions where creative_work_id = ?",
                Integer.class, UUID.fromString(workId))).isEqualTo(2);
        assertThatAudit("CREATIVE_WORK_PUBLISHED", UUID.fromString(workId));
    }

    @Test
    void termStudentCanSubmitPersonalReflectionButCannotReadAnotherStudentsDraft() throws Exception {
        var scope = courseScope("REFLECTION");
        var reflection = mockMvc.perform(post("/api/v1/reflections")
                        .with(user(P3_A_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","teachingWeekId":"%s","content":"本周在出品节奏和交接表达上仍需优化",
                                 "improvementPlan":"下周班前完成交接要点演练"}
                                """.formatted(scope.termId(), scope.summaryWeekId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn();
        var reflectionId = json(reflection).path("id").asText();

        mockMvc.perform(get("/api/v1/reflections/{reflectionId}", reflectionId)
                        .with(user(P3_B_ID.toString()).roles("P3")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mockMvc.perform(patch("/api/v1/reflections/{reflectionId}", reflectionId)
                        .with(user(P3_A_ID.toString()).roles("P3"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1,\"content\":\"补充交接复盘结论\",\"improvementPlan\":\"每日复盘\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(2));
        assertThatAudit("REFLECTION_UPDATED", UUID.fromString(reflectionId));
    }

    private org.springframework.test.web.servlet.MvcResult createAndPublishTask(CourseScope scope, String title, String scopeType)
            throws Exception {
        var task = mockMvc.perform(post("/api/v1/course-tasks")
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","teachingWeekId":"%s","title":"%s","scopeType":"%s",
                                 "instructions":"完成需求调研并记录资料来源"}
                                """.formatted(scope.termId(), scope.creativeWeekId(), title, scopeType)))
                .andExpect(status().isCreated()).andReturn();
        var taskId = json(task).path("id").asText();
        mockMvc.perform(post("/api/v1/course-tasks/{taskId}/publish", taskId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());
        return task;
    }

    private CourseScope courseScope(String code) throws Exception {
        var term = mockMvc.perform(post("/api/v1/admin/terms")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"TERM-%s","name":"%s 实训学期","startDate":"2026-09-01","endDate":"2027-01-20"}
                                """.formatted(code, code)))
                .andExpect(status().isCreated()).andReturn();
        var termId = json(term).path("id").asText();
        var preparationWeekId = createWeek(termId, 1, "导入与准备", "PREPARATION");
        var creativeWeekId = createWeek(termId, 2, "创意与筹备", "CREATIVE_PREPARATION");
        var summaryWeekId = createWeek(termId, 17, "总结与评审", "SUMMARY");
        var teamA = createTeam(termId, code + "-A", "创意 A 组");
        var teamB = createTeam(termId, code + "-B", "创意 B 组");
        createMembership(termId, T1_ID, null);
        createMembership(termId, P3_A_ID, teamA);
        createMembership(termId, P3_B_ID, teamA);
        createMembership(termId, P3_OTHER_TEAM_ID, teamB);
        return new CourseScope(termId, preparationWeekId, creativeWeekId, summaryWeekId, teamA, teamB);
    }

    private String createWeek(String termId, int weekNumber, String name, String phaseCode) throws Exception {
        var week = mockMvc.perform(post("/api/v1/admin/terms/{termId}/teaching-weeks", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"weekNumber":%s,"name":"%s","startDate":"2026-09-0%s","endDate":"2026-09-0%s",
                                 "phaseCode":"%s"}
                                """.formatted(weekNumber, name, weekNumber == 17 ? 2 : weekNumber, weekNumber == 17 ? 2 : weekNumber,
                                phaseCode)))
                .andExpect(status().isCreated()).andReturn();
        return json(week).path("id").asText();
    }

    private String createTeam(String termId, String code, String name) throws Exception {
        var team = mockMvc.perform(post("/api/v1/admin/teams")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"termId\":\"%s\",\"code\":\"%s\",\"name\":\"%s\"}".formatted(termId, code, name)))
                .andExpect(status().isCreated()).andReturn();
        return json(team).path("id").asText();
    }

    private void createMembership(String termId, UUID accountId, String teamId) throws Exception {
        mockMvc.perform(post("/api/v1/admin/terms/{termId}/memberships", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(teamId == null ? "{\"accountId\":\"%s\"}".formatted(accountId)
                                : "{\"accountId\":\"%s\",\"teamId\":\"%s\"}".formatted(accountId, teamId)))
                .andExpect(status().isCreated());
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

    private void assertThatAudit(String eventType, UUID resourceId) {
        assertThat(jdbcTemplate.queryForObject("""
                select count(*) from audit_events where event_type = ? and resource_id = ?
                """, Integer.class, eventType, resourceId)).isEqualTo(1);
    }

    private JsonNode json(org.springframework.test.web.servlet.MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private record CourseScope(String termId, String preparationWeekId, String creativeWeekId, String summaryWeekId,
                               String teamAId, String teamBId) {
    }
}
