package com.beverageops.operations.adapter.in.web;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import com.beverageops.support.PostgresIntegrationTestBase;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.boot.autoconfigure.web.servlet.MultipartProperties;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class EvidenceMediaIntegrationTest extends PostgresIntegrationTestBase {

    private static final UUID P1_ID = UUID.fromString("71000000-0000-0000-0000-000000000001");
    private static final UUID P2_ID = UUID.fromString("71000000-0000-0000-0000-000000000002");
    private static final UUID P3_ID = UUID.fromString("71000000-0000-0000-0000-000000000003");
    private static final UUID OTHER_P3_ID = UUID.fromString("71000000-0000-0000-0000-000000000004");

    @DynamicPropertySource
    static void mediaProperties(DynamicPropertyRegistry registry) {
        registry.add("beverage-ops.media.root", () -> System.getProperty("java.io.tmpdir") + "/beverage-ops-media-tests");
    }

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private MultipartProperties multipartProperties;

    @BeforeEach
    void createActors() {
        createActor(P1_ID, "MEDIA-P1", "P1");
        createActor(P2_ID, "MEDIA-P2", "P2");
        createActor(P3_ID, "MEDIA-P3", "P3");
        createActor(OTHER_P3_ID, "MEDIA-P3-OTHER", "P3");
    }

    @Test
    void uploadsListsAndDownloadsAnAuthorizedPdfWithoutLeakingAbsolutePaths() throws Exception {
        var evidenceId = objectReferenceEvidence();

        mockMvc.perform(multipart("/api/v1/evidence/{evidenceId}/files", evidenceId)
                        .file(pdfFile("close.pdf"))
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("CURRENT"))
                .andExpect(jsonPath("$.relativePath").value(org.hamcrest.Matchers.matchesPattern(
                        "evidence/" + evidenceId + "/v1/[0-9a-f-]+\\.pdf")));

        var relativePath = jdbcTemplate.queryForObject("""
                select relative_path from ops_evidence_file_versions where evidence_id = ? and status = 'CURRENT'
                """, String.class, UUID.fromString(evidenceId));
        assertThat(relativePath).startsWith("evidence/").doesNotContain("/tmp/").doesNotContain("/data/");

        mockMvc.perform(get("/api/v1/evidence/{evidenceId}/files", evidenceId)
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].status").value("CURRENT"));
        mockMvc.perform(get("/api/v1/evidence/{evidenceId}/files/current", evidenceId)
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        org.hamcrest.Matchers.allOf(org.hamcrest.Matchers.startsWith("attachment;"),
                                org.hamcrest.Matchers.containsString("filename*=UTF-8''close.pdf"))))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(content().bytes(pdf()));
    }

    @Test
    void configuresMultipartLimitsForTheLargestAllowedVideo() {
        assertThat(multipartProperties.getMaxFileSize().toBytes()).isEqualTo(500L * 1024 * 1024);
        assertThat(multipartProperties.getMaxRequestSize().toBytes()).isEqualTo(501L * 1024 * 1024);
    }

    @Test
    void encodesNonAsciiDownloadFilenamesInContentDisposition() throws Exception {
        var evidenceId = objectReferenceEvidence();
        mockMvc.perform(multipart("/api/v1/evidence/{evidenceId}/files", evidenceId)
                        .file(pdfFile("班次凭证.pdf"))
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/evidence/{evidenceId}/files/current", evidenceId)
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_DISPOSITION,
                        org.hamcrest.Matchers.containsString("filename*=UTF-8''")));
    }

    @Test
    void rejectsOutOfScopeP3ForEveryMediaOperation() throws Exception {
        var evidenceId = objectReferenceEvidence();

        mockMvc.perform(multipart("/api/v1/evidence/{evidenceId}/files", evidenceId)
                        .file(pdfFile("close.pdf"))
                        .with(user(OTHER_P3_ID.toString()).roles("P3")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/evidence/{evidenceId}/files", evidenceId)
                        .with(user(OTHER_P3_ID.toString()).roles("P3")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/evidence/{evidenceId}/files/current", evidenceId)
                        .with(user(OTHER_P3_ID.toString()).roles("P3")))
                .andExpect(status().isForbidden());
    }

    @Test
    void supportsSingleByteRangeForAuthorizedVideos() throws Exception {
        var evidenceId = objectReferenceEvidence();
        var video = mp4(2048);
        mockMvc.perform(multipart("/api/v1/evidence/{evidenceId}/files", evidenceId)
                        .file(new MockMultipartFile("file", "close.mp4", "video/mp4", video))
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isCreated());

        mockMvc.perform(get("/api/v1/evidence/{evidenceId}/files/current", evidenceId)
                        .header(HttpHeaders.RANGE, "bytes=0-1023")
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isPartialContent())
                .andExpect(header().string(HttpHeaders.ACCEPT_RANGES, "bytes"))
                .andExpect(header().string(HttpHeaders.CONTENT_RANGE, "bytes 0-1023/2048"))
                .andExpect(content().bytes(java.util.Arrays.copyOfRange(video, 0, 1024)));

        mockMvc.perform(get("/api/v1/evidence/{evidenceId}/files/current", evidenceId)
                        .header(HttpHeaders.RANGE, "bytes=2048-2050")
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isRequestedRangeNotSatisfiable());
    }

    @Test
    void replacementAndWithdrawalRequireReasonsAndKeepAValidCurrentVersion() throws Exception {
        var evidenceId = objectReferenceEvidence();
        mockMvc.perform(multipart("/api/v1/evidence/{evidenceId}/files", evidenceId)
                        .file(pdfFile("close.pdf"))
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isCreated());

        mockMvc.perform(multipart("/api/v1/evidence/{evidenceId}/files/replace", evidenceId)
                        .file(pdfFile("clearer.pdf"))
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_FAILED"));
        mockMvc.perform(multipart("/api/v1/evidence/{evidenceId}/files/replace", evidenceId)
                        .file(pdfFile("clearer.pdf"))
                        .param("reason", "重新扫描，图像更清晰")
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fileVersion").value(2));
        mockMvc.perform(multipart("/api/v1/evidence/{evidenceId}/files/withdraw", evidenceId)
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isBadRequest());
        mockMvc.perform(multipart("/api/v1/evidence/{evidenceId}/files/withdraw", evidenceId)
                        .param("reason", "凭证上传错误")
                        .with(user(P3_ID.toString()).roles("P3")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("WITHDRAWN"));
    }

    private String objectReferenceEvidence() throws Exception {
        var termId = UUID.randomUUID();
        var storeId = UUID.randomUUID();
        var templateId = UUID.randomUUID();
        var dayId = UUID.randomUUID();
        var shiftId = UUID.randomUUID();
        var assignmentId = UUID.randomUUID();
        var componentId = UUID.randomUUID();
        var milestoneId = UUID.randomUUID();
        var evidenceId = UUID.randomUUID();
        jdbcTemplate.update("""
                insert into gov_terms (id, code, name, start_date, end_date, status, created_by_account_id)
                values (?, ?, 'Term', current_date, current_date + 120, 'PUBLISHED', ?)
                """, termId, "MEDIA-T" + termId.toString().substring(0, 6), P1_ID);
        jdbcTemplate.update("""
                insert into gov_stores (id, code, name, status, created_by_account_id)
                values (?, ?, 'Store', 'ACTIVE', ?)
                """, storeId, "MEDIA-S" + storeId.toString().substring(0, 6), P1_ID);
        jdbcTemplate.update("""
                insert into gov_template_versions
                    (id, term_id, store_id, template_code, template_revision, name, status, effective_from, configuration,
                     created_by_account_id)
                values (?, ?, ?, 'MEDIA', 1, 'Template', 'PUBLISHED', current_date, '{}'::jsonb, ?)
                """, templateId, termId, storeId, P1_ID);
        jdbcTemplate.update("""
                insert into ops_operating_days
                    (id, term_id, store_id, operating_date, template_version_id, template_revision, template_snapshot, status,
                     created_by_account_id)
                values (?, ?, ?, current_date, ?, 1, '{}'::jsonb, 'IN_PROGRESS', ?)
                """, dayId, termId, storeId, templateId, P1_ID);
        jdbcTemplate.update("""
                insert into ops_shifts (id, operating_day_id, code, name, starts_at, ends_at, status, created_by_account_id)
                values (?, ?, 'M1', 'Media shift', current_timestamp, current_timestamp + interval '1 hour', 'IN_PROGRESS', ?)
                """, shiftId, dayId, P1_ID);
        jdbcTemplate.update("""
                insert into ops_shift_assignments (id, shift_id, account_id, role_code, status, assigned_by_account_id)
                values (?, ?, ?, 'BARISTA', 'ASSIGNED', ?)
                """, assignmentId, shiftId, P3_ID, P1_ID);
        jdbcTemplate.update("""
                insert into gov_template_components
                    (id, template_version_id, component_type, code, name, configuration, created_by_account_id)
                values (?, ?, 'MILESTONE', 'MEDIA', 'Media', '{}'::jsonb, ?)
                """, componentId, templateId, P1_ID);
        jdbcTemplate.update("""
                insert into ops_milestone_submissions
                    (id, shift_id, source_template_component_id, code, name, definition_snapshot, required, evidence_required, status)
                values (?, ?, ?, 'MEDIA', 'Media', '{}'::jsonb, false, false, 'PENDING')
                """, milestoneId, shiftId, componentId);
        jdbcTemplate.update("""
                insert into ops_evidence
                    (id, shift_id, milestone_submission_id, kind, reference_value, occurred_at, submitted_by_account_id)
                values (?, ?, ?, 'OBJECT_REFERENCE', 'media-pending', current_timestamp, ?)
                """, evidenceId, shiftId, milestoneId, P3_ID);
        return evidenceId.toString();
    }

    private MockMultipartFile pdfFile(String filename) {
        return new MockMultipartFile("file", filename, "application/pdf", pdf());
    }

    private byte[] pdf() {
        return "%PDF-1.7\n%%EOF".getBytes(StandardCharsets.US_ASCII);
    }

    private byte[] mp4(int length) {
        var bytes = new byte[length];
        bytes[3] = 20;
        bytes[4] = 'f';
        bytes[5] = 't';
        bytes[6] = 'y';
        bytes[7] = 'p';
        bytes[8] = 'i';
        bytes[9] = 's';
        bytes[10] = 'o';
        bytes[11] = 'm';
        return bytes;
    }

    private JsonNode json(org.springframework.test.web.servlet.MvcResult result) throws Exception {
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private void createActor(UUID id, String loginId, String role) {
        jdbcTemplate.update("""
                insert into iam_accounts (id, login_id, display_name, status, password_hash)
                values (?, ?, ?, 'ACTIVE', '$argon2id$placeholder')
                """, id, loginId, loginId);
        jdbcTemplate.update("""
                insert into iam_role_assignments (id, account_id, role_code)
                values (?, ?, ?)
                """, UUID.randomUUID(), id, role);
    }
}
