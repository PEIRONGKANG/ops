package com.beverageops.assessment.application.usecase;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import com.beverageops.assessment.domain.model.RubricStatus;
import com.beverageops.assessment.domain.model.AssessmentRecordStatus;
import com.beverageops.assessment.domain.model.PortfolioStatus;
import com.beverageops.assessment.domain.model.ResultStatus;
import com.beverageops.assessment.domain.port.AssessmentRepository;
import com.beverageops.governance.application.usecase.VersionConflictException;
import com.beverageops.identityaccess.application.usecase.ForbiddenException;
import com.beverageops.identityaccess.application.usecase.ResourceNotFoundException;
import com.beverageops.shared.notification.application.event.OperationalNotificationRequested;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.ApplicationEventPublisher;

@Service
public class AssessmentUseCase {

    private static final Set<String> SCORER_ROLES = Set.of("P2", "T1");

    private final AssessmentRepository assessment;
    private final ObjectMapper objectMapper;
    private final ApplicationEventPublisher events;

    public AssessmentUseCase(AssessmentRepository assessment, ObjectMapper objectMapper, ApplicationEventPublisher events) {
        this.assessment = assessment;
        this.objectMapper = objectMapper;
        this.events = events;
    }

    @Transactional
    public AssessmentRepository.RubricVersion createRubric(CreateRubricCommand command) {
        requireP1(command.p1());
        if (!assessment.termExists(command.termId())) {
            throw new ResourceNotFoundException("Term not found.");
        }
        var dimensions = dimensions(command.dimensions());
        var rubric = assessment.createRubric(UUID.randomUUID(), command.termId(), text(command.name(), "Name", 200),
                score(command.passScore(), "Pass score", true), effectiveAt(command.effectiveAt()), dimensions, command.actorId());
        audit("RUBRIC_VERSION_CREATED", rubric, command.actorId(), null, rubric.version());
        return rubric;
    }

    @Transactional
    public AssessmentRepository.RubricVersion deriveRubric(UUID rubricId, DeriveRubricCommand command) {
        requireP1(command.p1());
        var current = rubric(rubricId);
        if (current.status() != RubricStatus.PUBLISHED) {
            throw new IllegalStateException("Only a published rubric can be used to derive a new revision.");
        }
        var derived = assessment.deriveRubric(UUID.randomUUID(), current, effectiveAt(command.effectiveAt()), command.actorId());
        audit("RUBRIC_VERSION_DERIVED", derived, command.actorId(), null, derived.version());
        return derived;
    }

    @Transactional
    public AssessmentRepository.RubricVersion updateRubric(UUID rubricId, UpdateRubricCommand command) {
        requireP1(command.p1());
        var current = rubric(rubricId);
        version(current.version(), command.version());
        if (current.status() != RubricStatus.DRAFT) {
            throw new IllegalStateException("A published rubric cannot be changed in place.");
        }
        var updated = update(() -> assessment.updateRubric(rubricId, text(command.name(), "Name", 200),
                score(command.passScore(), "Pass score", true), dimensions(command.dimensions()), command.version()));
        audit("RUBRIC_VERSION_UPDATED", updated, command.actorId(), current.version(), updated.version());
        return updated;
    }

    @Transactional
    public AssessmentRepository.RubricVersion publishRubric(UUID rubricId, VersionCommand command) {
        requireP1(command.p1());
        var current = rubric(rubricId);
        version(current.version(), command.version());
        if (current.status() != RubricStatus.DRAFT) {
            throw new IllegalStateException("Only a draft rubric can be published.");
        }
        var published = update(() -> assessment.publishRubric(rubricId, command.actorId(), command.version()));
        audit("RUBRIC_VERSION_PUBLISHED", published, command.actorId(), current.version(), published.version());
        return published;
    }

