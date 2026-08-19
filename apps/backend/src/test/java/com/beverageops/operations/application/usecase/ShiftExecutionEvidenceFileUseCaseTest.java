package com.beverageops.operations.application.usecase;

import java.io.ByteArrayInputStream;
import java.time.Clock;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.operations.domain.model.EvidenceFileStatus;
import com.beverageops.operations.domain.model.EvidenceKind;
import com.beverageops.operations.domain.model.EvidenceMediaType;
import com.beverageops.operations.domain.model.ShiftStatus;
import com.beverageops.operations.domain.port.EvidenceMediaStoragePort;
import com.beverageops.operations.domain.port.OperationsSchedulingRepository;
import com.beverageops.operations.domain.port.ShiftExecutionRepository;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ShiftExecutionEvidenceFileUseCaseTest {

    private static final Instant NOW = Instant.parse("2026-08-19T08:30:00Z");

    @Test
    void attachesOnlyToAnObjectReferenceAndAuditsTheUpload() {
        var scheduling = mock(OperationsSchedulingRepository.class);
        var execution = mock(ShiftExecutionRepository.class);
        var storage = mock(EvidenceMediaStoragePort.class);
        var evidenceId = UUID.randomUUID();
        var actorId = UUID.randomUUID();
        var evidence = evidence(evidenceId, EvidenceKind.OBJECT_REFERENCE);
        when(execution.lockEvidence(evidenceId)).thenReturn(Optional.of(evidence));
        when(execution.lockCurrentEvidenceFileVersion(evidenceId)).thenReturn(Optional.empty());
        when(execution.nextEvidenceFileVersion(evidenceId)).thenReturn(1L);
        when(storage.stageAndPublish(any())).thenReturn(stored(evidenceId, 1));
        when(execution.insertCurrentEvidenceFileVersion(any())).thenAnswer(invocation -> {
            var newVersion = invocation.getArgument(0, ShiftExecutionRepository.NewEvidenceFileVersion.class);
            return fileVersion(newVersion.id(), evidenceId, 1, EvidenceFileStatus.CURRENT, null, null);
        });
        allowAssignedStudent(scheduling, actorId, evidence.shiftId());

        var result = useCase(scheduling, execution, storage).uploadEvidenceFile(evidenceId,
                upload(actorId, "close.pdf"));

        assertThat(result.status()).isEqualTo(EvidenceFileStatus.CURRENT);
        verify(execution).insertCurrentEvidenceFileVersion(any());
        verify(scheduling).appendAudit(eq("EVIDENCE_FILE_UPLOADED"), eq("EVIDENCE_FILE"), eq(result.id()),
                eq(actorId), eq(null), eq(null), eq(null));
    }

    @Test
    void replacementRequiresReasonAndSchedulesOldCurrentFileForThreeDaysLater() {
        var scheduling = mock(OperationsSchedulingRepository.class);
        var execution = mock(ShiftExecutionRepository.class);
        var storage = mock(EvidenceMediaStoragePort.class);
        var evidenceId = UUID.randomUUID();
        var actorId = UUID.randomUUID();
        var existing = fileVersion(UUID.randomUUID(), evidenceId, 1, EvidenceFileStatus.CURRENT, null, null);
        when(execution.lockEvidence(evidenceId)).thenReturn(Optional.of(evidence(evidenceId, EvidenceKind.OBJECT_REFERENCE)));
        when(execution.lockCurrentEvidenceFileVersion(evidenceId)).thenReturn(Optional.of(existing));
        when(execution.nextEvidenceFileVersion(evidenceId)).thenReturn(2L);
        when(storage.stageAndPublish(any())).thenReturn(stored(evidenceId, 2));
        var purgeAfter = OffsetDateTime.ofInstant(NOW.plusSeconds(3 * 24 * 60 * 60), ZoneOffset.UTC);
        when(execution.replaceCurrentEvidenceFileVersion(evidenceId, actorId, "clearer scan", purgeAfter))
                .thenReturn(fileVersion(existing.id(), evidenceId, 1, EvidenceFileStatus.REPLACED, purgeAfter, "clearer scan"));
        when(execution.insertCurrentEvidenceFileVersion(any())).thenAnswer(invocation -> {
            var value = invocation.getArgument(0, ShiftExecutionRepository.NewEvidenceFileVersion.class);
            return fileVersion(value.id(), evidenceId, 2, EvidenceFileStatus.CURRENT, null, null);
        });
        allowAssignedStudent(scheduling, actorId, evidenceId);

        var result = useCase(scheduling, execution, storage).replaceEvidenceFile(evidenceId, "clearer scan",
                upload(actorId, "close.pdf"));

        assertThat(result.fileVersion()).isEqualTo(2);
        verify(execution).replaceCurrentEvidenceFileVersion(evidenceId, actorId, "clearer scan", purgeAfter);
        verify(scheduling).appendAudit(eq("EVIDENCE_FILE_REPLACED"), eq("EVIDENCE_FILE"), eq(result.id()),
                eq(actorId), eq("clearer scan"), eq(1L), eq(2L));
    }

    @Test
    void rejectsFilesForNonObjectReferenceEvidenceBeforeWritingContent() {
        var scheduling = mock(OperationsSchedulingRepository.class);
        var execution = mock(ShiftExecutionRepository.class);
        var storage = mock(EvidenceMediaStoragePort.class);
        var evidenceId = UUID.randomUUID();
        var actorId = UUID.randomUUID();
        when(execution.lockEvidence(evidenceId)).thenReturn(Optional.of(evidence(evidenceId, EvidenceKind.TEXT)));
        allowAssignedStudent(scheduling, actorId, evidenceId);

        assertThatThrownBy(() -> useCase(scheduling, execution, storage).uploadEvidenceFile(evidenceId,
                upload(actorId, "close.pdf")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("OBJECT_REFERENCE");

        verify(storage, never()).stageAndPublish(any());
    }

    @Test
    void withdrawalRequiresReasonAndMovesCurrentFileToWithdrawn() {
        var scheduling = mock(OperationsSchedulingRepository.class);
        var execution = mock(ShiftExecutionRepository.class);
        var storage = mock(EvidenceMediaStoragePort.class);
        var evidenceId = UUID.randomUUID();
        var actorId = UUID.randomUUID();
        var current = fileVersion(UUID.randomUUID(), evidenceId, 1, EvidenceFileStatus.CURRENT, null, null);
        when(execution.lockEvidence(evidenceId)).thenReturn(Optional.of(evidence(evidenceId, EvidenceKind.OBJECT_REFERENCE)));
        when(execution.lockCurrentEvidenceFileVersion(evidenceId)).thenReturn(Optional.of(current));
        var purgeAfter = OffsetDateTime.ofInstant(NOW.plusSeconds(3 * 24 * 60 * 60), ZoneOffset.UTC);
        when(execution.withdrawCurrentEvidenceFileVersion(evidenceId, actorId, "wrong document", purgeAfter))
                .thenReturn(fileVersion(current.id(), evidenceId, 1, EvidenceFileStatus.WITHDRAWN, purgeAfter, "wrong document"));
        allowAssignedStudent(scheduling, actorId, evidenceId);

        var withdrawn = useCase(scheduling, execution, storage).withdrawEvidenceFile(evidenceId, "wrong document",
                actor(actorId));

        assertThat(withdrawn.status()).isEqualTo(EvidenceFileStatus.WITHDRAWN);
        verify(scheduling).appendAudit(eq("EVIDENCE_FILE_WITHDRAWN"), eq("EVIDENCE_FILE"), eq(current.id()),
                eq(actorId), eq("wrong document"), eq(1L), eq(1L));
    }

    @Test
    void blocksAnUnassignedStudentFromListingEvidenceFiles() {
        var scheduling = mock(OperationsSchedulingRepository.class);
        var execution = mock(ShiftExecutionRepository.class);
        var storage = mock(EvidenceMediaStoragePort.class);
        var evidenceId = UUID.randomUUID();
        var actorId = UUID.randomUUID();
        var evidence = evidence(evidenceId, EvidenceKind.OBJECT_REFERENCE);
        when(execution.lockEvidence(evidenceId)).thenReturn(Optional.of(evidence));
        when(scheduling.findShift(evidence.shiftId())).thenReturn(Optional.of(new OperationsSchedulingRepository.Shift(
                evidence.shiftId(), UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), java.time.LocalDate.of(2026, 8, 19),
                "S1", "Shift", OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC), OffsetDateTime.ofInstant(NOW.plusSeconds(3600),
                ZoneOffset.UTC), ShiftStatus.IN_PROGRESS, null, 1L, OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC))));
        when(scheduling.isAssignedToShift(actorId, evidence.shiftId())).thenReturn(false);

        assertThatThrownBy(() -> useCase(scheduling, execution, storage).evidenceFiles(evidenceId, actor(actorId)))
                .isInstanceOf(com.beverageops.identityaccess.application.usecase.ForbiddenException.class);

        verify(execution, never()).findEvidenceFileVersions(evidenceId);
    }

    private ShiftExecutionUseCase useCase(OperationsSchedulingRepository scheduling, ShiftExecutionRepository execution,
                                           EvidenceMediaStoragePort storage) {
        return new ShiftExecutionUseCase(scheduling, execution, mock(org.springframework.context.ApplicationEventPublisher.class),
                storage, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    private ShiftExecutionUseCase.EvidenceFileUploadCommand upload(UUID actorId, String filename) {
        return new ShiftExecutionUseCase.EvidenceFileUploadCommand(filename, "application/pdf",
                new ByteArrayInputStream("%PDF-1.7".getBytes()), actorId, false, false, true);
    }

    private ShiftExecutionUseCase.EvidenceFileActor actor(UUID actorId) {
        return new ShiftExecutionUseCase.EvidenceFileActor(actorId, false, false, true);
    }

    private ShiftExecutionRepository.Evidence evidence(UUID evidenceId, EvidenceKind kind) {
        return new ShiftExecutionRepository.Evidence(evidenceId, evidenceId, null, UUID.randomUUID(), kind,
                OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC), UUID.randomUUID(), 1, OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC));
    }

    private EvidenceMediaStoragePort.StoredEvidenceFile stored(UUID evidenceId, long version) {
        return new EvidenceMediaStoragePort.StoredEvidenceFile("evidence/" + evidenceId + "/v" + version + "/generated.pdf",
                "close.pdf", EvidenceMediaType.PDF, "application/pdf", 8L, "a".repeat(64), OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC));
    }

    private ShiftExecutionRepository.EvidenceFileVersion fileVersion(UUID id, UUID evidenceId, long version,
                                                                      EvidenceFileStatus status, OffsetDateTime purgeAfter,
                                                                      String reason) {
        return new ShiftExecutionRepository.EvidenceFileVersion(id, evidenceId, version,
                "evidence/" + evidenceId + "/v" + version + "/generated.pdf", "close.pdf", EvidenceMediaType.PDF,
                "application/pdf", "application/pdf", 8L, "a".repeat(64), status, reason, UUID.randomUUID(), null,
                OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC), OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC), purgeAfter,
                null, null);
    }

    private void allowAssignedStudent(OperationsSchedulingRepository scheduling, UUID actorId, UUID shiftId) {
        when(scheduling.isAssignedToShift(actorId, shiftId)).thenReturn(true);
        when(scheduling.findShift(shiftId)).thenReturn(Optional.of(new OperationsSchedulingRepository.Shift(shiftId,
                UUID.randomUUID(), UUID.randomUUID(), UUID.randomUUID(), java.time.LocalDate.of(2026, 8, 19), "S1", "Shift",
                OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC), OffsetDateTime.ofInstant(NOW.plusSeconds(3600), ZoneOffset.UTC),
                ShiftStatus.IN_PROGRESS, null, 1L, OffsetDateTime.ofInstant(NOW, ZoneOffset.UTC))));
    }
}
