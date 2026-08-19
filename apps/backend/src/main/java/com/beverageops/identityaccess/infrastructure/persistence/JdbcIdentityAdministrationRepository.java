package com.beverageops.identityaccess.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.identityaccess.domain.model.RoleCode;
import com.beverageops.identityaccess.domain.port.IdentityAdministrationRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class JdbcIdentityAdministrationRepository implements IdentityAdministrationRepository {

    private final JdbcTemplate jdbcTemplate;

    JdbcIdentityAdministrationRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public List<PendingRegistration> findRegistrationsByStatus(String status) {
        return jdbcTemplate.query("""
                        select r.id, r.account_id, r.login_id, r.display_name
                        from iam_registration_requests r
                        where r.status = ?
                        order by r.created_at asc
                        """,
                (resultSet, rowNumber) -> new PendingRegistration(
                        resultSet.getObject("id", UUID.class),
                        resultSet.getObject("account_id", UUID.class),
                        resultSet.getString("login_id"),
                        resultSet.getString("display_name")),
                status);
    }

    @Override
    public Optional<PendingRegistration> lockPendingRegistration(UUID registrationRequestId) {
        return jdbcTemplate.query("""
                        select r.id, r.account_id, r.login_id, r.display_name
                        from iam_registration_requests r
                        join iam_accounts a on a.id = r.account_id
                        where r.id = ? and r.status = 'PENDING' and a.status = 'PENDING'
                        for update of r, a
                        """,
                resultSet -> resultSet.next()
                        ? Optional.of(new PendingRegistration(
                                resultSet.getObject("id", UUID.class),
                                resultSet.getObject("account_id", UUID.class),
                                resultSet.getString("login_id"),
                                resultSet.getString("display_name")))
                        : Optional.empty(),
                registrationRequestId);
    }

    @Override
    public Optional<ManagedAccount> lockAccount(UUID accountId) {
        return jdbcTemplate.query("""
                        select id, login_id, display_name, status
                        from iam_accounts
                        where id = ?
                        for update
                        """,
                resultSet -> resultSet.next()
                        ? Optional.of(new ManagedAccount(
                                resultSet.getObject("id", UUID.class),
                                resultSet.getString("login_id"),
                                resultSet.getString("display_name"),
                                resultSet.getString("status")))
                        : Optional.empty(),
                accountId);
    }

    @Override
    public void approveRegistration(UUID registrationRequestId, UUID accountId, UUID actorId, String passwordHash,
                                    List<RoleCode> roles, String reason) {
        jdbcTemplate.update("""
                update iam_accounts
                set status = 'ACTIVE', password_hash = ?, must_change_password = true,
                    authorization_version = authorization_version + 1, updated_at = current_timestamp
                where id = ?
                """, passwordHash, accountId);
        for (var role : roles) {
            jdbcTemplate.update("""
                    insert into iam_role_assignments (id, account_id, role_code, granted_by_account_id)
                    values (?, ?, ?, ?)
                    """, UUID.randomUUID(), accountId, role.name(), actorId);
        }
        jdbcTemplate.update("""
                update iam_registration_requests
                set status = 'APPROVED', reviewed_by_account_id = ?, reviewed_at = current_timestamp,
                    review_reason = ?, updated_at = current_timestamp
                where id = ?
                """, actorId, reason, registrationRequestId);
    }

    @Override
    public void rejectRegistration(UUID registrationRequestId, UUID actorId, String reason) {
        jdbcTemplate.update("""
                update iam_registration_requests
                set status = 'REJECTED', reviewed_by_account_id = ?, reviewed_at = current_timestamp,
                    review_reason = ?, updated_at = current_timestamp
                where id = ?
                """, actorId, reason, registrationRequestId);
    }

    @Override
    public void resetPassword(UUID accountId, String passwordHash, String eventType, String revokeReason) {
        jdbcTemplate.update("""
                update iam_accounts
                set password_hash = ?, must_change_password = true, authorization_version = authorization_version + 1,
                    updated_at = current_timestamp
                where id = ?
                """, passwordHash, accountId);
        revokeLiveSessions(accountId, revokeReason);
    }

    @Override
    public void disableAccount(UUID accountId, String revokeReason) {
        jdbcTemplate.update("""
                update iam_accounts
                set status = 'DISABLED', authorization_version = authorization_version + 1, updated_at = current_timestamp
                where id = ?
                """, accountId);
        revokeLiveSessions(accountId, revokeReason);
    }

    @Override
    public void reactivateAccount(UUID accountId, String passwordHash, String revokeReason) {
        jdbcTemplate.update("""
                update iam_accounts
                set status = 'ACTIVE', password_hash = ?, must_change_password = true,
                    authorization_version = authorization_version + 1, updated_at = current_timestamp
                where id = ?
                """, passwordHash, accountId);
        revokeLiveSessions(accountId, revokeReason);
    }

    @Override
    public void appendEvent(String eventType, UUID actorId, UUID subjectAccountId, String reason) {
        jdbcTemplate.update("""
                insert into iam_auth_events (id, event_type, actor_account_id, subject_account_id, metadata)
                values (?, ?, ?, ?, jsonb_build_object('reason', ?))
                """, UUID.randomUUID(), eventType, actorId, subjectAccountId, reason);
    }

    private void revokeLiveSessions(UUID accountId, String revokeReason) {
        jdbcTemplate.update("""
                update iam_refresh_sessions
                set revoked_at = current_timestamp, revoke_reason = ?
                where account_id = ? and revoked_at is null
                """, revokeReason, accountId);
    }
}
