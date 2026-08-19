package com.beverageops.identityaccess.infrastructure.persistence;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.identityaccess.domain.model.LoginId;
import com.beverageops.identityaccess.domain.port.IdentityAuthenticationRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class JdbcIdentityAuthenticationRepository implements IdentityAuthenticationRepository {

    private final JdbcTemplate jdbcTemplate;

    JdbcIdentityAuthenticationRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Optional<AccountAuthentication> findAccountForLogin(LoginId loginId) {
        return jdbcTemplate.query("""
                        select id, login_id, display_name, status, password_hash, must_change_password, authorization_version
                        from iam_accounts where login_id = ?
                        """,
                resultSet -> resultSet.next() ? Optional.of(accountAuthentication(resultSet)) : Optional.empty(), loginId.value());
    }

    @Override
    public Optional<AccountProfile> findActiveAccountProfile(UUID accountId) {
        return jdbcTemplate.query("""
                        select id, login_id, display_name, authorization_version
                        from iam_accounts where id = ? and status = 'ACTIVE'
                        """,
                resultSet -> resultSet.next() ? Optional.of(accountProfile(resultSet)) : Optional.empty(), accountId);
    }

    @Override
    public Optional<AccountProfile> findActiveAccountProfile(UUID accountId, long authorizationVersion) {
        return jdbcTemplate.query("""
                        select id, login_id, display_name, authorization_version
                        from iam_accounts
                        where id = ? and status = 'ACTIVE' and authorization_version = ?
                        """,
                resultSet -> resultSet.next() ? Optional.of(accountProfile(resultSet)) : Optional.empty(),
                accountId, authorizationVersion);
    }

    @Override
    public Optional<RefreshSession> lockRefreshSessionByTokenHash(String tokenHash) {
        return jdbcTemplate.query("""
                        select id, account_id, family_id, token_hash, authorization_version, expires_at, rotated_at, revoked_at
                        from iam_refresh_sessions where token_hash = ? for update
                        """,
                resultSet -> resultSet.next() ? Optional.of(refreshSession(resultSet)) : Optional.empty(), tokenHash);
    }

    @Override
    public Optional<RefreshSession> findActiveSession(UUID sessionId, UUID accountId, long authorizationVersion) {
        return jdbcTemplate.query("""
                        select s.id, s.account_id, s.family_id, s.token_hash, s.authorization_version,
                               s.expires_at, s.rotated_at, s.revoked_at
                        from iam_refresh_sessions s
                        join iam_accounts a on a.id = s.account_id
                        where s.id = ? and s.account_id = ? and s.authorization_version = ?
                          and s.revoked_at is null and s.rotated_at is null and s.expires_at > current_timestamp
                          and a.status = 'ACTIVE' and a.authorization_version = ?
                        """,
                resultSet -> resultSet.next() ? Optional.of(refreshSession(resultSet)) : Optional.empty(),
                sessionId, accountId, authorizationVersion, authorizationVersion);
    }

    @Override
    public void createRefreshSession(RefreshSession session) {
        jdbcTemplate.update("""
                insert into iam_refresh_sessions
                    (id, account_id, family_id, token_hash, authorization_version, expires_at, created_ip_hash, user_agent_summary)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """, session.id(), session.accountId(), session.familyId(), session.tokenHash(), session.authorizationVersion(),
                session.expiresAt(), null, null);
    }

    @Override
    public void rotateRefreshSession(UUID previousSessionId, UUID nextSessionId, UUID accountId, UUID familyId,
                                     String nextTokenHash, long authorizationVersion, OffsetDateTime expiresAt,
                                     String clientIpHash, String userAgentSummary) {
        var changed = jdbcTemplate.update("""
                update iam_refresh_sessions
                set rotated_at = current_timestamp, revoke_reason = 'REFRESH_ROTATED'
                where id = ? and rotated_at is null and revoked_at is null
                """, previousSessionId);
        if (changed != 1) {
            throw new IllegalStateException("Refresh session could not be rotated.");
        }
        jdbcTemplate.update("""
                insert into iam_refresh_sessions
                    (id, account_id, family_id, token_hash, parent_session_id, authorization_version, expires_at,
                     created_ip_hash, user_agent_summary)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, nextSessionId, accountId, familyId, nextTokenHash, previousSessionId, authorizationVersion,
                expiresAt, clientIpHash, userAgentSummary);
    }

    @Override
    public void revokeSession(UUID sessionId, String reason) {
        jdbcTemplate.update("""
                update iam_refresh_sessions set revoked_at = current_timestamp, revoke_reason = ?
                where id = ? and revoked_at is null
                """, reason, sessionId);
    }

    @Override
    public void revokeFamily(UUID familyId, String reason) {
        jdbcTemplate.update("""
                update iam_refresh_sessions set revoked_at = current_timestamp, revoke_reason = ?
                where family_id = ? and (revoked_at is null or revoke_reason = 'REFRESH_ROTATED')
                """, reason, familyId);
    }

    @Override
    public void changePassword(UUID accountId, String passwordHash) {
        jdbcTemplate.update("""
                update iam_accounts
                set password_hash = ?, must_change_password = false, authorization_version = authorization_version + 1,
                    updated_at = current_timestamp
                where id = ? and status = 'ACTIVE'
                """, passwordHash, accountId);
        jdbcTemplate.update("""
                update iam_refresh_sessions set revoked_at = current_timestamp, revoke_reason = 'PASSWORD_CHANGED'
                where account_id = ? and revoked_at is null
                """, accountId);
    }

    @Override
    public void recordSuccessfulLogin(UUID accountId) {
        jdbcTemplate.update("update iam_accounts set last_login_at = current_timestamp, updated_at = current_timestamp where id = ?", accountId);
    }

    @Override
    public boolean isThrottled(String keyType, String keyHash, OffsetDateTime now) {
        var result = jdbcTemplate.query("""
                        select blocked_until is not null and blocked_until > ?
                        from iam_login_throttle_windows where key_type = ? and key_hash = ?
                        """, resultSet -> resultSet.next() && resultSet.getBoolean(1), now, keyType, keyHash);
        return Boolean.TRUE.equals(result);
    }

    @Override
    public void recordFailedLogin(String keyType, String keyHash, OffsetDateTime now) {
        jdbcTemplate.update("""
                insert into iam_login_throttle_windows
                    (key_type, key_hash, failed_count, window_started_at, blocked_until, updated_at)
                values (?, ?, 1, ?, null, ?)
                on conflict (key_type, key_hash) do update
                set failed_count = case
                        when iam_login_throttle_windows.window_started_at <= excluded.window_started_at - interval '15 minutes'
                            then 1
                        else iam_login_throttle_windows.failed_count + 1
                    end,
                    window_started_at = case
                        when iam_login_throttle_windows.window_started_at <= excluded.window_started_at - interval '15 minutes'
                            then excluded.window_started_at
                        else iam_login_throttle_windows.window_started_at
                    end,
                    blocked_until = case
                        when (case when iam_login_throttle_windows.window_started_at <= excluded.window_started_at - interval '15 minutes'
                                   then 1 else iam_login_throttle_windows.failed_count + 1 end) >= 5
                            then excluded.window_started_at + interval '15 minutes'
                        else null
                    end,
                    updated_at = excluded.updated_at
                """, keyType, keyHash, now, now);
    }

    @Override
    public void clearFailedLogin(String keyType, String keyHash) {
        jdbcTemplate.update("delete from iam_login_throttle_windows where key_type = ? and key_hash = ?", keyType, keyHash);
    }

    @Override
    public void appendEvent(AuthEvent event) {
        jdbcTemplate.update("""
                insert into iam_auth_events (id, event_type, actor_account_id, subject_account_id, request_id, ip_hash, metadata)
                values (?, ?, ?, ?, ?, ?, cast(? as jsonb))
                """, UUID.randomUUID(), event.eventType(), event.actorAccountId(), event.subjectAccountId(),
                event.requestId(), event.ipHash(), event.metadataJson());
    }

    private AccountAuthentication accountAuthentication(ResultSet resultSet) throws java.sql.SQLException {
        var id = resultSet.getObject("id", UUID.class);
        return new AccountAuthentication(id, resultSet.getString("login_id"), resultSet.getString("display_name"),
                resultSet.getString("status"), resultSet.getString("password_hash"),
                resultSet.getBoolean("must_change_password"), resultSet.getLong("authorization_version"), rolesFor(id));
    }

    private AccountProfile accountProfile(ResultSet resultSet) throws java.sql.SQLException {
        var id = resultSet.getObject("id", UUID.class);
        return new AccountProfile(id, resultSet.getString("login_id"), resultSet.getString("display_name"),
                resultSet.getLong("authorization_version"), rolesFor(id));
    }

    private RefreshSession refreshSession(ResultSet resultSet) throws java.sql.SQLException {
        return new RefreshSession(resultSet.getObject("id", UUID.class), resultSet.getObject("account_id", UUID.class),
                resultSet.getObject("family_id", UUID.class), resultSet.getString("token_hash"),
                resultSet.getLong("authorization_version"), resultSet.getObject("expires_at", OffsetDateTime.class),
                resultSet.getObject("rotated_at", OffsetDateTime.class), resultSet.getObject("revoked_at", OffsetDateTime.class));
    }

    private List<String> rolesFor(UUID accountId) {
        return jdbcTemplate.queryForList("""
                select role_code from iam_role_assignments
                where account_id = ? and revoked_at is null
                  and effective_from <= current_timestamp
                  and (effective_until is null or effective_until > current_timestamp)
                order by role_code
                """, String.class, accountId);
    }
}