    @Transactional(readOnly = true)
    public List<AssessmentRepository.RubricVersion> rubrics(UUID termId, ReadCommand command) {
        requireP1(command.p1());
        if (!assessment.termExists(termId)) {
            throw new ResourceNotFoundException("Term not found.");
        }
        return assessment.findRubrics(termId);
    }

    @Transactional
    public AssessmentRepository.Portfolio createPortfolio(CreatePortfolioCommand command) {
        requireP1(command.p1());
        if (!assessment.termExists(command.termId())) {
            throw new ResourceNotFoundException("Term not found.");
        }
        var scopeType = portfolioScopeType(command.scopeType());
        if ("STUDENT".equals(scopeType)) {
            if (command.studentAccountId() == null || command.teamId() != null
                    || !assessment.isActiveTermMember(command.termId(), command.studentAccountId())) {
                throw new IllegalArgumentException("A student portfolio requires one active term student.");
            }
        } else if (command.teamId() == null || command.studentAccountId() != null
                || !assessment.teamExistsInTerm(command.termId(), command.teamId())) {
            throw new IllegalArgumentException("A team portfolio requires one active team in the term.");
        }
        var portfolio = assessment.createPortfolio(UUID.randomUUID(), command.termId(), scopeType,
                command.studentAccountId(), command.teamId(), command.actorId());
        audit("PORTFOLIO_CREATED", "PORTFOLIO", portfolio.id(), command.actorId(), null, portfolio.version());
        return portfolio;
    }

    @Transactional
    public AssessmentRepository.Portfolio generatePortfolio(UUID portfolioId, VersionCommand command) {
        requireP1(command.p1());
        var current = portfolio(portfolioId);
        version(current.version(), command.version());
        if (current.status() != PortfolioStatus.DRAFT) {
            throw new IllegalStateException("Only a draft portfolio can be generated.");
        }
        var sources = assessment.collectPortfolioSources(current);
        var manifest = objectMapper.createObjectNode();
        manifest.put("portfolioId", current.id().toString());
        manifest.put("termId", current.termId().toString());
        manifest.put("scopeType", current.scopeType());
        if (current.studentAccountId() != null) manifest.put("studentAccountId", current.studentAccountId().toString());
        if (current.teamId() != null) manifest.put("teamId", current.teamId().toString());
        var sourceNodes = manifest.putArray("sources");
        for (var source : sources) {
            var node = sourceNodes.addObject();
            node.put("sourceType", source.sourceType());
            node.put("sourceId", source.sourceId().toString());
            if (source.sourceVersion() != null) node.put("sourceVersion", source.sourceVersion());
            try {
                node.set("snapshot", objectMapper.readTree(source.snapshotJson()));
            } catch (Exception exception) {
                throw new IllegalStateException("Portfolio source snapshot is invalid.", exception);
            }
        }
        var generated = update(() -> assessment.generatePortfolio(portfolioId, command.actorId(), manifest.toString(),
                sources, command.version()));
        audit("PORTFOLIO_GENERATED", "PORTFOLIO", generated.id(), command.actorId(), current.version(), generated.version());
        return generated;
    }

    @Transactional
    public AssessmentRepository.Portfolio publishPortfolio(UUID portfolioId, VersionCommand command) {
        requireP1(command.p1());
        var current = portfolio(portfolioId);
        version(current.version(), command.version());
        if (current.status() != PortfolioStatus.GENERATED) {
            throw new IllegalStateException("Only a generated portfolio can be published.");
        }
        var published = update(() -> assessment.publishPortfolio(portfolioId, command.actorId(), command.version()));
        audit("PORTFOLIO_PUBLISHED", "PORTFOLIO", published.id(), command.actorId(), current.version(), published.version());
        return published;
    }

    @Transactional(readOnly = true)
    public List<AssessmentRepository.Portfolio> portfolios(UUID termId, ReadCommand command) {
        requireP1(command.p1());
        if (!assessment.termExists(termId)) throw new ResourceNotFoundException("Term not found.");
        return assessment.findPortfolios(termId);
    }

