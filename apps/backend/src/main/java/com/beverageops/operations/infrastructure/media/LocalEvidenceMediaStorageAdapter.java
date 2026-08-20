package com.beverageops.operations.infrastructure.media;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.LinkOption;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.util.Locale;
import java.util.UUID;

import com.beverageops.operations.application.usecase.MediaStorageProperties;
import com.beverageops.operations.domain.model.EvidenceMediaType;
import com.beverageops.operations.domain.port.EvidenceMediaStoragePort;
import org.springframework.stereotype.Component;

@Component
public class LocalEvidenceMediaStorageAdapter implements EvidenceMediaStoragePort {

    private final MediaStorageProperties properties;
    private final MediaSignatureValidator signatures = new MediaSignatureValidator();

    public LocalEvidenceMediaStorageAdapter(MediaStorageProperties properties) {
        this.properties = properties;
    }

    @Override
    public StoredEvidenceFile stageAndPublish(Upload upload) {
        validateUpload(upload);
        var mediaType = mediaType(upload.originalFilename());
        var staging = safeStagingPath();
        try {
            Files.createDirectories(properties.stagingRoot());
            var staged = copyAndDigest(upload.content(), staging, mediaType);
            var detectedMimeType = signatures.validate(staging, mediaType);
            if (!mediaType.mimeType().equals(upload.declaredMimeType()) || !mediaType.mimeType().equals(detectedMimeType)) {
                throw new EvidenceMediaValidationException("Declared MIME type or file signature does not match the evidence type.");
            }
            var relativePath = relativePath(upload.evidenceId(), upload.fileVersion(), mediaType);
            var published = resolveRelativePath(relativePath);
            Files.createDirectories(published.getParent());
            moveIntoPlace(staging, published);
            return new StoredEvidenceFile(relativePath, upload.originalFilename(), mediaType, detectedMimeType, staged.byteSize(),
                    staged.sha256(), OffsetDateTime.now());
        } catch (EvidenceMediaValidationException exception) {
            deleteIfExists(staging);
            throw exception;
        } catch (IOException exception) {
            deleteIfExists(staging);
            throw new IllegalStateException("Unable to store evidence file.", exception);
        }
    }

    @Override
    public InputStream open(String relativePath) {
        try {
            return Files.newInputStream(resolveRelativePath(relativePath));
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read evidence file.", exception);
        }
    }

    @Override
    public InputStream open(String relativePath, long offset, long length) {
        if (offset < 0 || length < 0) {
            throw new EvidenceMediaValidationException("Evidence read range is invalid.");
        }
        try {
            var input = Files.newInputStream(resolveRelativePath(relativePath));
            input.skipNBytes(offset);
            return new BoundedInputStream(input, length);
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read evidence file.", exception);
        }
    }

    @Override
    public long size(String relativePath) {
        try {
            return Files.size(resolveRelativePath(relativePath));
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to read evidence file metadata.", exception);
        }
    }

    @Override
    public boolean delete(String relativePath) {
        try {
            return Files.deleteIfExists(resolveRelativePath(relativePath));
        } catch (IOException exception) {
            throw new IllegalStateException("Unable to delete evidence file.", exception);
        }
    }

    private void validateUpload(Upload upload) {
        if (upload == null || upload.evidenceId() == null || upload.fileVersion() <= 0 || upload.content() == null) {
            throw new EvidenceMediaValidationException("Evidence upload metadata is incomplete.");
        }
        if (upload.originalFilename() == null || upload.originalFilename().isBlank() || upload.originalFilename().contains("/")
                || upload.originalFilename().contains("\\") || upload.originalFilename().contains("..")
                || upload.originalFilename().chars().anyMatch(Character::isISOControl)) {
            throw new EvidenceMediaValidationException("Evidence filename is invalid.");
        }
    }

    private EvidenceMediaType mediaType(String filename) {
        try {
            return EvidenceMediaType.fromFilename(filename);
        } catch (IllegalArgumentException exception) {
            throw new EvidenceMediaValidationException("Unsupported evidence file type.");
        }
    }

