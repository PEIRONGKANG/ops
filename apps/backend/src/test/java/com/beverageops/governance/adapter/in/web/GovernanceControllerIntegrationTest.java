package com.beverageops.governance.adapter.in.web;

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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class GovernanceControllerIntegrationTest extends PostgresIntegrationTestBase {

    private static final UUID P1_ID = UUID.fromString("40000000-0000-0000-0000-000000000001");
    private static final UUID P2_ID = UUID.fromString("40000000-0000-0000-0000-000000000002");

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void createActors() {
        createActor(P1_ID, "GOVP1", "P1");
        createActor(P2_ID, "GOVP2", "P2");
    }

    @Test
    void p1CanCreateTermStoreAndPublishAnImmutableTemplateVersionWithAuditHistory() throws Exception {
        var term = mockMvc.perform(post("/api/v1/admin/terms")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"2026-AUTUMN","name":"2026 秋季实训","startDate":"2026-09-01","endDate":"2027-01-20"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.version").value(1))
                .andReturn();
        var termId = json(term).path("id").asText();

        var store = mockMvc.perform(post("/api/v1/admin/stores")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"DRINK-LAB\",\"name\":\"饮品实训门店\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.version").value(1))
                .andReturn();
        var storeId = json(store).path("id").asText();

        var template = mockMvc.perform(post("/api/v1/admin/template-versions")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "termId":"%s",
                                  "storeId":"%s",
                                  "templateCode":"DRINK-DAILY",
                                  "name":"饮品门店日常运营",
                                  "effectiveFrom":"2026-09-01",
                                  "configuration":{"roles":[{"code":"BARISTA","name":"吧台"}],"tasks":[],"milestones":[]}
                                }
                                """.formatted(termId, storeId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.templateRevision").value(1))
                .andReturn();
        var templateId = json(template).path("id").asText();

        mockMvc.perform(post("/api/v1/admin/template-versions/{templateId}/publish", templateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(patch("/api/v1/admin/template-versions/{templateId}", templateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"不应覆盖历史模板\",\"version\":2}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STATE_CONFLICT"));

        assertThat(jdbcTemplate.queryForObject("""
                select count(*) from audit_events
                where resource_type in ('TERM', 'STORE', 'TEMPLATE_VERSION')
                """, Integer.class)).isEqualTo(4);
    }

    @Test
    void nonP1CannotCreateGovernanceResources() throws Exception {
        mockMvc.perform(post("/api/v1/admin/terms")
                        .with(user(P2_ID.toString()).roles("P2"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"2026-AUTUMN","name":"2026 秋季实训","startDate":"2026-09-01","endDate":"2027-01-20"}
                                """))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void p1CanAtomicallyInitializeATermStoreAndFirstTeachingWeek() throws Exception {
        mockMvc.perform(post("/api/v1/admin/initialization")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "term":{"code":"2026-AUTUMN","name":"2026 秋季实训","startDate":"2026-09-01","endDate":"2027-01-20"},
                                  "store":{"code":"DRINK-LAB","name":"饮品实训门店"},
                                  "firstTeachingWeek":{"name":"导入与准备","startDate":"2026-09-01","endDate":"2026-09-07","phaseCode":"PREPARATION"}
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.term.status").value("DRAFT"))
                .andExpect(jsonPath("$.store.status").value("ACTIVE"))
                .andExpect(jsonPath("$.firstTeachingWeek.weekNumber").value(1))
                .andExpect(jsonPath("$.firstTeachingWeek.termId").isString());

        assertThat(jdbcTemplate.queryForObject("select count(*) from gov_terms", Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from gov_stores", Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from gov_teaching_weeks", Integer.class)).isEqualTo(1);
    }

    @Test
    void p1CanAtomicallySaveTheDraftTermStoreAndFirstTeachingWeek() throws Exception {
        var initialization = mockMvc.perform(post("/api/v1/admin/initialization")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "term":{"code":"2026-DRAFT","name":"初始实训","startDate":"2026-09-01","endDate":"2027-01-20"},
                                  "store":{"code":"DRAFT-LAB","name":"初始门店"},
                                  "firstTeachingWeek":{"name":"导入期","startDate":"2026-09-01","endDate":"2026-09-07","phaseCode":"PREPARATION"}
                                }
                                """))
                .andExpect(status().isCreated())
                .andReturn();
        var initialized = json(initialization);
        var termId = initialized.path("term").path("id").asText();
        var storeId = initialized.path("store").path("id").asText();
        var weekId = initialized.path("firstTeachingWeek").path("id").asText();

        mockMvc.perform(patch("/api/v1/admin/startup-configurations/{termId}", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "term":{"name":"修订实训","startDate":"2026-09-08","endDate":"2027-01-20","version":1},
                                  "store":{"id":"%s","name":"修订门店","status":"ACTIVE","version":1},
                                  "firstTeachingWeek":{"id":"%s","name":"修订导入期","startDate":"2026-09-08","endDate":"2026-09-14","phaseCode":"PREPARATION","version":1}
                                }
                                """.formatted(storeId, weekId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.term.name").value("修订实训"))
                .andExpect(jsonPath("$.term.version").value(2))
                .andExpect(jsonPath("$.store.name").value("修订门店"))
                .andExpect(jsonPath("$.store.version").value(2))
                .andExpect(jsonPath("$.firstTeachingWeek.name").value("修订导入期"))
                .andExpect(jsonPath("$.firstTeachingWeek.version").value(2));

        mockMvc.perform(patch("/api/v1/admin/startup-configurations/{termId}", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "term":{"name":"不应保存","startDate":"2026-09-08","endDate":"2027-01-20","version":1},
                                  "store":{"id":"%s","name":"不应保存","status":"ACTIVE","version":2},
                                  "firstTeachingWeek":{"id":"%s","name":"不应保存","startDate":"2026-09-08","endDate":"2026-09-14","phaseCode":"PREPARATION","version":2}
                                }
                                """.formatted(storeId, weekId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));

        assertThat(jdbcTemplate.queryForObject("select name from gov_terms where id = ?", String.class, UUID.fromString(termId)))
                .isEqualTo("修订实训");
        assertThat(jdbcTemplate.queryForObject("select name from gov_stores where id = ?", String.class, UUID.fromString(storeId)))
                .isEqualTo("修订门店");
        assertThat(jdbcTemplate.queryForObject("select name from gov_teaching_weeks where id = ?", String.class, UUID.fromString(weekId)))
                .isEqualTo("修订导入期");
    }

    @Test
    void p1CanAtomicallyCreateAStarterTemplateWithExecutableRoleAndSopComponents() throws Exception {
        var termId = createTerm("2026-TEMPLATE-BOOTSTRAP", "模板启动学期");
        var storeId = createStore("TEMPLATE-BOOTSTRAP-LAB", "模板启动门店");

        mockMvc.perform(post("/api/v1/admin/template-versions/bootstrap")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "termId":"%s", "storeId":"%s", "templateCode":"DAILY-OPS", "name":"日常运营模板",
                                  "effectiveFrom":"2026-09-01", "configuration":{"roles":[],"tasks":[]},
                                  "role":{"code":"BARISTA","name":"吧台制作","configuration":{"required":true}},
                                  "sopTask":{"code":"OPENING-CHECK","name":"开档检查",
                                    "configuration":{"roleCode":"BARISTA","evidenceRequired":false,"requiresP2Acceptance":false}}
                                }
                                """.formatted(termId, storeId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"));

        assertThat(jdbcTemplate.queryForObject("select count(*) from gov_template_versions", Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from gov_template_components where component_type = 'ROLE'", Integer.class)).isEqualTo(1);
        assertThat(jdbcTemplate.queryForObject("select count(*) from gov_template_components where component_type = 'SOP_TASK'", Integer.class)).isEqualTo(1);
    }

    @Test
    void starterTemplateCreationRollsBackWhenItsExecutableSopIsInvalid() throws Exception {
        var termId = createTerm("2026-TEMPLATE-ROLLBACK", "模板回滚学期");
        var storeId = createStore("TEMPLATE-ROLLBACK-LAB", "模板回滚门店");

        mockMvc.perform(post("/api/v1/admin/template-versions/bootstrap")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s", "storeId":"%s", "templateCode":"ROLLBACK", "name":"无效模板",
                                 "effectiveFrom":"2026-09-01", "configuration":{},
                                 "role":{"code":"BARISTA","name":"吧台制作","configuration":{}},
                                 "sopTask":{"code":"OPENING-CHECK","name":"开档检查","configuration":[]}}
                                """.formatted(termId, storeId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        assertThat(jdbcTemplate.queryForObject("select count(*) from gov_template_versions", Integer.class)).isEqualTo(0);
        assertThat(jdbcTemplate.queryForObject("select count(*) from gov_template_components", Integer.class)).isEqualTo(0);
    }

    @Test
    void starterTemplateRequiresBothItsRoleAndSopDefinitions() throws Exception {
        var termId = createTerm("2026-TEMPLATE-REQUIRED", "模板必填项学期");
        var storeId = createStore("TEMPLATE-REQUIRED-LAB", "模板必填项门店");

        mockMvc.perform(post("/api/v1/admin/template-versions/bootstrap")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s", "storeId":"%s", "templateCode":"REQUIRED", "name":"缺少 SOP 的模板",
                                 "effectiveFrom":"2026-09-01", "configuration":{},
                                 "role":{"code":"BARISTA","name":"吧台制作","configuration":{}}}
                                """.formatted(termId, storeId)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        assertThat(jdbcTemplate.queryForObject("select count(*) from gov_template_versions", Integer.class)).isEqualTo(0);
        assertThat(jdbcTemplate.queryForObject("select count(*) from gov_template_components", Integer.class)).isEqualTo(0);
    }

    @Test
    void certificationRuleMustDeclareACompleteExecutablePolicy() throws Exception {
        var termId = createTerm("2026-CERT-RULE", "认证规则校验学期");
        var storeId = createStore("CERT-RULE-LAB", "认证规则校验门店");
        var templateId = json(createTemplate(termId, storeId, "CERT-RULE", "认证规则模板")).path("id").asText();

        mockMvc.perform(post("/api/v1/admin/template-versions/{templateId}/certification-rules", templateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"INVALID-CERT","name":"无效认证规则",
                                 "configuration":{"authorizedDecisionRoles":[],"evidenceRequired":true,
                                                  "minimumEvidenceCount":1,"retestRequired":false}}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void p1CanConfigureTermTeamMembershipAndReadOnlyAuditHistory() throws Exception {
        var termId = createTerm("2026-SPRING", "2026 春季实训");

        mockMvc.perform(post("/api/v1/admin/terms/{termId}/publish", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.version").value(2));

        var team = mockMvc.perform(post("/api/v1/admin/teams")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","code":"TEAM-A","name":"创意 A 组"}
                                """.formatted(termId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andReturn();
        var teamId = json(team).path("id").asText();

        mockMvc.perform(post("/api/v1/admin/terms/{termId}/memberships", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"accountId":"%s","teamId":"%s"}
                                """.formatted(P2_ID, teamId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("ACTIVE"));

        mockMvc.perform(get("/api/v1/admin/terms/{termId}/memberships", termId)
                        .with(user(P1_ID.toString()).roles("P1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].accountId").value(P2_ID.toString()))
                .andExpect(jsonPath("$[0].teamId").value(teamId));

        var membershipId = jdbcTemplate.queryForObject("""
                select id from gov_term_memberships where term_id = ? and account_id = ?
                """, UUID.class, UUID.fromString(termId), P2_ID);
        mockMvc.perform(delete("/api/v1/admin/terms/{termId}/memberships/{membershipId}", termId, membershipId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("INACTIVE"))
                .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(get("/api/v1/admin/audit-events?resourceType=TERM")
                        .with(user(P1_ID.toString()).roles("P1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].resourceType").value("TERM"))
                .andExpect(jsonPath("$[0].actorAccountId").value(P1_ID.toString()))
                .andExpect(jsonPath("$[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$[0].loginId").doesNotExist());

        mockMvc.perform(get("/api/v1/admin/change-records?resourceType=TERM")
                        .with(user(P1_ID.toString()).roles("P1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].resourceType").value("TERM"));

        mockMvc.perform(post("/api/v1/admin/terms/{termId}/archive", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2,\"reason\":\"教学周期已结束\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ARCHIVED"))
                .andExpect(jsonPath("$.version").value(3));
    }

    @Test
    void draftTemplateCanBeChangedAndARepeatedCodeCreatesTheNextImmutableVersion() throws Exception {
        var termId = createTerm("2026-SUMMER", "2026 夏季实训");
        var storeId = createStore("SUMMER-LAB", "夏季实训门店");
        var firstTemplate = createTemplate(termId, storeId, "DAILY", "日常运营 v1");
        var firstTemplateId = json(firstTemplate).path("id").asText();

        mockMvc.perform(patch("/api/v1/admin/template-versions/{templateId}", firstTemplateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name":"日常运营 v1 修订","effectiveUntil":"2026-12-31",
                                 "configuration":{"roles":[{"code":"BARISTA","name":"吧台"}],"tasks":[{"code":"OPEN"}]},"version":1}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("日常运营 v1 修订"))
                .andExpect(jsonPath("$.version").value(2));

        mockMvc.perform(patch("/api/v1/admin/template-versions/{templateId}", firstTemplateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"旧版本\",\"version\":1}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("VERSION_CONFLICT"));

        var secondTemplate = mockMvc.perform(post("/api/v1/admin/template-versions")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","templateCode":"DAILY","name":"日常运营 v2",
                                 "effectiveFrom":"2027-01-01","configuration":{"roles":[],"tasks":[]}}
                                """.formatted(termId, storeId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.templateRevision").value(2))
                .andReturn();

        mockMvc.perform(get("/api/v1/admin/template-versions?termId={termId}&storeId={storeId}", termId, storeId)
                        .with(user(P1_ID.toString()).roles("P1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        mockMvc.perform(post("/api/v1/admin/template-versions/{templateId}/publish", firstTemplateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":2}"))
                .andExpect(status().isOk());

        var secondTemplateId = json(secondTemplate).path("id").asText();
        mockMvc.perform(post("/api/v1/admin/template-versions/{templateId}/roles", secondTemplateId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"BARISTA\",\"name\":\"吧台\",\"configuration\":{\"required\":true}}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.componentType").value("ROLE"));

        mockMvc.perform(get("/api/v1/admin/template-versions/{templateId}/roles", secondTemplateId)
                        .with(user(P1_ID.toString()).roles("P1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].code").value("BARISTA"));
    }

    @Test
    void p1CanConfigureTeachingWeeksInsideTheTermDates() throws Exception {
        var termId = createTerm("2026-WINTER", "2026 冬季实训");

        mockMvc.perform(post("/api/v1/admin/terms/{termId}/teaching-weeks", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"weekNumber":1,"name":"导入与准备","startDate":"2026-09-01","endDate":"2026-09-07","phaseCode":"PREPARATION"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.weekNumber").value(1))
                .andExpect(jsonPath("$.phaseCode").value("PREPARATION"));

        mockMvc.perform(get("/api/v1/admin/terms/{termId}/teaching-weeks", termId)
                        .with(user(P1_ID.toString()).roles("P1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("导入与准备"));

        mockMvc.perform(post("/api/v1/admin/terms/{termId}/teaching-weeks", termId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"weekNumber":2,"name":"无效周","startDate":"2026-08-31","endDate":"2026-09-06"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
    }

    @Test
    void membershipDeactivationMustUseTheMembershipTerm() throws Exception {
        var firstTermId = createTerm("2026-FALL-A", "第一学期");
        var secondTermId = createTerm("2026-FALL-B", "第二学期");
        mockMvc.perform(post("/api/v1/admin/terms/{termId}/memberships", firstTermId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"accountId\":\"%s\"}".formatted(P2_ID)))
                .andExpect(status().isCreated());
        var membershipId = jdbcTemplate.queryForObject("""
                select id from gov_term_memberships where term_id = ? and account_id = ?
                """, UUID.class, UUID.fromString(firstTermId), P2_ID);

        mockMvc.perform(delete("/api/v1/admin/terms/{termId}/memberships/{membershipId}", secondTermId, membershipId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"version\":1}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    private String createTerm(String code, String name) throws Exception {
        var result = mockMvc.perform(post("/api/v1/admin/terms")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"code":"%s","name":"%s","startDate":"2026-09-01","endDate":"2027-01-20"}
                                """.formatted(code, name)))
                .andExpect(status().isCreated())
                .andReturn();
        return json(result).path("id").asText();
    }

    private String createStore(String code, String name) throws Exception {
        var result = mockMvc.perform(post("/api/v1/admin/stores")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"%s\",\"name\":\"%s\"}".formatted(code, name)))
                .andExpect(status().isCreated())
                .andReturn();
        return json(result).path("id").asText();
    }

    private org.springframework.test.web.servlet.MvcResult createTemplate(String termId, String storeId, String code,
                                                                           String name) throws Exception {
        return mockMvc.perform(post("/api/v1/admin/template-versions")
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"termId":"%s","storeId":"%s","templateCode":"%s","name":"%s",
                                 "effectiveFrom":"2026-09-01","configuration":{"roles":[],"tasks":[]}}
                                """.formatted(termId, storeId, code, name)))
                .andExpect(status().isCreated())
                .andReturn();
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
}
