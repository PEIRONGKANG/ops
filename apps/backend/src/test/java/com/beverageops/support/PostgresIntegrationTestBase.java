package com.beverageops.support;

import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@AutoConfigureMockMvc
@Testcontainers
@DirtiesContext(classMode = DirtiesContext.ClassMode.BEFORE_CLASS)
public abstract class PostgresIntegrationTestBase {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    protected JdbcTemplate jdbcTemplate;

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("identity-access.bootstrap.p1-login-id", () -> "ADMIN001");
        registry.add("identity-access.bootstrap.temporary-password", () -> "BootstrapPassword-2026");
        registry.add("identity-access.bootstrap.claim-secret", () -> "bootstrap-claim-for-tests");
        registry.add("identity-access.jwt-secret", () -> "test-only-jwt-signing-secret-must-be-at-least-32-bytes");
        registry.add("identity-access.token-hmac-secret", () -> "test-only-token-hmac-secret-must-be-at-least-32-bytes");
        registry.add("identity-access.trusted-origins", () -> "http://localhost:5173");
    }

    @BeforeEach
    void resetIdentityData() {
        jdbcTemplate.update("delete from shared_notifications");
        jdbcTemplate.update("delete from audit_events");
        jdbcTemplate.update("delete from assessment_scores");
        jdbcTemplate.update("delete from assessment_assessor_grants");
        jdbcTemplate.update("delete from assessment_result_versions");
        jdbcTemplate.update("delete from assessment_records");
        jdbcTemplate.update("delete from assessment_portfolio_membership_snapshots");
        jdbcTemplate.update("delete from assessment_portfolios");
        jdbcTemplate.update("delete from assessment_rubric_dimension_scorer_roles");
        jdbcTemplate.update("delete from assessment_rubric_dimensions");
        jdbcTemplate.update("delete from assessment_rubric_versions");
        jdbcTemplate.update("delete from learning_reflections");
        jdbcTemplate.update("delete from learning_creative_work_feedback");
        jdbcTemplate.update("delete from learning_creative_work_versions");
        jdbcTemplate.update("delete from learning_creative_works");
        jdbcTemplate.update("delete from learning_course_task_submissions");
        jdbcTemplate.update("delete from learning_course_tasks");
        jdbcTemplate.update("delete from learning_material_acknowledgements");
        jdbcTemplate.update("delete from learning_teaching_materials");
        jdbcTemplate.update("delete from learning_certification_decisions");
        jdbcTemplate.update("delete from learning_certification_history");
        jdbcTemplate.update("delete from learning_certification_evidence_relations");
        jdbcTemplate.update("delete from learning_certifications");
        jdbcTemplate.update("delete from learning_retraining_retests");
        jdbcTemplate.update("delete from learning_retraining_actions");
        jdbcTemplate.update("delete from learning_retraining_evidence_relations");
        jdbcTemplate.update("delete from learning_retraining");
        jdbcTemplate.update("delete from learning_feedback_history");
        jdbcTemplate.update("delete from learning_feedback");
        jdbcTemplate.update("delete from ops_handover_history");
        jdbcTemplate.update("delete from ops_handover_versions");
        jdbcTemplate.update("delete from ops_handovers");
        jdbcTemplate.update("delete from ops_incident_evidence_relations");
        jdbcTemplate.update("delete from ops_incident_actions");
        jdbcTemplate.update("delete from ops_incident_blocking_waivers");
        jdbcTemplate.update("delete from ops_incident_history");
        jdbcTemplate.update("delete from ops_incidents");
        jdbcTemplate.update("delete from ops_operating_summaries");
        jdbcTemplate.update("delete from ops_evidence_file_versions");
        jdbcTemplate.update("delete from ops_evidence");
        jdbcTemplate.update("delete from ops_milestone_decisions");
        jdbcTemplate.update("delete from ops_milestone_submissions");
        jdbcTemplate.update("delete from ops_task_completion_history");
        jdbcTemplate.update("delete from ops_task_completions");
        jdbcTemplate.update("delete from ops_assignment_change_history");
        jdbcTemplate.update("delete from ops_shift_state_history");
        jdbcTemplate.update("delete from ops_shift_assignments");
        jdbcTemplate.update("delete from ops_shifts");
        jdbcTemplate.update("delete from ops_operating_days");
        jdbcTemplate.update("delete from ops_scope_grants");
        jdbcTemplate.update("delete from gov_term_memberships");
        jdbcTemplate.update("delete from gov_template_components");
        jdbcTemplate.update("delete from gov_template_revision_sequences");
        jdbcTemplate.update("delete from gov_teaching_weeks");
        jdbcTemplate.update("delete from gov_teams");
        jdbcTemplate.update("delete from gov_template_versions");
        jdbcTemplate.update("delete from gov_stores");
        jdbcTemplate.update("delete from gov_terms");
        jdbcTemplate.update("delete from iam_auth_events");
        jdbcTemplate.update("delete from iam_refresh_sessions");
        jdbcTemplate.update("delete from iam_role_assignments");
        jdbcTemplate.update("delete from iam_registration_requests");
        jdbcTemplate.update("delete from iam_accounts");
        jdbcTemplate.update("delete from iam_login_throttle_windows");
        jdbcTemplate.update("""
                update iam_system_bootstrap
                set bootstrap_p1_consumed_at = null, bootstrap_account_id = null
                where singleton = true
                """);
    }
}
