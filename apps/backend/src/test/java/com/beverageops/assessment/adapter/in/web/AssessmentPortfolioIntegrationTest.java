package com.beverageops.assessment.adapter.in.web;

import java.time.OffsetDateTime;
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

class AssessmentPortfolioIntegrationTest extends PostgresIntegrationTestBase {

    private static final UUID P1_ID = UUID.fromString("93000000-0000-0000-0000-000000000001");
    private static final UUID P2_ID = UUID.fromString("93000000-0000-0000-0000-000000000002");
    private static final UUID T1_ID = UUID.fromString("93000000-0000-0000-0000-000000000003");
    private static final UUID P3_ID = UUID.fromString("93000000-0000-0000-0000-000000000004");
    private static final UUID OTHER_P3_ID = UUID.fromString("93000000-0000-0000-0000-000000000005");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void createActors() {
        createActor(P1_ID, "ASSESSMENT-P1", "P1");
        createActor(P2_ID, "ASSESSMENT-P2", "P2");
        createActor(T1_ID, "ASSESSMENT-T1", "T1");
        createActor(P3_ID, "ASSESSMENT-P3", "P3");
        createActor(OTHER_P3_ID, "ASSESSMENT-OTHER-P3", "P3");
    }

    @Test
    void p1PublishesAnImmutableRubricWithExplicitWeightsAndAllowedScorerRoles() throws Exception {
        var termId = createTerm("RUBRIC");
        var rubric = mockMvc.perform(post("/api/v1/rubric-versions")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","name":"期末实训量规","passScore":60,
                                 "effectiveAt":"2026-09-01T00:00:00Z",
                                 "dimensions":[
                                   {"code":"OPERATIONS","name":"运营执行","weight":60,"maxScore":100,
                                    "allowedScorerRoles":["P2"]},
                                   {"code":"CREATIVITY","name":"创意表现","weight":40,"maxScore":100,
                                    "allowedScorerRoles":["T1"]}
                                 ]}
                                """.formatted(termId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.dimensions.length()").value(2))
                .andReturn();
        var rubricId = json(rubric).path("id").asText();

        mockMvc.perform(post("/api/v1/rubric-versions/{rubricId}/publish", rubricId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(get("/api/v1/rubric-versions").param("termId", termId)
                        .with(user(P1_ID.toString()).roles("P1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].dimensions[0].weight").value(60))
                .andExpect(jsonPath("$[0].dimensions[0].allowedScorerRoles[0]").value("P2"));

        mockMvc.perform(patch("/api/v1/rubric-versions/{rubricId}", rubricId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2,\"name\":\"不得原地改写\",\"passScore\":60,\"dimensions\":[]}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STATE_CONFLICT"));

        mockMvc.perform(post("/api/v1/rubric-versions")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"termId\":\"%s\",\"name\":\"越权量规\",\"passScore\":60,\"dimensions\":[]}".formatted(termId)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        assertThat(jdbcTemplate.queryForObject("""
                select count(*) from audit_events where event_type = 'RUBRIC_VERSION_PUBLISHED' and resource_id = ?
                """, Integer.class, UUID.fromString(rubricId))).isEqualTo(1);
    }

    @Test
    void p1DerivesASeparateFutureEffectiveRubricRevisionFromAPublishedVersion() throws Exception {
        var termId = createTerm("RUBRIC-LINEAGE");
        var created = mockMvc.perform(post("/api/v1/rubric-versions")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","name":"运营评价量规","passScore":60,
                                 "effectiveAt":"2026-09-01T00:00:00Z",
                                 "dimensions":[{"code":"OPERATIONS","name":"运营执行","weight":100,
                                 "maxScore":100,"allowedScorerRoles":["P2"]}]}
                                """.formatted(termId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rubricRevision").value(1))
                .andExpect(jsonPath("$.effectiveAt").value("2026-09-01T00:00:00Z"))
                .andReturn();
        var rubricId = json(created).path("id").asText();
        var rootRubricId = json(created).path("rootRubricId").asText();

        mockMvc.perform(post("/api/v1/rubric-versions/{rubricId}/publish", rubricId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());

        var derived = mockMvc.perform(post("/api/v1/rubric-versions/{rubricId}/derive", rubricId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"effectiveAt\":\"2026-10-01T00:00:00Z\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.rootRubricId").value(rootRubricId))
                .andExpect(jsonPath("$.rubricRevision").value(2))
                .andExpect(jsonPath("$.effectiveAt").value("2026-10-01T00:00:00Z"))
                .andExpect(jsonPath("$.dimensions[0].code").value("OPERATIONS"))
                .andReturn();

        assertThatAudit("RUBRIC_VERSION_DERIVED", UUID.fromString(json(derived).path("id").asText()));

        var derivedId = json(derived).path("id").asText();
        mockMvc.perform(post("/api/v1/rubric-versions/{rubricId}/publish", derivedId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());
        mockMvc.perform(post("/api/v1/rubric-versions/{rubricId}/derive", rubricId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"effectiveAt\":\"2026-11-01T00:00:00Z\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.rootRubricId").value(rootRubricId))
                .andExpect(jsonPath("$.rubricRevision").value(3));
    }

    @Test
    void grantedP2AndT1ScoresProduceSuggestedResultAndCorrectionCreatesAnotherPublishedVersion() throws Exception {
        var termId = createTerm("RESULT");
        createMembership(termId, P2_ID);
        createMembership(termId, T1_ID);
        createMembership(termId, P3_ID);
        var rubric = createAndPublishRubric(termId, "最终评分量规");

        var portfolio = mockMvc.perform(post("/api/v1/portfolios")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"termId\":\"%s\",\"scopeType\":\"STUDENT\",\"studentAccountId\":\"%s\"}"
                                .formatted(termId, P3_ID)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn();
        var portfolioId = json(portfolio).path("id").asText();

        mockMvc.perform(post("/api/v1/portfolios/{portfolioId}/generate", portfolioId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("GENERATED"))
                .andExpect(jsonPath("$.manifest.scopeType").value("STUDENT"));
        mockMvc.perform(post("/api/v1/portfolios/{portfolioId}/publish", portfolioId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":2}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"));

        var assessment = mockMvc.perform(post("/api/v1/assessment-records")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"portfolioId":"%s","rubricVersionId":"%s",
                                 "assessorGrants":[
                                   {"accountId":"%s","sourceRole":"P2"},
                                   {"accountId":"%s","sourceRole":"T1"}
                                 ]}
                                """.formatted(portfolioId, rubric.rubricId(), P2_ID, T1_ID)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andReturn();
        var assessmentId = json(assessment).path("id").asText();
        var resultId = json(assessment).path("resultId").asText();

        mockMvc.perform(post("/api/v1/assessment-records/{assessmentId}/score", assessmentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dimensionId\":\"%s\",\"score\":95,\"comment\":\"越权评分\"}"
                                .formatted(rubric.creativityDimensionId())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        mockMvc.perform(post("/api/v1/assessment-records/{assessmentId}/score", assessmentId)
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dimensionId\":\"%s\",\"score\":85,\"comment\":\"运营评分\"}"
                                .formatted(rubric.operationsDimensionId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sourceRole").value("P2"));
        mockMvc.perform(post("/api/v1/assessment-records/{assessmentId}/score", assessmentId)
                        .with(user(T1_ID.toString()).roles("T1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dimensionId\":\"%s\",\"score\":95,\"comment\":\"创意评分\"}"
                                .formatted(rubric.creativityDimensionId())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sourceRole").value("T1"));

        mockMvc.perform(post("/api/v1/assessment-records/{assessmentId}/submit", assessmentId)
                        .with(user(P2_ID.toString()).roles("P2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("DRAFT"));
        mockMvc.perform(post("/api/v1/assessment-records/{assessmentId}/submit", assessmentId)
                        .with(user(T1_ID.toString()).roles("T1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("READY_FOR_PUBLICATION"))
                .andExpect(jsonPath("$.suggestedScore").value(89));

        mockMvc.perform(post("/api/v1/results/{resultId}/publish", resultId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.suggestedScore").value(89))
                .andExpect(jsonPath("$.finalScore").value(89));

        var corrected = mockMvc.perform(post("/api/v1/results/{resultId}/correct", resultId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2,\"finalScore\":90,\"reason\":\"教师复核更正\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.finalScore").value(90))
                .andExpect(jsonPath("$.previousResultId").value(resultId))
                .andReturn();

        assertThat(json(corrected).path("id").asText()).isNotEqualTo(resultId);
        assertThat(jdbcTemplate.queryForObject("select count(*) from assessment_result_versions where root_result_id = ?",
                Integer.class, UUID.fromString(resultId))).isEqualTo(2);

        mockMvc.perform(post("/api/v1/results/{resultId}/correct", resultId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2,\"finalScore\":91,\"reason\":\"不得从历史版本分叉\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));

        assertThatAudit("PORTFOLIO_CREATED", UUID.fromString(portfolioId));
        assertThatAudit("PORTFOLIO_GENERATED", UUID.fromString(portfolioId));
        assertThatAudit("PORTFOLIO_PUBLISHED", UUID.fromString(portfolioId));
        assertThatAudit("ASSESSMENT_RECORD_CREATED", UUID.fromString(assessmentId));
        assertThatAudit("RESULT_PUBLISHED", UUID.fromString(resultId));
        assertThatAudit("RESULT_CORRECTED", UUID.fromString(json(corrected).path("id").asText()));
        assertThat(jdbcTemplate.queryForObject("""
                select count(*) from shared_notifications
                where recipient_account_id = ? and event_type in ('RESULT_PUBLISHED', 'RESULT_CORRECTED')
                """, Integer.class, P3_ID)).isEqualTo(2);

        mockMvc.perform(get("/api/v1/me/portfolios").with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(portfolioId))
                .andExpect(jsonPath("$[0].status").value("PUBLISHED"));
        mockMvc.perform(get("/api/v1/me/results").with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(json(corrected).path("id").asText()))
                .andExpect(jsonPath("$[0].finalScore").value(90));
        mockMvc.perform(get("/api/v1/me/results").with(user(OTHER_P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void studentPortfolioSnapshotsOnlyPublishedCreativeWorkFromStudentsTeam() throws Exception {
        var termId = createTerm("CREATIVE-PORTFOLIO");
        var teachingWeekId = createTeachingWeek(termId);
        var studentTeamId = createTeam(termId, "STUDENT-TEAM");
        var otherTeamId = createTeam(termId, "OTHER-TEAM");
        createMembership(termId, P3_ID, studentTeamId);
        createCreativeWork(termId, studentTeamId, teachingWeekId, "本组已发布饮品方案", true);
        createCreativeWork(termId, studentTeamId, teachingWeekId, "本组草稿方案", false);
        createCreativeWork(termId, otherTeamId, teachingWeekId, "其他小组已发布方案", true);

        var portfolio = mockMvc.perform(post("/api/v1/portfolios")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"termId\":\"%s\",\"scopeType\":\"STUDENT\",\"studentAccountId\":\"%s\"}"
                                .formatted(termId, P3_ID)))
                .andExpect(status().isCreated())
                .andReturn();
        var portfolioId = json(portfolio).path("id").asText();

        mockMvc.perform(post("/api/v1/portfolios/{portfolioId}/generate", portfolioId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.manifest.sources.length()").value(1))
                .andExpect(jsonPath("$.manifest.sources[0].sourceType").value("CREATIVE_WORK"))
                .andExpect(jsonPath("$.manifest.sources[0].snapshot.title").value("本组已发布饮品方案"));
    }

    @Test
    void studentPortfolioSnapshotsSubmittedReflectionAndOwnLearningEvidenceWithoutDraftOrForeignFacts() throws Exception {
        var termId = createTerm("LEARNING-PORTFOLIO");
        var teachingWeekId = createTeachingWeek(termId);
        createMembership(termId, P3_ID);
        createMembership(termId, OTHER_P3_ID);
        var sources = createStudentLearningSources(UUID.fromString(termId), UUID.fromString(teachingWeekId));

        var portfolio = mockMvc.perform(post("/api/v1/portfolios")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"termId\":\"%s\",\"scopeType\":\"STUDENT\",\"studentAccountId\":\"%s\"}"
                                .formatted(termId, P3_ID)))
                .andExpect(status().isCreated())
                .andReturn();
        var portfolioId = json(portfolio).path("id").asText();

        var generated = mockMvc.perform(post("/api/v1/portfolios/{portfolioId}/generate", portfolioId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andReturn();
        var manifest = json(generated).path("manifest");

        assertThat(source(manifest, "REFLECTION").path("snapshot").path("content").asText()).isEqualTo("已提交的个人反思");
        assertThat(source(manifest, "FEEDBACK").path("snapshot").path("recommendation").asText()).isEqualTo("复盘后继续练习");
        assertThat(source(manifest, "RETRAINING").path("snapshot").path("status").asText()).isEqualTo("RETEST_PENDING");
        assertThat(source(manifest, "EVIDENCE").path("snapshot").path("kind").asText()).isEqualTo("TEXT");
        assertThat(manifest.toString()).doesNotContain("个人反思草稿");
        assertThat(manifest.toString()).doesNotContain("其他学生反馈");
        assertThat(manifest.toString()).doesNotContain("学生提交的原始证据内容");
        assertThat(jdbcTemplate.queryForObject("select text_content from ops_evidence where id = ?", String.class,
                sources.evidenceId())).isEqualTo("学生提交的原始证据内容");
    }

    @Test
    void onlyP1MayReadAnInternalPortfolioExportManifestAndTheReadIsAudited() throws Exception {
        var termId = createTerm("EXPORT-MANIFEST");
        createMembership(termId, P3_ID);
        var portfolio = mockMvc.perform(post("/api/v1/portfolios")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"termId\":\"%s\",\"scopeType\":\"STUDENT\",\"studentAccountId\":\"%s\"}"
                                .formatted(termId, P3_ID)))
                .andExpect(status().isCreated()).andReturn();
        var portfolioId = json(portfolio).path("id").asText();
        mockMvc.perform(post("/api/v1/portfolios/{portfolioId}/generate", portfolioId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/portfolios/{portfolioId}/export-manifest", portfolioId)
                        .with(user(P1_ID.toString()).roles("P1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.portfolioId").value(portfolioId))
                .andExpect(jsonPath("$.scopeType").value("STUDENT"));
        mockMvc.perform(get("/api/v1/portfolios/{portfolioId}/export-manifest", portfolioId)
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
        assertThatAudit("PORTFOLIO_EXPORT_MANIFEST_VIEWED", UUID.fromString(portfolioId));
    }

    private String createTerm(String code) throws Exception {
        var result = mockMvc.perform(post("/api/v1/admin/terms")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"TERM-%s","name":"%s 实训学期","startDate":"2026-09-01","endDate":"2027-01-20"}
                                """.formatted(code, code)))
                .andExpect(status().isCreated())
                .andReturn();
        return json(result).path("id").asText();
    }

    private RubricScope createAndPublishRubric(String termId, String name) throws Exception {
        var created = mockMvc.perform(post("/api/v1/rubric-versions")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","name":"%s","passScore":60,
                                 "effectiveAt":"2026-09-01T00:00:00Z",
                                 "dimensions":[
                                   {"code":"OPERATIONS","name":"运营执行","weight":60,"maxScore":100,
                                    "allowedScorerRoles":["P2"]},
                                   {"code":"CREATIVITY","name":"创意表现","weight":40,"maxScore":100,
                                    "allowedScorerRoles":["T1"]}
                                 ]}
                                """.formatted(termId, name)))
                .andExpect(status().isCreated()).andReturn();
        var rubricId = json(created).path("id").asText();
        mockMvc.perform(post("/api/v1/rubric-versions/{rubricId}/publish", rubricId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"version\":1}"))
                .andExpect(status().isOk());
        return new RubricScope(rubricId, json(created).path("dimensions").get(0).path("id").asText(),
                json(created).path("dimensions").get(1).path("id").asText());
    }

    private void createMembership(String termId, UUID accountId) throws Exception {
        createMembership(termId, accountId, null);
    }

    private void createMembership(String termId, UUID accountId, String teamId) throws Exception {
        mockMvc.perform(post("/api/v1/admin/terms/{termId}/memberships", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(teamId == null ? "{\"accountId\":\"%s\"}".formatted(accountId)
                                : "{\"accountId\":\"%s\",\"teamId\":\"%s\"}".formatted(accountId, teamId)))
                .andExpect(status().isCreated());
    }

    private String createTeachingWeek(String termId) throws Exception {
        var week = mockMvc.perform(post("/api/v1/admin/terms/{termId}/teaching-weeks", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"weekNumber\":1,\"name\":\"课程筹备\",\"startDate\":\"2026-09-01\",\"endDate\":\"2026-09-07\",\"phaseCode\":\"PREPARATION\"}"))
                .andExpect(status().isCreated())
                .andReturn();
        return json(week).path("id").asText();
    }

    private String createTeam(String termId, String code) throws Exception {
        var team = mockMvc.perform(post("/api/v1/admin/teams")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"termId\":\"%s\",\"code\":\"%s\",\"name\":\"%s 小组\"}"
                                .formatted(termId, code, code)))
                .andExpect(status().isCreated())
                .andReturn();
        return json(team).path("id").asText();
    }

    private void createCreativeWork(String termId, String teamId, String teachingWeekId, String title, boolean published) {
        var workId = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into learning_creative_works
                    (id, term_id, team_id, teaching_week_id, title, status, created_by_account_id,
                     published_by_account_id, published_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, case when ? then current_timestamp else null end)
                """, workId, UUID.fromString(termId), UUID.fromString(teamId), UUID.fromString(teachingWeekId), title,
                published ? "PUBLISHED" : "DRAFT", P3_ID, published ? P1_ID : null, published);
        jdbcTemplate.update("""
                insert into learning_creative_work_versions
                    (id, creative_work_id, term_id, team_id, revision, content, created_by_account_id)
                values (?, ?, ?, ?, 1, cast(? as jsonb), ?)
                """, UUID.randomUUID(), workId, UUID.fromString(termId), UUID.fromString(teamId),
                "{\"recipe\":\"fruit-soda\"}", P3_ID);
    }

    private LearningSources createStudentLearningSources(UUID termId, UUID teachingWeekId) {
        var storeId = UUID.randomUUID();
        var templateId = UUID.randomUUID();
        var taskComponentId = UUID.randomUUID();
        var dayId = UUID.randomUUID();
        var shiftId = UUID.randomUUID();
        var assignmentId = UUID.randomUUID();
        var taskId = UUID.randomUUID();
        var evidenceId = UUID.randomUUID();
        var feedbackId = UUID.randomUUID();
        var retrainingId = UUID.randomUUID();
        var submittedReflectionId = UUID.randomUUID();

        jdbcTemplate.update("""
                insert into gov_stores (id, code, name, status, created_by_account_id)
                values (?, ?, '成果档案门店', 'ACTIVE', ?)
                """, storeId, "PORTFOLIO-" + storeId.toString().substring(0, 8), P1_ID);
        jdbcTemplate.update("""
                insert into gov_template_versions
                    (id, term_id, store_id, template_code, template_revision, name, status, effective_from, configuration,
                     created_by_account_id)
                values (?, ?, ?, 'PORTFOLIO', 1, '成果档案测试模板', 'PUBLISHED', '2026-09-01', '{}'::jsonb, ?)
                """, templateId, termId, storeId, P1_ID);
        jdbcTemplate.update("""
                insert into gov_template_components
                    (id, template_version_id, component_type, code, name, configuration, created_by_account_id)
                values (?, ?, 'SOP_TASK', 'PORTFOLIO-TASK', '成果档案任务', '{}'::jsonb, ?)
                """, taskComponentId, templateId, P1_ID);
        jdbcTemplate.update("""
                insert into ops_operating_days
                    (id, term_id, store_id, operating_date, template_version_id, template_revision, template_snapshot,
                     status, created_by_account_id)
                values (?, ?, ?, '2026-09-02', ?, 1, '{}'::jsonb, 'CLOSED', ?)
                """, dayId, termId, storeId, templateId, P1_ID);
        jdbcTemplate.update("""
                insert into ops_shifts (id, operating_day_id, code, name, starts_at, ends_at, status, created_by_account_id)
                values (?, ?, 'PORTFOLIO', '成果档案班次', '2026-09-02T08:00:00Z', '2026-09-02T12:00:00Z', 'CLOSED', ?)
                """, shiftId, dayId, P1_ID);
        jdbcTemplate.update("""
                insert into ops_shift_assignments (id, shift_id, account_id, role_code, status, assigned_by_account_id)
                values (?, ?, ?, 'BARISTA', 'ASSIGNED', ?)
                """, assignmentId, shiftId, P3_ID, P1_ID);
        jdbcTemplate.update("""
                insert into ops_task_completions
                    (id, shift_id, assignment_id, source_template_component_id, code, name, role_code, definition_snapshot,
                     evidence_required, p2_acceptance_required, status)
                values (?, ?, ?, ?, 'PORTFOLIO-TASK', '成果档案任务', 'BARISTA', '{}'::jsonb, true, false, 'ACCEPTED')
                """, taskId, shiftId, assignmentId, taskComponentId);
        jdbcTemplate.update("""
                insert into ops_evidence
                    (id, shift_id, task_completion_id, kind, text_content, occurred_at, submitted_by_account_id)
                values (?, ?, ?, 'TEXT', '学生提交的原始证据内容', '2026-09-02T10:00:00Z', ?)
                """, evidenceId, shiftId, taskId, P3_ID);
        jdbcTemplate.update("""
                insert into learning_feedback
                    (id, term_id, store_id, student_account_id, shift_id, task_completion_id, evidence_id,
                     observation, recommendation, requires_retraining, retraining_due_at, status, created_by_account_id)
                values (?, ?, ?, ?, ?, ?, ?, '计量过程需要复盘', '复盘后继续练习', true,
                        '2026-09-10T00:00:00Z', 'OPEN', ?)
                """, feedbackId, termId, storeId, P3_ID, shiftId, taskId, evidenceId, T1_ID);
        jdbcTemplate.update("""
                insert into learning_retraining
                    (id, feedback_id, term_id, store_id, student_account_id, status, due_at, created_by_account_id)
                values (?, ?, ?, ?, ?, 'RETEST_PENDING', '2026-09-10T00:00:00Z', ?)
                """, retrainingId, feedbackId, termId, storeId, P3_ID, T1_ID);
        jdbcTemplate.update("""
                insert into learning_reflections
                    (id, term_id, teaching_week_id, student_account_id, content, improvement_plan, status)
                values (?, ?, ?, ?, '已提交的个人反思', '下一班执行计量复盘', 'SUBMITTED')
                """, submittedReflectionId, termId, teachingWeekId, P3_ID);
        jdbcTemplate.update("""
                insert into learning_reflections
                    (id, term_id, teaching_week_id, student_account_id, content, improvement_plan, status)
                values (?, ?, ?, ?, '个人反思草稿', '不应进入成果包', 'DRAFT')
                """, UUID.randomUUID(), termId, teachingWeekId, P3_ID);
        jdbcTemplate.update("""
                insert into learning_feedback
                    (id, term_id, store_id, student_account_id, shift_id, observation, recommendation,
                     requires_retraining, status, created_by_account_id)
                values (?, ?, ?, ?, ?, '其他学生观察', '其他学生反馈', false, 'OPEN', ?)
                """, UUID.randomUUID(), termId, storeId, OTHER_P3_ID, shiftId, T1_ID);
        return new LearningSources(evidenceId);
    }

    private JsonNode source(JsonNode manifest, String sourceType) {
        for (var source : manifest.path("sources")) {
            if (sourceType.equals(source.path("sourceType").asText())) {
                return source;
            }
        }
        throw new AssertionError("Portfolio source not found: " + sourceType);
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

    private JsonNode json(org.springframework.test.web.servlet.MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private void assertThatAudit(String eventType, UUID resourceId) {
        assertThat(jdbcTemplate.queryForObject("""
                select count(*) from audit_events where event_type = ? and resource_id = ?
                """, Integer.class, eventType, resourceId)).isEqualTo(1);
    }

    private record RubricScope(String rubricId, String operationsDimensionId, String creativityDimensionId) {
    }

    private record LearningSources(UUID evidenceId) {
    }
}