    @Transactional(readOnly = true)
    public List<AssessmentRepository.Portfolio> myPublishedPortfolios(OwnReadCommand command) {
        requireP3(command.p3());
        return assessment.findPublishedPortfoliosForAccount(command.actorId());
    }

    @Transactional
    public String internalExportManifest(UUID portfolioId, P1ActorCommand command) {
        requireP1(command.p1());
        var current = portfolio(portfolioId);
        if (current.status() == PortfolioStatus.DRAFT) {
            throw new IllegalStateException("Only a generated or published portfolio has an export manifest.");
        }
        audit("PORTFOLIO_EXPORT_MANIFEST_VIEWED", "PORTFOLIO", current.id(), command.actorId(),
                current.version(), current.version());
        return current.manifestJson();
    }

    @Transactional
    public AssessmentRepository.AssessmentRecord createAssessmentRecord(CreateAssessmentRecordCommand command) {
        requireP1(command.p1());
        var portfolio = portfolio(command.portfolioId());
        if (portfolio.status() != PortfolioStatus.PUBLISHED) {
            throw new IllegalStateException("An assessment requires a published portfolio.");
        }
        var rubric = rubric(command.rubricVersionId());
        if (rubric.status() != RubricStatus.PUBLISHED || !rubric.termId().equals(portfolio.termId())) {
            throw new IllegalStateException("An assessment requires a published rubric from the portfolio term.");
        }
        var grants = grants(command.assessorGrants(), rubric, portfolio.termId());
        var record = assessment.createAssessmentRecord(UUID.randomUUID(), UUID.randomUUID(), portfolio, rubric, grants, command.actorId());
        audit("ASSESSMENT_RECORD_CREATED", "ASSESSMENT_RECORD", record.id(), command.actorId(), null, record.version());
        return record;
    }

    @Transactional
    public AssessmentRepository.AssessmentScore score(UUID assessmentRecordId, ScoreCommand command) {
        var record = assessmentRecord(assessmentRecordId);
        if (record.status() != AssessmentRecordStatus.DRAFT) {
            throw new IllegalStateException("Scores cannot be changed after an assessment is ready for publication.");
        }
        var sourceRole = grantedSourceRole(record, command.actorId(), command.p2(), command.t1());
        requireActiveMember(record.termId(), command.actorId());
        var rubric = rubric(record.rubricVersionId());
        var dimension = rubric.dimensions().stream().filter(item -> item.id().equals(command.dimensionId())).findFirst()
                .orElseThrow(() -> new ForbiddenException("The scoring dimension is outside this assessment rubric."));
        if (!dimension.allowedScorerRoles().contains(sourceRole)) {
            throw new ForbiddenException("The scorer is not authorized for this rubric dimension.");
        }
        if (record.scores().stream().anyMatch(score -> score.dimensionId().equals(command.dimensionId())
                && score.scorerAccountId().equals(command.actorId()) && score.sourceRole().equals(sourceRole))) {
            throw new IllegalStateException("A score for this dimension and scorer already exists.");
        }
        var value = assessmentScore(command.score(), dimension.maxScore());
        var scored = assessment.addScore(UUID.randomUUID(), record.id(), dimension.id(), command.actorId(), sourceRole,
                value, text(command.comment(), "Score comment", 2000));
        audit("ASSESSMENT_SCORE_RECORDED", "ASSESSMENT_SCORE", scored.id(), command.actorId(), null, null);
        return scored;
    }