    private Path safeStagingPath() {
        return resolveUnderRoot(properties.stagingRoot().resolve(UUID.randomUUID() + ".part"));
    }

    private StagedFile copyAndDigest(InputStream content, Path staging, EvidenceMediaType mediaType) throws IOException {
        var digest = sha256();
        long bytes = 0;
        try (var input = new DigestInputStream(content, digest); var output = Files.newOutputStream(staging)) {
            var buffer = new byte[8192];
            for (int count; (count = input.read(buffer)) != -1;) {
                bytes += count;
                if (bytes > mediaType.maximumBytes()) {
                    throw new EvidenceMediaValidationException("Evidence file exceeds the " + maximumSize(mediaType) + " limit.");
                }
                output.write(buffer, 0, count);
            }
        }
        return new StagedFile(bytes, java.util.HexFormat.of().formatHex(digest.digest()));
    }

    private String relativePath(UUID evidenceId, long version, EvidenceMediaType mediaType) {
        return "evidence/" + evidenceId + "/v" + version + "/" + UUID.randomUUID() + "." + mediaType.extension();
    }

    private Path resolveRelativePath(String relativePath) {
        if (relativePath == null || relativePath.isBlank() || Path.of(relativePath).isAbsolute() || relativePath.contains("..")) {
            throw new EvidenceMediaValidationException("Evidence storage path is invalid.");
        }
        return resolveUnderRoot(properties.mediaRoot().resolve(relativePath));
    }

    private Path resolveUnderRoot(Path candidate) {
        var root = properties.mediaRoot();
        var resolved = candidate.toAbsolutePath().normalize();
        if (!resolved.startsWith(root)) {
            throw new EvidenceMediaValidationException("Evidence storage path is outside the configured media root.");
        }
        var current = root;
        if (Files.exists(current, LinkOption.NOFOLLOW_LINKS) && Files.isSymbolicLink(current)) {
            throw new EvidenceMediaValidationException("Evidence storage path cannot use a symbolic link.");
        }
        for (var segment : root.relativize(resolved)) {
            current = current.resolve(segment);
            if (Files.exists(current, LinkOption.NOFOLLOW_LINKS) && Files.isSymbolicLink(current)) {
                throw new EvidenceMediaValidationException("Evidence storage path cannot use a symbolic link.");
            }
        }
        return resolved;
    }

    private void moveIntoPlace(Path staging, Path published) throws IOException {
        try {
            Files.move(staging, published, StandardCopyOption.ATOMIC_MOVE);
        } catch (AtomicMoveNotSupportedException exception) {
            Files.move(staging, published);
        }
    }

    private MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable.", exception);
        }
    }

    private String maximumSize(EvidenceMediaType mediaType) {
        return (mediaType.maximumBytes() / (1024 * 1024)) + " MB";
    }

    private void deleteIfExists(Path path) {
        if (path == null) {
            return;
        }
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // A later scheduled staging cleanup is safer than masking the original write error.
        }
    }

    private record StagedFile(long byteSize, String sha256) {
    }

    private static final class BoundedInputStream extends InputStream {

        private final InputStream delegate;
        private long remaining;

        private BoundedInputStream(InputStream delegate, long remaining) {
            this.delegate = delegate;
            this.remaining = remaining;
        }

        @Override
        public int read() throws IOException {
            if (remaining == 0) {
                return -1;
            }
            var value = delegate.read();
            if (value != -1) {
                remaining--;
            }
            return value;
        }

        @Override
        public int read(byte[] bytes, int offset, int length) throws IOException {
            if (remaining == 0) {
                return -1;
            }
            var count = delegate.read(bytes, offset, (int) Math.min(length, remaining));
            if (count != -1) {
                remaining -= count;
            }
            return count;
        }

        @Override
        public void close() throws IOException {
            delegate.close();
        }
    }
}
