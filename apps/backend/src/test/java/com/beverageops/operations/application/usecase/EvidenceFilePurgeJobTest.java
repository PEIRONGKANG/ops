package com.beverageops.operations.application.usecase;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

import com.beverageops.operations.domain.model.EvidenceFileStatus;
import com.beverageops.operations.domain.model.EvidenceMediaType;
import com.beverageops.operations.domain.port.EvidenceMediaStoragePort;
import com.beverageops.operations.domain.port.OperationsSchedulingRepository;
import com.beverageops.operations.domain.port.ShiftExecutionRepository;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EvidenceFilePurgeJobTest {

    private static final Instant NOW = Instant.parse("2026-08-19T09:00:00Z");

    @Test
    void purgesOnlyDueHistoricalFilesAndRetainsMetadata() {
        var execution = mock(ShiftExecutionRepository.class);
        var storage = mock(EvidenceMediaStoragePort.class);
        var scheduling = mock(OperationsSchedulingRepository.class);
        var replaced = historical(EvidenceFileStatus.REPLACED);
        var withdrawn = historical(EvidenceFileStatus.WITHDRAWN);
        when(execution.lockDueEvidenceFileVersions(any(), eq(100))).thenReturn(List.of(replaced, withdrawn));
        when(storage.delete(replaced.relativePath())).thenReturn(true);
        when(storage.delete(withdrawn.relativePath())).thenReturn(false);
        when(execution.markEvidenceFileVersionPurged(eq(replaced.id()), any(), eq("DELETED")))
                .thenReturn(purged(replaced, "DELETED"));
        when(execution.markEvidenceFileVersionPurged(eq(withdrawn.id()), any(), eq("MISSING_ON_PURGE")))
                .thenReturn(purged(withdrawn, "MISSING_ON_PURGE"));

        var result = job(execution, storage, scheduling).purgeDueEvidenceFiles();

        assertThat(result.purged()).isEqualTo(2);
        assertThat(result.failed()).isZero();
        verify(execution).markEvidenceFileVersionPurged(eq(replaced.id()), any(), eq("DELETED"));
        verify(execution).markEvidenceFileVersionPurged(eq(withdrawn.id()), any(), eq("MISSING_ON_PURGE"));
        verify(scheduling).appendAudit(eq("EVIDENCE_FILE_PURGED"), eq("EVIDENCE_FILE"), eq(replaced.id()),
                eq(replaced.changedByAccountId()), eq(null), eq(null), eq(null));
        verify(execution, never()).lockCurrentEvidenceFileVersion(any());
    }

    @Test
    void recordsDeleteFailureAndContinuesWithLaterRecords() {
        var execution = mock(ShiftExecutionRepository.class);
        var storage = mock(EvidenceMediaStoragePort.class);
        var scheduling = mock(OperationsSchedulingRepository.class);
        var failing = historical(EvidenceFileStatus.REPLACED);
        var succeeding = historical(EvidenceFileStatus.WITHDRAWN);
        when(execution.lockDueEvidenceFileVersions(any(), eq(100))).thenReturn(List.of(failing, succeeding));
        doThrow(new IllegalStateException("disk temporarily unavailable")).when(storage).delete(failing.relativePath());
        when(storage.delete(succeeding.relativePath())).thenReturn(true);
        when(execution.markEvidenceFileVersionPurged(eq(succeeding.id()), any(), eq("DELETED")))
                .thenReturn(purged(succeeding, "DELETED"));

        var result = job(execution, storage, scheduling).purgeDueEvidenceFiles();

        assertThat(result.purged()).isOne();
        assertThat(result.failed()).isOne();
        verify(execution).recordEvidenceFileVersionPurgeFailure(failing.id(), "DELETE_FAILED");
        verify(execution).markEvidenceFileVersionPurged(eq(succeeding.id()), any(), eq("DELETED"));
    }

    @Test
    void neverDeletesCurrentContentBecauseOnlyHistoricalRowsAreSelected() {
        var execution = mock(ShiftExecutionRepository.class);
        var storage = mock(EvidenceMediaStoragePort.class);
        var scheduling = mock(OperationsSchedulingRepository.class);
        when(execution.lockDueEvidenceFileVersions(any(), eq(100))).thenReturn(List.of());

        var result = job(execution, storage, scheduling).purgeDueEvidenceFiles();

        assertThat(result.purged()).isZero();
        verify(storage, never()).delete(any());
        verify(execution, never()).markEvidenceFileVersionPurged(any(), any(), any());
    }

    private EvidenceFilePurgeJob job(ShiftExecutionRepository execution, EvidenceMediaStoragePort storage,
                                     OperationsSchedulingRepository scheduling) {
        return new EvidenceFilePurgeJob(execution, storage, scheduling, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private ShiftExecutionRepository.EvidenceFileVersion historical(EvidenceFileStatus status) {
        var accountId = UUID.randomUUID();
        var evidenceId = UUID.randomUUID();
        return new ShiftExecutionRepository.EvidenceFileVersion(UUID.randomUUID(), evidenceId, 1,
                "evidence/" + evidenceId + "/v1/content.pdf", "content.pdf", EvidenceMediaType.PDF, "application/pdf",
                "application/pdf", 42L, "a".repeat(64), status, "replaced", accountId, accountId,
                OffsetDateTime.ofInstant(NOW.minusSeconds(4 * 24 * 60 * 60), ZoneOffset.UTC),
                OffsetDateTime.ofInstant(NOW.minusSeconds(4 * 24 * 60 * 60), ZoneOffset.UTC),
                OffsetDateTime.ofInstant(NOW.minusSeconds(60), ZoneOffset.UTC), null, null);
    }

    private ShiftExecutionRepository.EvidenceFileVersion purged(ShiftExecutionRepository.EvidenceFileVersion source,
                                                                 String result) {
        return new ShiftExecutionRepository.EvidenceFileVersion(source.id(), source.evidenceId(), source.fileVersion(),
                source.relativePath(), source.originalFilename(), source.mediaType(), source.declaredMimeType(),
                source.detectedMimeType(), source.byteSize(), source.sha256(), EvidenceFileStatus.PURGED, source.reason(),
                source.uploadedByAccountId(), source.changedByAccountId(), source.createdAt(), source.updatedAt(),
                source.purgeAfter(), OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC), result);
    }
}
