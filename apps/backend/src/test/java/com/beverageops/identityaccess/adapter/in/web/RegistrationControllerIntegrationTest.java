package com.beverageops.identityaccess.adapter.in.web;

import com.beverageops.support.PostgresIntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class RegistrationControllerIntegrationTest extends PostgresIntegrationTestBase {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void recordsANormalRegistrationUsingTheCanonicalLoginId() throws Exception {
        mockMvc.perform(post("/api/v1/auth/registrations")
                        .contentType("application/json")
                        .content("""
                                {"loginId":" ２０２６p3 ","displayName":" 张三 "}
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("pending"));

        assertThat(jdbcTemplate.queryForObject(
                "select login_id from iam_accounts", String.class)).isEqualTo("2026P3");
        assertThat(jdbcTemplate.queryForObject(
                "select status from iam_accounts", String.class)).isEqualTo("PENDING");
        assertThat(jdbcTemplate.queryForObject(
                "select password_hash from iam_accounts", String.class)).isNull();
    }

    @Test
    void invalidBootstrapClaimDoesNotConsumeOrReserveTheFirstP1Account() throws Exception {
        mockMvc.perform(post("/api/v1/auth/registrations")
                        .header("X-Bootstrap-Claim", "invalid-claim")
                        .contentType("application/json")
                        .content("""
                                {"loginId":"admin001","displayName":"Initial P1"}
                                """))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.status").value("pending"));

        assertThat(jdbcTemplate.queryForObject("select count(*) from iam_accounts", Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject(
                "select bootstrap_p1_consumed_at is null from iam_system_bootstrap", Boolean.class)).isTrue();
    }

    @Test
    void bootstrapClaimActivatesP1WithoutReturningTheDeploymentPassword() throws Exception {
        mockMvc.perform(post("/api/v1/auth/registrations")
                        .header("X-Bootstrap-Claim", "bootstrap-claim-for-tests")
                        .contentType("application/json")
                        .content("""
                                {"loginId":"admin001","displayName":"Initial P1"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("bootstrapActivated"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("BootstrapPassword-2026"))));

        assertThat(jdbcTemplate.queryForObject("select status from iam_accounts", String.class)).isEqualTo("ACTIVE");
        assertThat(jdbcTemplate.queryForObject("select must_change_password from iam_accounts", Boolean.class)).isTrue();
        assertThat(jdbcTemplate.queryForObject("select role_code from iam_role_assignments", String.class)).isEqualTo("P1");
        assertThat(jdbcTemplate.queryForObject(
                "select bootstrap_p1_consumed_at is not null from iam_system_bootstrap", Boolean.class)).isTrue();
    }
}