    @Transactional
    public AssessmentRepository.AssessmentRecord submitAssessment(UUID assessmentRecordId, ActorCommand command) {
        var record = assessmentRecord(assessmentRecordId);
        if (record.status() != AssessmentRecordStatus.DRAFT) {
            throw new IllegalStateException("The assessment is already ready for publication.");
        }
        var sourceRole = grantedSourceRole(record, command.actorId(), command.p2(), command.t1());
        requireActiveMember(record.termId(), command.actorId());
        var rubric = rubric(record.rubricVersionId());
        for (var dimension : rubric.dimensions()) {
            if (dimension.allowedScorerRoles().contains(sourceRole) && record.scores().stream().noneMatch(score ->
                    score.dimensionId().equals(dimension.id()) && score.scorerAccountId().equals(command.actorId())
                            && score.sourceRole().equals(sourceRole))) {
                throw new IllegalStateException("All assigned rubric dimensions require a score before submission.");
            }
        }
        var allOtherGrantsSubmitted = record.grants().stream().filter(grant -> !(grant.assessorAccountId().equals(command.actorId())
                && grant.sourceRole().equals(sourceRole))).allMatch(grant -> grant.submittedAt() != null);
        var status = allOtherGrantsSubmitted ? AssessmentRecordStatus.READY_FOR_PUBLICATION : AssessmentRecordStatus.DRAFT;
        var submitted = update(() -> assessment.markAssessorSubmitted(record.id(), command.actorId(), sourceRole, status));
        audit("ASSESSMENT_SOURCE_SUBMITTED", "ASSESSMENT_RECORD", submitted.id(), command.actorId(),
                record.version(), submitted.version());
        return submitted;
    }

    @Transactional(readOnly = true)
    public List<AssessmentRepository.AssessmentRecord> assessmentRecords(UUID termId, ReadCommand command) {
        requireP1(command.p1());
        return assessment.findAssessmentRecords(termId);
    }

    @Transactional(readOnly = true)
    public BigDecimal suggestedScoreFor(AssessmentRepository.AssessmentRecord record) {
        if (record.status() != AssessmentRecordStatus.READY_FOR_PUBLICATION) {
            return null;
        }
        return suggestedScore(record, assessment.findRubric(record.rubricVersionId()).orElseThrow());
    }

    @Transactional
    public AssessmentRepository.AssessmentResult publishResult(UUID resultId, PublishResultCommand command) {
        requireP1(command.p1());
        var current = result(resultId);
        version(current.version(), command.version());
        if (current.status() != ResultStatus.DRAFT) {
            throw new IllegalStateException("Only a draft result can be published.");
        }
        var record = assessmentRecord(current.assessmentRecordId());
        if (record.status() != AssessmentRecordStatus.READY_FOR_PUBLICATION) {
            throw new IllegalStateException("All granted scorers must submit before a result can be published.");
        }
        var suggested = suggestedScore(record, rubric(record.rubricVersionId()));
        var finalScore = command.finalScore() == null ? suggested : finalScore(command.finalScore());
        var published = update(() -> assessment.publishResult(resultId, command.actorId(), suggested, finalScore, command.version()));
        audit("RESULT_PUBLISHED", "ASSESSMENT_RESULT", published.id(), command.actorId(), current.version(), published.version());
        notifyStudent(published, "RESULT_PUBLISHED", "Assessment result has been published.");
        return published;
    }

    @Transactional
    public AssessmentRepository.AssessmentResult correctResult(UUID resultId, CorrectResultCommand command) {
        requireP1(command.p1());
        var current = result(resultId);
        version(current.version(), command.version());
        if (current.status() != ResultStatus.PUBLISHED) {
            throw new IllegalStateException("Only a published result can be corrected.");
        }
        if (!assessment.isCurrentPublishedResult(current)) {
            throw new VersionConflictException("Only the current published result version can be corrected.");
        }
        var corrected = assessment.createCorrection(UUID.randomUUID(), current, command.actorId(),
                finalScore(command.finalScore()), text(command.reason(), "Correction reason", 2000));
        audit("RESULT_CORRECTED", "ASSESSMENT_RESULT", corrected.id(), command.actorId(), null, corrected.version());
        notifyStudent(corrected, "RESULT_CORRECTED", "A published assessment result has been corrected.");
        return corrected;
    }

    @Transactional(readOnly = true)
    public List<AssessmentRepository.AssessmentResult> results(UUID termId, ReadCommand command) {
        requireP1(command.p1());
        return assessment.findResults(termId);
    }

