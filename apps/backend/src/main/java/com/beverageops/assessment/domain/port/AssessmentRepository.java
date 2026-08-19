package com.beverageops.assessment.domain.port;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.assessment.domain.model.RubricStatus;
import com.beverageops.assessment.domain.model.AssessmentRecordStatus;
import com.beverageops.assessment.domain.model.PortfolioStatus;
import com.beverageops.assessment.domain.model.ResultStatus;

public interface AssessmentRepository {

    boolean termExists(UUID termId);

    boolean isActiveTermMember(UUID termId, UUID accountId);

    boolean teamExistsInTerm(UUID termId, UUID teamId);

    boolean accountHasRole(UUID accountId, String role);

    RubricVersion createRubric(UUID id, UUID termId, String name, BigDecimal passScore, OffsetDateTime effectiveAt,
                               List<RubricDimension> dimensions, UUID actorId);

    RubricVersion deriveRubric(UUID id, RubricVersion publishedRubric, OffsetDateTime effectiveAt, UUID actorId);

    Optional<RubricVersion> lockRubric(UUID rubricId);

    Optional<RubricVersion> findRubric(UUID rubricId);

    List<RubricVersion> findRubrics(UUID termId);

    RubricVersion updateRubric(UUID rubricId, String name, BigDecimal passScore,
                               List<RubricDimension> dimensions, long expectedVersion);

    RubricVersion publishRubric(UUID rubricId, UUID actorId, long expectedVersion);

    Portfolio createPortfolio(UUID id, UUID termId, String scopeType, UUID studentAccountId, UUID teamId, UUID actorId);

    Optional<Portfolio> lockPortfolio(UUID portfolioId);

    Optional<Portfolio> findPortfolio(UUID portfolioId);

    List<Portfolio> findPortfolios(UUID termId);

    List<Portfolio> findPublishedPortfoliosForAccount(UUID accountId);

    List<PortfolioSourceSnapshot> collectPortfolioSources(Portfolio portfolio);

    Portfolio generatePortfolio(UUID portfolioId, UUID actorId, String manifestJson,
                                List<PortfolioSourceSnapshot> sources, long expectedVersion);

    Portfolio publishPortfolio(UUID portfolioId, UUID actorId, long expectedVersion);

    AssessmentRecord createAssessmentRecord(UUID id, UUID resultId, Portfolio portfolio, RubricVersion rubric,
                                            List<AssessorGrant> grants, UUID actorId);

    Optional<AssessmentRecord> lockAssessmentRecord(UUID assessmentRecordId);

    Optional<AssessmentRecord> findAssessmentRecord(UUID assessmentRecordId);

    List<AssessmentRecord> findAssessmentRecords(UUID termId);

    AssessmentScore addScore(UUID id, UUID assessmentRecordId, UUID dimensionId, UUID scorerAccountId,
                             String sourceRole, BigDecimal score, String comment);

    AssessmentRecord markAssessorSubmitted(UUID assessmentRecordId, UUID assessorAccountId, String sourceRole,
                                           AssessmentRecordStatus status);

    Optional<AssessmentResult> lockResult(UUID resultId);

    Optional<AssessmentResult> findResult(UUID resultId);

    boolean isCurrentPublishedResult(AssessmentResult result);

    List<AssessmentResult> findResults(UUID termId);

    List<AssessmentResult> findCurrentPublishedResultsForAccount(UUID accountId);

    AssessmentResult publishResult(UUID resultId, UUID actorId, BigDecimal suggestedScore,
                                   BigDecimal finalScore, long expectedVersion);

    AssessmentResult createCorrection(UUID id, AssessmentResult previous, UUID actorId,
                                      BigDecimal finalScore, String reason);

    void appendAudit(String eventType, String resourceType, UUID resourceId, UUID actorId,
                     Long previousVersion, Long newVersion);

    record RubricVersion(UUID id, UUID rootRubricId, int rubricRevision, UUID termId, String name, BigDecimal passScore,
                         OffsetDateTime effectiveAt, RubricStatus status,
                         long version, UUID createdByAccountId, UUID publishedByAccountId,
                         OffsetDateTime publishedAt, OffsetDateTime createdAt, OffsetDateTime updatedAt,
                         List<RubricDimension> dimensions) {
    }

    record RubricDimension(UUID id, String code, String name, BigDecimal weight, BigDecimal maxScore,
                           int displayOrder, List<String> allowedScorerRoles) {
    }

    record Portfolio(UUID id, UUID termId, String scopeType, UUID studentAccountId, UUID teamId,
                     PortfolioStatus status, String manifestJson, long version, UUID createdByAccountId,
                     UUID generatedByAccountId, OffsetDateTime generatedAt, UUID publishedByAccountId,
                     OffsetDateTime publishedAt, OffsetDateTime createdAt, OffsetDateTime updatedAt,
                     List<PortfolioSourceSnapshot> sources) {
    }

    record PortfolioSourceSnapshot(UUID id, String sourceType, UUID sourceId, Long sourceVersion, String snapshotJson) {
    }

    record AssessorGrant(UUID id, UUID assessorAccountId, String sourceRole, OffsetDateTime submittedAt) {
    }

    record AssessmentScore(UUID id, UUID dimensionId, UUID scorerAccountId, String sourceRole,
                           BigDecimal score, String comment, OffsetDateTime createdAt) {
    }

    record AssessmentRecord(UUID id, UUID termId, UUID portfolioId, UUID rubricVersionId,
                            AssessmentRecordStatus status, long version, UUID createdByAccountId,
                            OffsetDateTime createdAt, OffsetDateTime updatedAt, List<AssessorGrant> grants,
                            List<AssessmentScore> scores, UUID resultId) {
    }

    record AssessmentResult(UUID id, UUID rootResultId, UUID previousResultId, UUID assessmentRecordId,
                            UUID termId, UUID portfolioId, int resultRevision, BigDecimal suggestedScore,
                            BigDecimal finalScore, ResultStatus status, String correctionReason, long version,
                            UUID publishedByAccountId, OffsetDateTime publishedAt, OffsetDateTime createdAt,
                            OffsetDateTime updatedAt) {
    }
}
