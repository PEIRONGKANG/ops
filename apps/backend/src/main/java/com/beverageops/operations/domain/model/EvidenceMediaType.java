package com.beverageops.operations.domain.model;

import java.util.Arrays;
import java.util.Locale;

public enum EvidenceMediaType {
    JPEG("jpg", "image/jpeg", 50L * 1024 * 1024, false, false),
    PNG("png", "image/png", 50L * 1024 * 1024, false, false),
    WEBP("webp", "image/webp", 50L * 1024 * 1024, false, false),
    PDF("pdf", "application/pdf", 50L * 1024 * 1024, false, false),
    DOCX("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 50L * 1024 * 1024, true, false),
    XLSX("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 50L * 1024 * 1024, true, false),
    PPTX("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", 50L * 1024 * 1024, true, false),
    MP4("mp4", "video/mp4", 500L * 1024 * 1024, false, true),
    WEBM("webm", "video/webm", 500L * 1024 * 1024, false, true),
    MOV("mov", "video/quicktime", 500L * 1024 * 1024, false, true);

    private final String extension;
    private final String mimeType;
    private final long maximumBytes;
    private final boolean forceAttachment;
    private final boolean rangeSupported;

    EvidenceMediaType(String extension, String mimeType, long maximumBytes, boolean forceAttachment, boolean rangeSupported) {
        this.extension = extension;
        this.mimeType = mimeType;
        this.maximumBytes = maximumBytes;
        this.forceAttachment = forceAttachment;
        this.rangeSupported = rangeSupported;
    }

    public String extension() {
        return extension;
    }

    public String mimeType() {
        return mimeType;
    }

    public long maximumBytes() {
        return maximumBytes;
    }

    public boolean forceAttachment() {
        return forceAttachment;
    }

    public boolean rangeSupported() {
        return rangeSupported;
    }

    public static EvidenceMediaType fromFilename(String filename) {
        if (filename == null || filename.isBlank()) {
            throw new IllegalArgumentException("Evidence filename is required.");
        }
        var normalized = filename.toLowerCase(Locale.ROOT);
        var separator = normalized.lastIndexOf('.');
        if (separator < 1 || separator == normalized.length() - 1) {
            throw new IllegalArgumentException("Unsupported evidence file type.");
        }
        var extension = normalized.substring(separator + 1);
        return Arrays.stream(values())
                .filter(type -> type.extension.equals(extension))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Unsupported evidence file type."));
    }
}
