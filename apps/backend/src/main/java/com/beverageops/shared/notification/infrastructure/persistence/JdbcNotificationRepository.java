package com.beverageops.shared.notification.infrastructure.persistence;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.shared.notification.domain.port.NotificationRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class JdbcNotificationRepository implements NotificationRepository {

    private final JdbcTemplate jdbcTemplate;

    JdbcNotificationRepository(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public Notification create(UUID id, UUID recipientAccountId, String eventType, String resourceType, UUID resourceId,
                               String title, String message) {
        return jdbcTemplate.queryForObject("""
                        insert into shared_notifications
                            (id, recipient_account_id, event_type, resource_type, resource_id, title, message)
                        values (?, ?, ?, ?, ?, ?, ?)
                        returning id, recipient_account_id, event_type, resource_type, resource_id, title, message, read_at,
                                  version, created_at, updated_at
                        """, (resultSet, rowNumber) -> notification(resultSet), id, recipientAccountId, eventType, resourceType,
                resourceId, title, message);
    }

    @Override
    public List<Notification> findForRecipient(UUID recipientAccountId) {
        return jdbcTemplate.query("""
                select id, recipient_account_id, event_type, resource_type, resource_id, title, message, read_at,
                       version, created_at, updated_at
                from shared_notifications
                where recipient_account_id = ?
                order by created_at desc, id desc
                """, (resultSet, rowNumber) -> notification(resultSet), recipientAccountId);
    }

    @Override
    public Optional<Notification> lock(UUID notificationId) {
        return jdbcTemplate.query("""
                        select id, recipient_account_id, event_type, resource_type, resource_id, title, message, read_at,
                               version, created_at, updated_at
                        from shared_notifications where id = ? for update
                        """, resultSet -> resultSet.next() ? Optional.of(notification(resultSet)) : Optional.empty(), notificationId);
    }

    @Override
    public Notification markRead(UUID notificationId, long expectedVersion) {
        return jdbcTemplate.queryForObject("""
                        update shared_notifications
                        set read_at = current_timestamp, version = version + 1, updated_at = current_timestamp
                        where id = ? and read_at is null and version = ?
                        returning id, recipient_account_id, event_type, resource_type, resource_id, title, message, read_at,
                                  version, created_at, updated_at
                        """, (resultSet, rowNumber) -> notification(resultSet), notificationId, expectedVersion);
    }

    @Override
    public int markAllRead(UUID recipientAccountId) {
        return jdbcTemplate.update("""
                update shared_notifications
                set read_at = current_timestamp, version = version + 1, updated_at = current_timestamp
                where recipient_account_id = ? and read_at is null
                """, recipientAccountId);
    }

    @Override
    public void appendAudit(String eventType, UUID resourceId, UUID actorAccountId, Long previousVersion, Long newVersion) {
        jdbcTemplate.update("""
                insert into audit_events
                    (id, event_type, resource_type, resource_id, actor_account_id, previous_version, new_version, metadata)
                values (?, ?, 'NOTIFICATION', ?, ?, ?, ?, '{}'::jsonb)
                """, UUID.randomUUID(), eventType, resourceId, actorAccountId, previousVersion, newVersion);
    }

    private Notification notification(ResultSet resultSet) throws java.sql.SQLException {
        return new Notification(resultSet.getObject("id", UUID.class), resultSet.getObject("recipient_account_id", UUID.class),
                resultSet.getString("event_type"), resultSet.getString("resource_type"), resultSet.getObject("resource_id", UUID.class),
                resultSet.getString("title"), resultSet.getString("message"), resultSet.getObject("read_at", OffsetDateTime.class),
                resultSet.getLong("version"), resultSet.getObject("created_at", OffsetDateTime.class),
                resultSet.getObject("updated_at", OffsetDateTime.class));
    }
}
