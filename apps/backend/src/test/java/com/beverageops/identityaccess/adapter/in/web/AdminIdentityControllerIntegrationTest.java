package com.beverageops.identityaccess.adapter.in.web;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.beverageops.support.PostgresIntegrationTestBase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AdminIdentityControllerIntegrationTest extends PostgresIntegrationTestBase {

    private static final UUID P1_ID = UUID.fromString("10000000-0000-0000-0000-000000000001");

    @Autowired
    private MockMvc mockMvc;

    @BeforeEach
    void createP1Actor() {
        jdbcTemplate.update("""
                insert into iam_accounts (id, login_id, display_name, status, password_hash)
                values (?, 'P1ADMIN', 'P1 administrator', 'ACTIVE', '$argon2id$placeholder')
                """, P1_ID);
        jdbcTemplate.update("""
                insert into iam_role_assignments (id, account_id, role_code)
                values (?, ?, 'P1')
                """, UUID.randomUUID(), P1_ID);
    }

    @Test
    void p1CanApproveAPendingRegistrationAndReceiveATemporaryPasswordOnlyInTheResponse() throws Exception {
        var requestId = createPendingRegistration("2026P3", "Student One");

        var response = mockMvc.perform(post("/api/v1/admin/registration-requests/{requestId}/approve", requestId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType("application/json")
                        .content("""
                                {"roles":["P3"],"reason":"Roster verified"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.account.loginId").value("2026P3"))
                .andExpect(jsonPath("$.account.roles[0]").value("P3"))
                .andExpect(jsonPath("$.temporaryPassword").isString())
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(extractTemporaryPassword(response)).hasSize(18);
        assertThat(jdbcTemplate.queryForObject(
                "select status from iam_accounts where login_id = '2026P3'", String.class)).isEqualTo("ACTIVE");
        assertThat(jdbcTemplate.queryForObject(
                "select must_change_password from iam_accounts where login_id = '2026P3'", Boolean.class)).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                "select authorization_version from iam_accounts where login_id = '2026P3'", Long.class)).isEqualTo(2L);
        assertThat(jdbcTemplate.queryForObject(
                "select status from iam_registration_requests where id = ?", String.class, requestId)).isEqualTo("APPROVED");
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from iam_auth_events where event_type = 'REGISTRATION_APPROVED'", Integer.class)).isEqualTo(1);
    }

    @Test
    void nonP1CannotApproveARegistration() throws Exception {
        var requestId = createPendingRegistration("2026P3", "Student One");

        mockMvc.perform(post("/api/v1/admin/registration-requests/{requestId}/approve", requestId)
                        .with(user(UUID.randomUUID().toString()).roles("P3"))
                        .contentType("application/json")
                        .content("""
                                {"roles":["P3"]}
                                """))
                .andExpect(status().isForbidden());

        assertThat(jdbcTemplate.queryForObject(
                "select status from iam_registration_requests where id = ?", String.class, requestId)).isEqualTo("PENDING");
    }

    @Test
    void p1CannotAssignTheReservedExternalReviewerRole() throws Exception {
        var requestId = createPendingRegistration("2026P3", "Student One");

        mockMvc.perform(post("/api/v1/admin/registration-requests/{requestId}/approve", requestId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType("application/json")
                        .content("""
                                {"roles":["EXTERNAL_REVIEWER"],"reason":"Not available in this phase"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));

        assertThat(jdbcTemplate.queryForObject(
                "select status from iam_registration_requests where id = ?", String.class, requestId)).isEqualTo("PENDING");
    }

    @Test
    void resetRejectsDisabledAccountsUntilTheyAreReactivated() throws Exception {
        var accountId = createActiveP3("P3DISABLED");
        jdbcTemplate.update("update iam_accounts set status = 'DISABLED' where id = ?", accountId);

        mockMvc.perform(post("/api/v1/admin/accounts/{accountId}/reset-password", accountId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType("application/json")
                        .content("{\"reason\":\"Support request\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("STATE_CONFLICT"));
    }

    @Test
    void p1CanRejectAPendingRegistration() throws Exception {
        var requestId = createPendingRegistration("2026P3", "Student One");

        mockMvc.perform(post("/api/v1/admin/registration-requests/{requestId}/reject", requestId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType("application/json")
                        .content("""
                                {"reason":"No class assignment"}
                                """))
                .andExpect(status().isNoContent());

        assertThat(jdbcTemplate.queryForObject(
                "select status from iam_registration_requests where id = ?", String.class, requestId)).isEqualTo("REJECTED");
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from iam_auth_events where event_type = 'REGISTRATION_REJECTED'", Integer.class)).isEqualTo(1);
    }

    @Test
    void p1ResetAndDisableRevokeAllOfAnAccountsRefreshSessions() throws Exception {
        var accountId = createActiveP3("P3RESET");
        createLiveRefreshSession(accountId);

        var resetResponse = mockMvc.perform(post("/api/v1/admin/accounts/{accountId}/reset-password", accountId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType("application/json")
                        .content("""
                                {"reason":"Password support"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.temporaryPassword").isString())
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(extractTemporaryPassword(resetResponse)).hasSize(18);
        assertThat(jdbcTemplate.queryForObject(
                "select authorization_version from iam_accounts where id = ?", Long.class, accountId)).isEqualTo(2L);
        assertThat(jdbcTemplate.queryForObject(
                "select revoked_at is not null from iam_refresh_sessions where account_id = ?", Boolean.class, accountId)).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                "select metadata ->> 'reason' from iam_auth_events where event_type = 'PASSWORD_RESET'", String.class))
                .isEqualTo("Password support");
        assertThat(jdbcTemplate.queryForObject(
                "select metadata::text from iam_auth_events where event_type = 'PASSWORD_RESET'", String.class))
                .doesNotContain(extractTemporaryPassword(resetResponse));

        mockMvc.perform(post("/api/v1/admin/accounts/{accountId}/disable", accountId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType("application/json")
                        .content("""
                                {"reason":"Account no longer assigned"}
                                """))
                .andExpect(status().isNoContent());

        assertThat(jdbcTemplate.queryForObject(
                "select status from iam_accounts where id = ?", String.class, accountId)).isEqualTo("DISABLED");
        assertThat(jdbcTemplate.queryForObject(
                "select authorization_version from iam_accounts where id = ?", Long.class, accountId)).isEqualTo(3L);
        assertThat(jdbcTemplate.queryForObject(
                "select metadata ->> 'reason' from iam_auth_events where event_type = 'ACCOUNT_DISABLED'", String.class))
                .isEqualTo("Account no longer assigned");
    }

    @Test
    void p1CanReactivateADisabledAccountOnlyWithANewTemporaryPassword() throws Exception {
        var accountId = createActiveP3("P3REACTIVATE");
        jdbcTemplate.update("update iam_accounts set status = 'DISABLED' where id = ?", accountId);

        var response = mockMvc.perform(post("/api/v1/admin/accounts/{accountId}/reactivate", accountId)
                        .with(user(P1_ID.toString()).roles("P1"))
                        .contentType("application/json")
                        .content("""
                                {"reason":"Assigned to a new cohort"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.temporaryPassword").isString())
                .andReturn()
                .getResponse()
                .getContentAsString();

        assertThat(extractTemporaryPassword(response)).hasSize(18);
        assertThat(jdbcTemplate.queryForObject(
                "select status from iam_accounts where id = ?", String.class, accountId)).isEqualTo("ACTIVE");
        assertThat(jdbcTemplate.queryForObject(
                "select must_change_password from iam_accounts where id = ?", Boolean.class, accountId)).isTrue();
        assertThat(jdbcTemplate.queryForObject(
                "select authorization_version from iam_accounts where id = ?", Long.class, accountId)).isEqualTo(2L);
        assertThat(jdbcTemplate.queryForObject(
                "select metadata ->> 'reason' from iam_auth_events where event_type = 'ACCOUNT_REACTIVATED'", String.class))
                .isEqualTo("Assigned to a new cohort");
    }

    @Test
    void p1CanListPendingRegistrationsWithoutAnyPasswordOrSecurityData() throws Exception {
        createPendingRegistration("2026P3", "Student One");

        mockMvc.perform(get("/api/v1/admin/registration-requests")
                        .param("status", "PENDING")
                        .with(user(P1_ID.toString()).roles("P1")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].loginId").value("2026P3"))
                .andExpect(jsonPath("$.items[0].passwordHash").doesNotExist())
                .andExpect(jsonPath("$.items[0].temporaryPassword").doesNotExist());
    }

    private UUID createPendingRegistration(String loginId, String displayName) throws Exception {
        mockMvc.perform(post("/api/v1/auth/registrations")
                        .contentType("application/json")
                        .content("{\"loginId\":\"%s\",\"displayName\":\"%s\"}".formatted(loginId, displayName)))
                .andExpect(status().isAccepted());
        return jdbcTemplate.queryForObject(
                "select id from iam_registration_requests where login_id = ?", UUID.class, loginId);
    }

    private UUID createActiveP3(String loginId) {
        var accountId = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into iam_accounts (id, login_id, display_name, status, password_hash)
                values (?, ?, 'P3 student', 'ACTIVE', '$argon2id$existing-password')
                """, accountId, loginId);
        jdbcTemplate.update("""
                insert into iam_role_assignments (id, account_id, role_code)
                values (?, ?, 'P3')
                """, UUID.randomUUID(), accountId);
        return accountId;
    }

    private void createLiveRefreshSession(UUID accountId) {
        jdbcTemplate.update("""
                insert into iam_refresh_sessions (id, account_id, family_id, token_hash, authorization_version, expires_at)
                values (?, ?, ?, ?, 1, ?)
                """, UUID.randomUUID(), accountId, UUID.randomUUID(), UUID.randomUUID().toString(), OffsetDateTime.now().plusDays(1));
    }

    private String extractTemporaryPassword(String response) {
        return response.replaceAll(".*\"temporaryPassword\":\"([^\"]+)\".*", "$1");
    }
}
