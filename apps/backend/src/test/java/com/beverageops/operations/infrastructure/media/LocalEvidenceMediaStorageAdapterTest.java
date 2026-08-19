package com.beverageops.operations.infrastructure.media;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.List;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import com.beverageops.operations.application.usecase.MediaStorageProperties;
import com.beverageops.operations.domain.port.EvidenceMediaStoragePort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class LocalEvidenceMediaStorageAdapterTest {

    @TempDir
    Path mediaRoot;

    @Test
    void publishesEveryAllowedMediaTypeToAServerGeneratedPath() throws Exception {
        var adapter = adapter();
        var evidenceId = UUID.randomUUID();
        var files = List.of(
                file("close.jpg", "image/jpeg", jpeg()),
                file("close.png", "image/png", png()),
                file("close.webp", "image/webp", webp()),
                file("close.pdf", "application/pdf", pdf()),
                file("close.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", docx()),
                file("close.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", xlsx()),
                file("close.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", pptx()),
                file("close.mp4", "video/mp4", mp4()),
                file("close.webm", "video/webm", webm()),
                file("close.mov", "video/quicktime", mov()));

        for (var file : files) {
            var stored = adapter.stageAndPublish(new EvidenceMediaStoragePort.Upload(evidenceId, 3L, file.filename(),
                    file.mimeType(), new ByteArrayInputStream(file.content())));

            assertThat(stored.relativePath()).matches("evidence/" + evidenceId + "/v3/[0-9a-f-]+\\."
                    + file.filename().substring(file.filename().lastIndexOf('.') + 1));
            assertThat(stored.detectedMimeType()).isEqualTo(file.mimeType());
            assertThat(stored.byteSize()).isEqualTo(file.content().length);
            assertThat(stored.sha256()).isEqualTo(sha256(file.content()));
            assertThat(Files.readAllBytes(mediaRoot.resolve(stored.relativePath()))).isEqualTo(file.content());
        }
        assertNoFiles(mediaRoot.resolve(".staging"));
    }

    @Test
    void rejectsUnsafeNamesAndUnsupportedOfficeFormatsWithoutLeavingFiles() {
        var adapter = adapter();
        var evidenceId = UUID.randomUUID();

        for (var rejected : List.of("../close.pdf", "close.doc", "close.xls", "close.ppt", "close.docm", "close.xlsm", "close.pptm")) {
            assertThatThrownBy(() -> adapter.stageAndPublish(new EvidenceMediaStoragePort.Upload(evidenceId, 1L, rejected,
                    "application/pdf", new ByteArrayInputStream(pdf()))))
                    .isInstanceOf(EvidenceMediaValidationException.class);
        }
        assertNoFiles(mediaRoot);
    }

    @Test
    void rejectsMimeAndSignatureMismatchWithoutLeavingFiles() {
        var adapter = adapter();

        assertThatThrownBy(() -> adapter.stageAndPublish(new EvidenceMediaStoragePort.Upload(UUID.randomUUID(), 1L, "close.png",
                "image/png", new ByteArrayInputStream(pdf()))))
                .isInstanceOf(EvidenceMediaValidationException.class)
                .hasMessageContaining("signature");

        assertNoFiles(mediaRoot);
    }

    @Test
    void rejectsOoxmlMacroMembersAndMacroRelationshipsWithoutLeavingFiles() {
        var adapter = adapter();

        assertThatThrownBy(() -> adapter.stageAndPublish(new EvidenceMediaStoragePort.Upload(UUID.randomUUID(), 1L, "close.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ooxml("word/document.xml",
                        "word/vbaProject.bin"))))
                .isInstanceOf(EvidenceMediaValidationException.class)
                .hasMessageContaining("macro");
        assertThatThrownBy(() -> adapter.stageAndPublish(new EvidenceMediaStoragePort.Upload(UUID.randomUUID(), 1L, "close.docx",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ooxml("word/document.xml",
                        "word/_rels/document.xml.rels"))))
                .isInstanceOf(EvidenceMediaValidationException.class)
                .hasMessageContaining("macro");

        assertNoFiles(mediaRoot);
    }

    @Test
    void rejectsFilesOverTheConfiguredTypeLimitWithoutLeavingFiles() {
        var adapter = adapter();
        var content = new OversizedPdfInputStream(50L * 1024 * 1024 + 1);

        assertThatThrownBy(() -> adapter.stageAndPublish(new EvidenceMediaStoragePort.Upload(UUID.randomUUID(), 1L, "close.pdf",
                "application/pdf", content)))
                .isInstanceOf(EvidenceMediaValidationException.class)
                .hasMessageContaining("50 MB");

        assertNoFiles(mediaRoot);
    }

    private LocalEvidenceMediaStorageAdapter adapter() {
        return new LocalEvidenceMediaStorageAdapter(new MediaStorageProperties(mediaRoot, ".staging", "0 0 2 * * *", false));
    }

    private EvidenceFile file(String filename, String mimeType, byte[] content) {
        return new EvidenceFile(filename, mimeType, content);
    }

    private byte[] jpeg() {
        return new byte[] {(byte) 0xff, (byte) 0xd8, (byte) 0xff, (byte) 0xe0, 0, 16, 'J', 'F', 'I', 'F', 0, 1, 1, 0,
                0, 1, 0, 1, 0, 0, (byte) 0xff, (byte) 0xd9};
    }

    private byte[] png() {
        return new byte[] {(byte) 0x89, 'P', 'N', 'G', 13, 10, 26, 10, 0, 0, 0, 0};
    }

    private byte[] webp() {
        return new byte[] {'R', 'I', 'F', 'F', 4, 0, 0, 0, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' '};
    }

    private byte[] pdf() {
        return "%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF".getBytes(StandardCharsets.US_ASCII);
    }

    private byte[] docx() {
        return ooxmlBytes("word/document.xml");
    }

    private byte[] xlsx() {
        return ooxmlBytes("xl/workbook.xml");
    }

    private byte[] pptx() {
        return ooxmlBytes("ppt/presentation.xml");
    }

    private InputStream ooxml(String... entries) {
        return new ByteArrayInputStream(ooxmlBytes(entries));
    }

    private byte[] ooxmlBytes(String... entries) {
        try (var bytes = new ByteArrayOutputStream(); var zip = new ZipOutputStream(bytes)) {
            zip.putNextEntry(new ZipEntry("[Content_Types].xml"));
            zip.write("<Types/>".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            for (var entry : entries) {
                zip.putNextEntry(new ZipEntry(entry));
                var content = entry.endsWith(".rels") ? "macroEnabled vbaProject" : "<xml/>";
                zip.write(content.getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
            zip.finish();
            return bytes.toByteArray();
        } catch (IOException exception) {
            throw new AssertionError(exception);
        }
    }

    private byte[] mp4() {
        return new byte[] {0, 0, 0, 20, 'f', 't', 'y', 'p', 'i', 's', 'o', 'm', 0, 0, 0, 0, 'i', 's', 'o', 'm'};
    }

    private byte[] webm() {
        return new byte[] {0x1a, 0x45, (byte) 0xdf, (byte) 0xa3, (byte) 0x9f, 0x42, (byte) 0x86, (byte) 0x81, 1};
    }

    private byte[] mov() {
        return new byte[] {0, 0, 0, 20, 'f', 't', 'y', 'p', 'q', 't', ' ', ' ', 0, 0, 0, 0, 'q', 't', ' ', ' '};
    }

    private String sha256(byte[] content) throws Exception {
        return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
    }

    private void assertNoFiles(Path root) {
        if (!Files.exists(root)) {
            return;
        }
        try (var paths = Files.walk(root)) {
            assertThat(paths.filter(Files::isRegularFile)).isEmpty();
        } catch (IOException exception) {
            throw new AssertionError(exception);
        }
    }

    private record EvidenceFile(String filename, String mimeType, byte[] content) {
    }

    private final class OversizedPdfInputStream extends InputStream {

        private long remaining;
        private int prefixIndex;
        private final byte[] prefix = pdf();

        private OversizedPdfInputStream(long remaining) {
            this.remaining = remaining;
        }

        @Override
        public int read() {
            if (remaining-- <= 0) {
                return -1;
            }
            if (prefixIndex < prefix.length) {
                return prefix[prefixIndex++];
            }
            return 'x';
        }
    }
}
