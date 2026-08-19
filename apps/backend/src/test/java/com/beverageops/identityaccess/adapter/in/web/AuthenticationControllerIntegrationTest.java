package com.beverageops.identityaccess.adapter.in.web;

import java.util.UUID;

import com.beverageops.support.PostgresIntegrationTestBase;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthenticationControllerIntegrationTest extends PostgresIntegrationTestBase {

    private static final String TRUSTED_ORIGIN = "http://localhost:5173";
    private static final String INITIAL_PASSWORD = "InitialPassword-2026";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private Argon2PasswordEncoder passwordEncoder;

    @Test
    void activeAccountCanLogInAndReadItsServerAuthoritativeProfile() throws Exception {
        var accountId = createAccount("p3login", "P3 learner", "ACTIVE", false, "P3");

        var login = login(" P3LOGIN ", INITIAL_PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("access"))
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(jsonPath("$.expiresInSeconds").value(900))
                .andReturn();

        var accessToken = json(login).path("accessToken").asText();
        var refreshCookie = login.getResponse().getCookie("ops_rt");
        assertThat(refreshCookie).isNotNull();
        assertThat(login.getResponse().getHeader(HttpHeaders.SET_COOKIE))
                .contains("HttpOnly", "Path=/api/v1/auth", "SameSite=Lax");

        mockMvc.perform(get("/api/v1/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(accountId.toString()))
                .andExpect(jsonPath("$.loginId").value("P3LOGIN"))
                .andExpect(jsonPath("$.roles[0]").value("P3"));
    }

    @Test
    void trustedFrontendOriginCanReceiveCredentialedLoginResponse() throws Exception {
        createAccount("corslogin", "P3 learner", "ACTIVE", false, "P3");

        mockMvc.perform(post("/api/v1/auth/login")
                        .header(HttpHeaders.ORIGIN, TRUSTED_ORIGIN)
                        .contentType("application/json")
                        .content("{\"loginId\":\"corslogin\",\"password\":\"%s\"}".formatted(INITIAL_PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, TRUSTED_ORIGIN))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
    }

    @Test
    void identityAndAdministrationResponsesAreNeverStoredByBrowsersOrIntermediaries() throws Exception {
        createAccount("nostore", "P3 learner", "ACTIVE", false, "P3");
        var accessToken = json(login("nostore", INITIAL_PASSWORD).andReturn()).path("accessToken").asText();

        mockMvc.perform(get("/api/v1/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string(HttpHeaders.CACHE_CONTROL, org.hamcrest.Matchers.containsString("no-store")));

        mockMvc.perform(get("/api/v1/admin/registration-requests")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isForbidden())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string(HttpHeaders.CACHE_CONTROL, org.hamcrest.Matchers.containsString("no-store")));
    }

    @Test
    void authenticationEventsPersistOnlySafeRequestMetadata() throws Exception {
        createAccount("auditlogin", "P3 learner", "ACTIVE", false, "P3");

        login("auditlogin", INITIAL_PASSWORD)
                .andExpect(status().isOk());

        assertThat(jdbcTemplate.queryForObject("""
                select request_id is not null and length(request_id) > 0
                from iam_auth_events where event_type = 'LOGIN_SUCCEEDED'
                """, Boolean.class)).isTrue();
        assertThat(jdbcTemplate.queryForObject("""
                select ip_hash is not null and ip_hash <> '127.0.0.1'
                from iam_auth_events where event_type = 'LOGIN_SUCCEEDED'
                """, Boolean.class)).isTrue();
        assertThat(jdbcTemplate.queryForObject("""
                select metadata::text from iam_auth_events where event_type = 'LOGIN_SUCCEEDED'
                """, String.class)).doesNotContain(INITIAL_PASSWORD);
    }

    @Test
    void effectivePostgresRoleControlsP1AuthorizationForARealAccessToken() throws Exception {
        createAccount("p1token", "P1 administrator", "ACTIVE", false, "P1");
        createAccount("p3token", "P3 learner", "ACTIVE", false, "P3");
        var p1Token = json(login("p1token", INITIAL_PASSWORD).andReturn()).path("accessToken").asText();
        var p3Token = json(login("p3token", INITIAL_PASSWORD).andReturn()).path("accessToken").asText();

        mockMvc.perform(get("/api/v1/admin/registration-requests")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + p1Token))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/admin/registration-requests")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + p3Token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void logoutInvalidatesTheCurrentP1BearerTokenForAdministrativeEndpoints() throws Exception {
        createAccount("p1logout", "P1 administrator", "ACTIVE", false, "P1");
        var login = login("p1logout", INITIAL_PASSWORD).andReturn();
        var accessToken = json(login).path("accessToken").asText();

        mockMvc.perform(post("/api/v1/auth/logout")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/v1/admin/registration-requests")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    @Test
    void realP1AccessTokenCanApproveARegistrationWithItsVerifiedActorIdentity() throws Exception {
        createAccount("p1approve", "P1 administrator", "ACTIVE", false, "P1");
        var p1Token = json(login("p1approve", INITIAL_PASSWORD).andReturn()).path("accessToken").asText();
        mockMvc.perform(post("/api/v1/auth/registrations")
                        .contentType("application/json")
                        .content("{\"loginId\":\"p3approve\",\"displayName\":\"P3 learner\"}"))
                .andExpect(status().isAccepted());
        var requestId = jdbcTemplate.queryForObject(
                "select id from iam_registration_requests where login_id = 'P3APPROVE'", UUID.class);

        mockMvc.perform(post("/api/v1/admin/registration-requests/{requestId}/approve", requestId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + p1Token)
                        .contentType("application/json")
                        .content("{\"roles\":[\"P3\"],\"reason\":\"Roster verified\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void temporaryPasswordOnlyIssuesARestrictedTokenUntilPasswordIsChanged() throws Exception {
        createAccount("p3temporary", "P3 learner", "ACTIVE", true, "P3");

        var restrictedLogin = login("p3temporary", INITIAL_PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("password_change"))
                .andExpect(jsonPath("$.expiresInSeconds").value(600))
                .andReturn();
        assertThat(restrictedLogin.getResponse().getCookie("ops_rt")).isNull();

        var restrictedToken = json(restrictedLogin).path("accessToken").asText();
        mockMvc.perform(get("/api/v1/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + restrictedToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));

        var changed = mockMvc.perform(post("/api/v1/auth/change-password")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + restrictedToken)
                        .contentType("application/json")
                        .content("{\"newPassword\":\"ChangedPassword-2026\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("access"))
                .andReturn();
        assertThat(changed.getResponse().getCookie("ops_rt")).isNotNull();
        assertThat(jdbcTemplate.queryForObject(
                "select must_change_password from iam_accounts where login_id = 'P3TEMPORARY'", Boolean.class)).isFalse();
    }

    @Test
    void invalidPendingAndDisabledCredentialsUseTheSamePublicFailure() throws Exception {
        createAccount("pending", "Pending learner", "PENDING", false);
        createAccount("disabled", "Disabled learner", "DISABLED", false, "P3");

        login("missing", INITIAL_PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("LOGIN_INVALID"));
        login("pending", INITIAL_PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("LOGIN_INVALID"));
        login("disabled", INITIAL_PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("LOGIN_INVALID"));
    }

    @Test
    void fifthFailedLoginAttemptIsThrottledWithoutRevealingCredentialState() throws Exception {
        createAccount("throttled", "P3 learner", "ACTIVE", false, "P3");

        for (var attempt = 1; attempt <= 4; attempt++) {
            login("throttled", "wrong-password")
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.code").value("LOGIN_INVALID"));
        }

        login("throttled", "wrong-password")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("LOGIN_THROTTLED"));
        login("throttled", INITIAL_PASSWORD)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("LOGIN_THROTTLED"));
    }

    @Test
    void refreshRotatesTheCurrentSessionAndReplayRevokesItsWholeFamily() throws Exception {
        createAccount("refresh", "P3 learner", "ACTIVE", false, "P3");
        var login = login("refresh", INITIAL_PASSWORD).andReturn();
        var originalCookie = login.getResponse().getCookie("ops_rt");
        assertThat(originalCookie).isNotNull();

        var rotated = mockMvc.perform(post("/api/v1/auth/refresh")
                        .header(HttpHeaders.ORIGIN, TRUSTED_ORIGIN)
                        .cookie(cookie(originalCookie)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tokenType").value("access"))
                .andReturn();
        assertThat(rotated.getResponse().getCookie("ops_rt")).isNotNull();

        mockMvc.perform(post("/api/v1/auth/refresh")
                        .header(HttpHeaders.ORIGIN, TRUSTED_ORIGIN)
                        .cookie(cookie(originalCookie)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_REUSED"));

        assertThat(jdbcTemplate.queryForObject("""
                select count(*) from iam_refresh_sessions
                where account_id = (select id from iam_accounts where login_id = 'REFRESH')
                  and revoked_at is not null
                """, Integer.class)).isEqualTo(2);
    }

    @Test
    void cookieBackedRefreshAndLogoutRejectMissingOrUntrustedOriginsBeforeChangingSessions() throws Exception {
        createAccount("origin", "P3 learner", "ACTIVE", false, "P3");
        var login = login("origin", INITIAL_PASSWORD).andReturn();
        var refreshCookie = login.getResponse().getCookie("ops_rt");
        assertThat(refreshCookie).isNotNull();

        mockMvc.perform(post("/api/v1/auth/refresh").cookie(cookie(refreshCookie)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ORIGIN_INVALID"));
        mockMvc.perform(post("/api/v1/auth/logout")
                        .header(HttpHeaders.ORIGIN, "https://untrusted.example")
                        .cookie(cookie(refreshCookie)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ORIGIN_INVALID"));
        assertThat(jdbcTemplate.queryForObject("select revoked_at is null from iam_refresh_sessions", Boolean.class)).isTrue();
    }

    @Test
    void logoutRevokesOnlyTheCurrentDeviceAndAnAdministrativeResetInvalidatesItsExistingAccessToken() throws Exception {
        var accountId = createAccount("logout", "P3 learner", "ACTIVE", false, "P3");
        var login = login("logout", INITIAL_PASSWORD).andReturn();
        var token = json(login).path("accessToken").asText();
        var refreshCookie = login.getResponse().getCookie("ops_rt");

        mockMvc.perform(post("/api/v1/auth/logout")
                        .header(HttpHeaders.ORIGIN, TRUSTED_ORIGIN)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                        .cookie(cookie(refreshCookie)))
                .andExpect(status().isNoContent());
        assertThat(jdbcTemplate.queryForObject(
                "select revoked_at is not null from iam_refresh_sessions where account_id = ?", Boolean.class, accountId)).isTrue();

        mockMvc.perform(get("/api/v1/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));

        var activeAccountId = createAccount("reset-token", "P3 learner", "ACTIVE", false, "P3");
        var activeLogin = login("reset-token", INITIAL_PASSWORD).andReturn();
        var activeToken = json(activeLogin).path("accessToken").asText();
        var p1Id = createAccount("p1reset", "P1 administrator", "ACTIVE", false, "P1");

        mockMvc.perform(post("/api/v1/admin/accounts/{accountId}/reset-password", activeAccountId)
                        .with(user(p1Id.toString()).roles("P1"))
                        .contentType("application/json")
                        .content("{\"reason\":\"Support request\"}"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/v1/auth/me")
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + activeToken))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"));
    }

    private org.springframework.test.web.servlet.ResultActions login(String loginId, String password) throws Exception {
        return mockMvc.perform(post("/api/v1/auth/login")
                .contentType("application/json")
                .content("{\"loginId\":\"%s\",\"password\":\"%s\"}".formatted(loginId, password)));
    }

    private UUID createAccount(String loginId, String displayName, String status, boolean mustChangePassword, String... roles) {
        var accountId = UUID.randomUUID();
        var passwordHash = "PENDING".equals(status) ? null : passwordEncoder.encode(INITIAL_PASSWORD);
        jdbcTemplate.update("""
                insert into iam_accounts (id, login_id, display_name, status, password_hash, must_change_password)
                values (?, ?, ?, ?, ?, ?)
                """, accountId, loginId.toUpperCase(), displayName, status, passwordHash, mustChangePassword);
        for (var role : roles) {
            jdbcTemplate.update("""
                    insert into iam_role_assignments (id, account_id, role_code)
                    values (?, ?, ?)
                    """, UUID.randomUUID(), accountId, role);
        }
        return accountId;
    }

    private Cookie cookie(Cookie cookie) {
        return new Cookie("ops_rt", cookie.getValue());
    }

    private JsonNode json(org.springframework.test.web.servlet.MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }
}
