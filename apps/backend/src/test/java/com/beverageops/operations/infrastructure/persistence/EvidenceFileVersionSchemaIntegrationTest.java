package com.beverageops.operations.infrastructure.persistence;

import java.time.OffsetDateTime;
import java.util.UUID;

import com.beverageops.operations.domain.model.EvidenceFileStatus;
import com.beverageops.operations.domain.model.EvidenceMediaType;
import com.beverageops.operations.domain.port.ShiftExecutionRepository;
import com.beverageops.support.PostgresIntegrationTestBase;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EvidenceFileVersionSchemaIntegrationTest extends PostgresIntegrationTestBase {

    @Autowired
    private ShiftExecutionRepository execution;

    @Test
    void permitsOneCurrentFileAndRetainsPurgedMetadata() {
        var accountId = insertAccount();
        var evidenceId = insertEvidence(accountId);
        var firstId = UUID.randomUUID();

        insertVersion(firstId, evidenceId, 1, "CURRENT", null, null);

        assertThatThrownBy(() -> insertVersion(UUID.randomUUID(), evidenceId, 2, "CURRENT", null, null))
                .hasMessageContaining("ops_evidence_file_versions_current_unique");

        var purgedAt = OffsetDateTime.now();
        jdbcTemplate.update("""
                update ops_evidence_file_versions
                set status = 'PURGED', purged_at = ?, purge_result = 'DELETED'
                where id = ?
                """, purgedAt, firstId);

        var metadata = jdbcTemplate.queryForMap("""
                select relative_path, original_filename, sha256, status, purged_at
                from ops_evidence_file_versions where id = ?
                """, firstId);
        assertThat(metadata.get("relative_path")).isEqualTo("evidence/" + evidenceId + "/v1/media.pdf");
        assertThat(metadata.get("original_filename")).isEqualTo("evidence.pdf");
        assertThat(metadata.get("sha256")).isEqualTo("a".repeat(64));
        assertThat(metadata.get("status")).isEqualTo("PURGED");
        assertThat(metadata.get("purged_at")).isNotNull();
    }

    @Test
    void acceptsPurgeSchedulingOnlyForHistoricalStatuses() {
        var accountId = insertAccount();
        var evidenceId = insertEvidence(accountId);
        var purgeAfter = OffsetDateTime.now().plusDays(3);

        insertVersion(UUID.randomUUID(), evidenceId, 1, "REPLACED", purgeAfter, "replaced by a clearer photo");

        assertThatThrownBy(() -> insertVersion(UUID.randomUUID(), evidenceId, 2, "WITHDRAWN", null, "withdrawn"))
                .hasMessageContaining("ops_evidence_file_versions_historical_purge_check");
    }

    @Test
    void persistsCurrentReplacementAndPurgeLifecycle() {
        var accountId = insertAccount();
        var evidenceId = insertEvidence(accountId);
        var createdAt = OffsetDateTime.now().minusDays(4);

        execution.lockEvidence(evidenceId).orElseThrow();
        var first = execution.insertCurrentEvidenceFileVersion(new ShiftExecutionRepository.NewEvidenceFileVersion(
                UUID.randomUUID(), evidenceId, execution.nextEvidenceFileVersion(evidenceId),
                "evidence/" + evidenceId + "/v1/" + UUID.randomUUID() + ".pdf", "shift-close.pdf",
                EvidenceMediaType.PDF, "application/pdf", "application/pdf", 42L, "a".repeat(64), accountId));

        assertThat(first.status()).isEqualTo(EvidenceFileStatus.CURRENT);
        assertThat(execution.findEvidenceFileVersions(evidenceId)).extracting(ShiftExecutionRepository.EvidenceFileVersion::fileVersion)
                .containsExactly(1L);

        var replaced = execution.replaceCurrentEvidenceFileVersion(evidenceId, accountId,
                "uploaded a clearer document", createdAt);
        assertThat(replaced.status()).isEqualTo(EvidenceFileStatus.REPLACED);
        assertThat(replaced.purgeAfter()).isEqualTo(createdAt);

        execution.lockEvidence(evidenceId).orElseThrow();
        var second = execution.insertCurrentEvidenceFileVersion(new ShiftExecutionRepository.NewEvidenceFileVersion(
                UUID.randomUUID(), evidenceId, execution.nextEvidenceFileVersion(evidenceId),
                "evidence/" + evidenceId + "/v2/" + UUID.randomUUID() + ".pdf", "shift-close-v2.pdf",
                EvidenceMediaType.PDF, "application/pdf", "application/pdf", 84L, "b".repeat(64), accountId));

        assertThat(execution.lockCurrentEvidenceFileVersion(evidenceId)).contains(second);
        assertThat(execution.lockDueEvidenceFileVersions(OffsetDateTime.now(), 10))
                .extracting(ShiftExecutionRepository.EvidenceFileVersion::id)
                .containsExactly(replaced.id());

        var purged = execution.markEvidenceFileVersionPurged(replaced.id(), OffsetDateTime.now(), "DELETED");
        assertThat(purged.status()).isEqualTo(EvidenceFileStatus.PURGED);
        assertThat(purged.originalFilename()).isEqualTo("shift-close.pdf");
        assertThat(purged.sha256()).isEqualTo("a".repeat(64));
        assertThat(execution.findEvidenceFileVersions(evidenceId))
                .extracting(ShiftExecutionRepository.EvidenceFileVersion::status)
                .containsExactly(EvidenceFileStatus.CURRENT, EvidenceFileStatus.PURGED);
    }

    private UUID insertAccount() {
        var accountId = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into iam_accounts (id, login_id, display_name, status, password_hash)
                values (?, ?, 'File Tester', 'ACTIVE', 'hash')
                """, accountId, "FILE" + accountId.toString().substring(0, 8));
        return accountId;
    }

    private UUID insertEvidence(UUID accountId) {
        var termId = UUID.randomUUID();
        var storeId = UUID.randomUUID();
        var templateId = UUID.randomUUID();
        var operatingDayId = UUID.randomUUID();
        var shiftId = UUID.randomUUID();
        var componentId = UUID.randomUUID();
        var milestoneId = UUID.randomUUID();
        var evidenceId = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into gov_terms (id, code, name, start_date, end_date, status, created_by_account_id)
                values (?, ?, 'Term', current_date, current_date + 120, 'DRAFT', ?)
                """, termId, "TERM" + termId.toString().substring(0, 8), accountId);
        jdbcTemplate.update("""
                insert into gov_stores (id, code, name, status, created_by_account_id)
                values (?, ?, 'Store', 'ACTIVE', ?)
                """, storeId, "STORE" + storeId.toString().substring(0, 8), accountId);
        jdbcTemplate.update("""
                insert into gov_template_versions
                    (id, term_id, store_id, template_code, template_revision, name, status, effective_from, configuration,
                     created_by_account_id)
                values (?, ?, ?, ?, 1, 'Template', 'PUBLISHED', current_date, '{}'::jsonb, ?)
                """, templateId, termId, storeId, "TPL" + templateId.toString().substring(0, 8), accountId);
        jdbcTemplate.update("""
                insert into ops_operating_days
                    (id, term_id, store_id, operating_date, template_version_id, template_revision, template_snapshot, status,
                     created_by_account_id)
                values (?, ?, ?, current_date, ?, 1, '{}'::jsonb, 'DRAFT', ?)
                """, operatingDayId, termId, storeId, templateId, accountId);
        jdbcTemplate.update("""
                insert into ops_shifts (id, operating_day_id, code, name, starts_at, ends_at, status, created_by_account_id)
                values (?, ?, 'S1', 'Shift', current_timestamp, current_timestamp + interval '1 hour', 'SCHEDULED', ?)
                """, shiftId, operatingDayId, accountId);
        jdbcTemplate.update("""
                insert into gov_template_components
                    (id, template_version_id, component_type, code, name, configuration, created_by_account_id)
                values (?, ?, 'MILESTONE', 'M1', 'Milestone', '{}'::jsonb, ?)
                """, componentId, templateId, accountId);
        jdbcTemplate.update("""
                insert into ops_milestone_submissions
                    (id, shift_id, source_template_component_id, code, name, definition_snapshot, required, evidence_required, status)
                values (?, ?, ?, 'M1', 'Milestone', '{}'::jsonb, false, false, 'PENDING')
                """, milestoneId, shiftId, componentId);
        jdbcTemplate.update("""
                insert into ops_evidence
                    (id, shift_id, milestone_submission_id, kind, reference_value, occurred_at, submitted_by_account_id)
                values (?, ?, ?, 'OBJECT_REFERENCE', 'pending-file', current_timestamp, ?)
                """, evidenceId, shiftId, milestoneId, accountId);
        return evidenceId;
    }

    private void insertVersion(UUID id, UUID evidenceId, long version, String status, OffsetDateTime purgeAfter, String reason) {
        jdbcTemplate.update("""
                insert into ops_evidence_file_versions
                    (id, evidence_id, file_version, relative_path, original_filename, safe_extension, declared_mime_type,
                     detected_mime_type, byte_size, sha256, status, reason, uploaded_by_account_id, purge_after)
                select ?, ?, ?, ?, 'evidence.pdf', 'pdf', 'application/pdf', 'application/pdf', 42, ?, ?, ?,
                       submitted_by_account_id, ?
                from ops_evidence where id = ?
                """, id, evidenceId, version, "evidence/" + evidenceId + "/v" + version + "/media.pdf",
                "a".repeat(64), status, reason, purgeAfter, evidenceId);
    }
}
