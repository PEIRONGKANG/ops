package com.beverageops.operations.domain.port;

import java.io.InputStream;
import java.time.OffsetDateTime;
import java.util.UUID;

import com.beverageops.operations.domain.model.EvidenceMediaType;

public interface EvidenceMediaStoragePort {

    StoredEvidenceFile stageAndPublish(Upload upload);

    InputStream open(String relativePath);

    InputStream open(String relativePath, long offset, long length);

    long size(String relativePath);

    boolean delete(String relativePath);

    record Upload(UUID evidenceId, long fileVersion, String originalFilename, String declaredMimeType, InputStream content) {
    }

    record StoredEvidenceFile(String relativePath, String originalFilename, EvidenceMediaType mediaType,
                              String detectedMimeType, long byteSize, String sha256, OffsetDateTime publishedAt) {
    }
}
