package com.beverageops.operations.application.usecase;

import java.time.Clock;
import java.time.OffsetDateTime;

import com.beverageops.operations.domain.port.EvidenceMediaStoragePort;
import com.beverageops.operations.domain.port.OperationsSchedulingRepository;
import com.beverageops.operations.domain.port.ShiftExecutionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
public class EvidenceFilePurgeJob {

    private static final int BATCH_SIZE = 100;

    private final ShiftExecutionRepository execution;
    private final EvidenceMediaStoragePort storage;
    private final OperationsSchedulingRepository scheduling;
    private final Clock clock;

    @Autowired
    public EvidenceFilePurgeJob(ShiftExecutionRepository execution, EvidenceMediaStoragePort storage,
                                OperationsSchedulingRepository scheduling) {
        this(execution, storage, scheduling, Clock.systemUTC());
    }

    EvidenceFilePurgeJob(ShiftExecutionRepository execution, EvidenceMediaStoragePort storage,
                          OperationsSchedulingRepository scheduling, Clock clock) {
        this.execution = execution;
        this.storage = storage;
        this.scheduling = scheduling;
        this.clock = clock;
    }

    @Scheduled(cron = "${beverage-ops.media.purge-cron}")
    @Transactional
    public PurgeResult purgeDueEvidenceFiles() {
        var now = OffsetDateTime.ofInstant(clock.instant(), clock.getZone());
        int purged = 0;
        int failed = 0;
        for (var file : execution.lockDueEvidenceFileVersions(now, BATCH_SIZE)) {
            try {
                var deleted = storage.delete(file.relativePath());
                var result = deleted ? "DELETED" : "MISSING_ON_PURGE";
                var updated = execution.markEvidenceFileVersionPurged(file.id(), now, result);
                scheduling.appendAudit("EVIDENCE_FILE_PURGED", "EVIDENCE_FILE", updated.id(), file.changedByAccountId(),
                        null, null, null);
                purged++;
            } catch (RuntimeException exception) {
                execution.recordEvidenceFileVersionPurgeFailure(file.id(), "DELETE_FAILED");
                failed++;
            }
        }
        return new PurgeResult(purged, failed);
    }

    public record PurgeResult(int purged, int failed) {
    }
}
