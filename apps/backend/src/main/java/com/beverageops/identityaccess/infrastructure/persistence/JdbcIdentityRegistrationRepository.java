package com.beverageops.identityaccess.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;

import com.beverageops.identityaccess.domain.model.LoginId;
import com.beverageops.identityaccess.domain.port.IdentityRegistrationRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class JdbcIdentityRegistrationRepository implements IdentityRegistrationRepository {

    private final JdbcTemplate jdbcTemplate;

    JdbcIdentityRegistrationRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Optional<BootstrapState> lockBootstrap() {
        return jdbcTemplate.query("""
                        select bootstrap_p1_consumed_at is not null as consumed
                        from iam_system_bootstrap
                        where singleton = true
                        for update
                        """,
                resultSet -> resultSet.next()
                        ? Optional.of(new BootstrapState(resultSet.getBoolean("consumed")))
                        : Optional.empty());
    }

    @Override
    public void markBootstrapConsumed(UUID accountId) {
        var updated = jdbcTemplate.update("""
                update iam_system_bootstrap
                set bootstrap_p1_consumed_at = current_timestamp, bootstrap_account_id = ?
                where singleton = true and bootstrap_p1_consumed_at is null
                """, accountId);
        if (updated != 1) {
            throw new IllegalStateException("Bootstrap P1 has already been consumed.");
        }
    }

    @Override
    public boolean createPendingRegistration(UUID accountId, UUID requestId, LoginId loginId, String displayName) {
        var accountCreated = jdbcTemplate.update("""
                insert into iam_accounts (id, login_id, display_name, status)
                values (?, ?, ?, 'PENDING')
                on conflict (login_id) do nothing
                """, accountId, loginId.value(), displayName);
        if (accountCreated != 1) {
            return false;
        }
        jdbcTemplate.update("""
                insert into iam_registration_requests (id, login_id, display_name, status, account_id)
                values (?, ?, ?, 'PENDING', ?)
                """, requestId, loginId.value(), displayName, accountId);
        return true;
    }

    @Override
    public void createBootstrapP1(UUID accountId, LoginId loginId, String displayName, String passwordHash) {
        jdbcTemplate.update("""
                insert into iam_accounts (id, login_id, display_name, status, password_hash, must_change_password)
                values (?, ?, ?, 'ACTIVE', ?, true)
                """, accountId, loginId.value(), displayName, passwordHash);
        jdbcTemplate.update("""
                insert into iam_role_assignments (id, account_id, role_code)
                values (?, ?, 'P1')
                """, UUID.randomUUID(), accountId);
    }

    @Override
    public void appendEvent(String eventType, UUID subjectAccountId) {
        jdbcTemplate.update("""
                insert into iam_auth_events (id, event_type, subject_account_id)
                values (?, ?, ?)
                """, UUID.randomUUID(), eventType, subjectAccountId);
    }
}