    @Transactional(readOnly = true)
    public List<AssessmentRepository.AssessmentResult> myCurrentPublishedResults(OwnReadCommand command) {
        requireP3(command.p3());
        return assessment.findCurrentPublishedResultsForAccount(command.actorId());
    }

    private AssessmentRepository.RubricVersion rubric(UUID rubricId) {
        return assessment.lockRubric(rubricId)
                .orElseThrow(() -> new ResourceNotFoundException("Rubric version not found."));
    }

    private AssessmentRepository.Portfolio portfolio(UUID portfolioId) {
        return assessment.lockPortfolio(portfolioId)
                .orElseThrow(() -> new ResourceNotFoundException("Portfolio not found."));
    }

    private AssessmentRepository.AssessmentRecord assessmentRecord(UUID assessmentRecordId) {
        return assessment.lockAssessmentRecord(assessmentRecordId)
                .orElseThrow(() -> new ResourceNotFoundException("Assessment record not found."));
    }

    private AssessmentRepository.AssessmentResult result(UUID resultId) {
        return assessment.lockResult(resultId)
                .orElseThrow(() -> new ResourceNotFoundException("Assessment result not found."));
    }

    private List<AssessmentRepository.AssessorGrant> grants(List<AssessorGrantCommand> commands,
                                                             AssessmentRepository.RubricVersion rubric, UUID termId) {
        if (commands == null || commands.isEmpty() || commands.size() > 20) {
            throw new IllegalArgumentException("An assessment requires 1 to 20 assessor grants.");
        }
        var identities = new HashSet<String>();
        var grants = new java.util.ArrayList<AssessmentRepository.AssessorGrant>();
        for (var command : commands) {
            if (command == null || command.accountId() == null || !SCORER_ROLES.contains(command.sourceRole())) {
                throw new IllegalArgumentException("Each assessor grant requires an account and P2 or T1 source role.");
            }
            var identity = command.accountId() + ":" + command.sourceRole();
            if (!identities.add(identity)) throw new IllegalArgumentException("Assessor grants must be unique.");
            if (!assessment.isActiveTermMember(termId, command.accountId())
                    || !assessment.accountHasRole(command.accountId(), command.sourceRole())) {
                throw new ForbiddenException("An assessor grant requires an active term member with the requested role.");
            }
            if (rubric.dimensions().stream().noneMatch(dimension -> dimension.allowedScorerRoles().contains(command.sourceRole()))) {
                throw new IllegalArgumentException("An assessor role must be allowed by at least one rubric dimension.");
            }
            grants.add(new AssessmentRepository.AssessorGrant(UUID.randomUUID(), command.accountId(), command.sourceRole(), null));
        }
        return List.copyOf(grants);
    }

    private String grantedSourceRole(AssessmentRepository.AssessmentRecord record, UUID actorId, boolean p2, boolean t1) {
        var matches = record.grants().stream().filter(grant -> grant.assessorAccountId().equals(actorId)
                && (("P2".equals(grant.sourceRole()) && p2) || ("T1".equals(grant.sourceRole()) && t1))).toList();
        if (matches.size() != 1) {
            throw new ForbiddenException("The account does not have one unambiguous assessor grant for this assessment.");
        }
        if (matches.getFirst().submittedAt() != null) {
            throw new IllegalStateException("The assessor has already submitted this assessment.");
        }
        return matches.getFirst().sourceRole();
    }

    private void requireActiveMember(UUID termId, UUID accountId) {
        if (!assessment.isActiveTermMember(termId, accountId)) {
            throw new ForbiddenException("The account is outside the assessment term scope.");
        }
    }

    private String portfolioScopeType(String value) {
        if (!"STUDENT".equals(value) && !"TEAM".equals(value)) {
            throw new IllegalArgumentException("Portfolio scope type must be STUDENT or TEAM.");
        }
        return value;
    }

