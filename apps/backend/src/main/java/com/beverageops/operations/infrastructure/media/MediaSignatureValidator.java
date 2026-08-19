package com.beverageops.operations.infrastructure.media;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Locale;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import com.beverageops.operations.domain.model.EvidenceMediaType;

final class MediaSignatureValidator {

    String validate(Path file, EvidenceMediaType mediaType) {
        try {
            var prefix = java.nio.file.Files.readAllBytes(file);
            var detected = switch (mediaType) {
                case JPEG -> validateJpeg(prefix);
                case PNG -> validatePng(prefix);
                case WEBP -> validateWebp(prefix);
                case PDF -> validatePdf(prefix);
                case DOCX -> validateOoxml(file, "word/");
                case XLSX -> validateOoxml(file, "xl/");
                case PPTX -> validateOoxml(file, "ppt/");
                case MP4 -> validateIsoBaseMedia(prefix, "video/mp4", false);
                case WEBM -> validateWebm(prefix);
                case MOV -> validateIsoBaseMedia(prefix, "video/quicktime", true);
            };
            return detected;
        } catch (IOException exception) {
            throw new EvidenceMediaValidationException("Unable to inspect evidence file content.", exception);
        }
    }

    private String validateJpeg(byte[] bytes) {
        require(startsAt(bytes, 0, 0xff, 0xd8, 0xff), "Evidence file signature does not match JPEG.");
        return "image/jpeg";
    }

    private String validatePng(byte[] bytes) {
        require(startsAt(bytes, 0, 0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a),
                "Evidence file signature does not match PNG.");
        return "image/png";
    }

    private String validateWebp(byte[] bytes) {
        require(startsAt(bytes, 0, 'R', 'I', 'F', 'F') && startsAt(bytes, 8, 'W', 'E', 'B', 'P'),
                "Evidence file signature does not match WebP.");
        return "image/webp";
    }

    private String validatePdf(byte[] bytes) {
        require(startsAt(bytes, 0, '%', 'P', 'D', 'F', '-'), "Evidence file signature does not match PDF.");
        return "application/pdf";
    }

    private String validateOoxml(Path file, String requiredPrefix) throws IOException {
        try (var zip = new ZipFile(file.toFile())) {
            require(zip.getEntry("[Content_Types].xml") != null && zip.stream().anyMatch(entry -> entry.getName().startsWith(requiredPrefix)),
                    "Evidence file signature does not match Office Open XML.");
            var entries = zip.entries();
            while (entries.hasMoreElements()) {
                var entry = entries.nextElement();
                var name = entry.getName().toLowerCase(Locale.ROOT);
                if (name.endsWith("vbaproject.bin")) {
                    throw new EvidenceMediaValidationException("Office Open XML evidence cannot contain macro content.");
                }
                if (name.endsWith(".rels") && containsMacroReference(zip, entry)) {
                    throw new EvidenceMediaValidationException("Office Open XML evidence cannot contain macro relationships.");
                }
            }
        }
        return switch (requiredPrefix) {
            case "word/" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
            case "xl/" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
            case "ppt/" -> "application/vnd.openxmlformats-officedocument.presentationml.presentation";
            default -> throw new IllegalStateException("Unsupported Office Open XML prefix.");
        };
    }

    private boolean containsMacroReference(ZipFile zip, ZipEntry entry) throws IOException {
        try (var input = zip.getInputStream(entry)) {
            return new String(input.readAllBytes(), StandardCharsets.UTF_8).toLowerCase(Locale.ROOT)
                    .contains("macro");
        }
    }

    private String validateIsoBaseMedia(byte[] bytes, String mimeType, boolean quickTime) {
        require(bytes.length >= 12 && startsAt(bytes, 4, 'f', 't', 'y', 'p'),
                "Evidence file signature does not match video container.");
        if (quickTime) {
            require(startsAt(bytes, 8, 'q', 't', ' ', ' '), "Evidence file signature does not match MOV.");
        }
        return mimeType;
    }

    private String validateWebm(byte[] bytes) {
        require(startsAt(bytes, 0, 0x1a, 0x45, 0xdf, 0xa3), "Evidence file signature does not match WebM.");
        return "video/webm";
    }

    private boolean startsAt(byte[] bytes, int offset, int... expected) {
        if (bytes.length < offset + expected.length) {
            return false;
        }
        for (var index = 0; index < expected.length; index++) {
            if ((bytes[offset + index] & 0xff) != (expected[index] & 0xff)) {
                return false;
            }
        }
        return true;
    }

    private void require(boolean valid, String message) {
        if (!valid) {
            throw new EvidenceMediaValidationException(message);
        }
    }
}