    private BigDecimal assessmentScore(BigDecimal value, BigDecimal maximum) {
        if (value == null || value.scale() > 2 || value.compareTo(BigDecimal.ZERO) < 0 || value.compareTo(maximum) > 0) {
            throw new IllegalArgumentException("Score must be between 0 and the rubric dimension maximum.");
        }
        return value;
    }

    private BigDecimal suggestedScore(AssessmentRepository.AssessmentRecord record,
                                      AssessmentRepository.RubricVersion rubric) {
        var total = BigDecimal.ZERO;
        for (var dimension : rubric.dimensions()) {
            var scores = record.scores().stream().filter(score -> score.dimensionId().equals(dimension.id())).toList();
            if (scores.isEmpty()) throw new IllegalStateException("A ready assessment is missing a rubric score.");
            var average = scores.stream().map(AssessmentRepository.AssessmentScore::score)
                    .reduce(BigDecimal.ZERO, BigDecimal::add)
                    .divide(BigDecimal.valueOf(scores.size()), 8, RoundingMode.HALF_UP);
            total = total.add(average.multiply(dimension.weight()).divide(dimension.maxScore(), 8, RoundingMode.HALF_UP));
        }
        return total.setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal finalScore(BigDecimal value) {
        return score(value, "Final score", true);
    }

    private OffsetDateTime effectiveAt(OffsetDateTime value) {
        if (value == null) {
            throw new IllegalArgumentException("Rubric effective time is required.");
        }
        return value;
    }

    private void notifyStudent(AssessmentRepository.AssessmentResult result, String eventType, String message) {
        var portfolio = assessment.findPortfolio(result.portfolioId()).orElseThrow();
        if (portfolio.studentAccountId() != null) {
            events.publishEvent(new OperationalNotificationRequested(portfolio.studentAccountId(), eventType,
                    "ASSESSMENT_RESULT", result.id(), "Assessment result", message, result.publishedByAccountId()));
        }
    }

    private List<AssessmentRepository.RubricDimension> dimensions(List<DimensionCommand> commands) {
        if (commands == null || commands.isEmpty() || commands.size() > 20) {
            throw new IllegalArgumentException("A rubric must contain 1 to 20 dimensions.");
        }
        var codes = new HashSet<String>();
        var totalWeight = BigDecimal.ZERO;
        var dimensions = new java.util.ArrayList<AssessmentRepository.RubricDimension>();
        for (int index = 0; index < commands.size(); index++) {
            var command = commands.get(index);
            var code = code(command.code());
            if (!codes.add(code)) {
                throw new IllegalArgumentException("Rubric dimension codes must be unique.");
            }
            var weight = score(command.weight(), "Dimension weight", false);
            totalWeight = totalWeight.add(weight);
            var allowedRoles = roles(command.allowedScorerRoles());
            dimensions.add(new AssessmentRepository.RubricDimension(UUID.randomUUID(), code,
                    text(command.name(), "Dimension name", 200), weight,
                    score(command.maxScore(), "Dimension max score", false), index + 1, allowedRoles));
        }
        if (totalWeight.compareTo(new BigDecimal("100")) != 0) {
            throw new IllegalArgumentException("Rubric dimension weights must total 100.");
        }
        return List.copyOf(dimensions);
    }

    private List<String> roles(List<String> roles) {
        if (roles == null || roles.isEmpty()) {
            throw new IllegalArgumentException("Each rubric dimension must allow at least one scorer role.");
        }
        var result = new java.util.ArrayList<String>();
        for (String role : roles) {
            if (!SCORER_ROLES.contains(role) || result.contains(role)) {
                throw new IllegalArgumentException("Allowed scorer roles must be unique P2 or T1 values.");
            }
            result.add(role);
        }
        return List.copyOf(result);
    }

    private String code(String value) {
        var normalized = text(value, "Dimension code", 64);
        if (!normalized.matches("[A-Z][A-Z0-9_]*")) {
            throw new IllegalArgumentException("Dimension code must use uppercase letters, digits, and underscores.");
        }
        return normalized;
    }

    private BigDecimal score(BigDecimal value, String field, boolean allowZero) {
        if (value == null || value.scale() > 2 || value.compareTo(allowZero ? BigDecimal.ZERO : BigDecimal.ZERO) < 0
                || (!allowZero && value.compareTo(BigDecimal.ZERO) == 0) || value.compareTo(new BigDecimal("100")) > 0) {
            throw new IllegalArgumentException(field + " must be between " + (allowZero ? "0" : "0.01") + " and 100.");
        }
        return value;
    }

    private String text(String value, String field, int maximumLength) {
        if (value == null || value.isBlank() || value.trim().length() > maximumLength) {
            throw new IllegalArgumentException(field + " must contain 1 to " + maximumLength + " characters.");
        }
        return value.trim();
    }

    private void version(long actual, long expected) {
        if (actual != expected) {
            throw new VersionConflictException("The resource has changed. Refresh and try again.");
        }
    }

    private <T> T update(java.util.function.Supplier<T> action) {
        try {
            return action.get();
        } catch (EmptyResultDataAccessException exception) {
            throw new VersionConflictException("The resource has changed. Refresh and try again.");
        }
    }

    private void requireP1(boolean p1) {
        if (!p1) {
            throw new ForbiddenException("Only P1 can manage assessment rubrics.");
        }
    }

    private void requireP3(boolean p3) {
        if (!p3) {
            throw new ForbiddenException("Only P3 can read personal assessment outcomes.");
        }
    }

    private void audit(String eventType, AssessmentRepository.RubricVersion rubric, UUID actorId,
                       Long previousVersion, Long newVersion) {
        assessment.appendAudit(eventType, "RUBRIC_VERSION", rubric.id(), actorId, previousVersion, newVersion);
    }

    private void audit(String eventType, String resourceType, UUID resourceId, UUID actorId,
                       Long previousVersion, Long newVersion) {
        assessment.appendAudit(eventType, resourceType, resourceId, actorId, previousVersion, newVersion);
    }

    public record CreateRubricCommand(UUID termId, String name, BigDecimal passScore, OffsetDateTime effectiveAt,
                                      List<DimensionCommand> dimensions, UUID actorId, boolean p1) {
    }

    public record DeriveRubricCommand(OffsetDateTime effectiveAt, UUID actorId, boolean p1) {
    }

    public record UpdateRubricCommand(String name, BigDecimal passScore, List<DimensionCommand> dimensions,
                                      long version, UUID actorId, boolean p1) {
    }

    public record DimensionCommand(String code, String name, BigDecimal weight, BigDecimal maxScore,
                                   List<String> allowedScorerRoles) {
    }

    public record VersionCommand(long version, UUID actorId, boolean p1) {
    }

    public record ReadCommand(boolean p1) {
    }

    public record OwnReadCommand(UUID actorId, boolean p3) {
    }

    public record P1ActorCommand(UUID actorId, boolean p1) {
    }

    public record CreatePortfolioCommand(UUID termId, String scopeType, UUID studentAccountId, UUID teamId,
                                         UUID actorId, boolean p1) {
    }

    public record CreateAssessmentRecordCommand(UUID portfolioId, UUID rubricVersionId,
                                                List<AssessorGrantCommand> assessorGrants, UUID actorId, boolean p1) {
    }

    public record AssessorGrantCommand(UUID accountId, String sourceRole) {
    }

    public record ScoreCommand(UUID dimensionId, BigDecimal score, String comment, UUID actorId, boolean p2, boolean t1) {
    }

    public record ActorCommand(UUID actorId, boolean p2, boolean t1) {
    }

    public record PublishResultCommand(BigDecimal finalScore, long version, UUID actorId, boolean p1) {
    }

    public record CorrectResultCommand(BigDecimal finalScore, String reason, long version, UUID actorId, boolean p1) {
    }
}
