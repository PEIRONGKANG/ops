package com.beverageops.assessment.adapter.in.web;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import com.beverageops.assessment.application.usecase.AssessmentUseCase;
import com.beverageops.assessment.domain.port.AssessmentRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class AssessmentController {

    private final AssessmentUseCase assessment;
    private final ObjectMapper objectMapper;

    public AssessmentController(AssessmentUseCase assessment, ObjectMapper objectMapper) {
        this.assessment = assessment;
        this.objectMapper = objectMapper;
    }

    @PostMapping("/rubric-versions")
    ResponseEntity<RubricResponse> createRubric(@RequestBody RubricRequest request, Authentication authentication) {
        var created = assessment.createRubric(new AssessmentUseCase.CreateRubricCommand(request.termId(), request.name(),
                request.passScore(), request.effectiveAt(), dimensions(request.dimensions()), actorId(authentication), hasRole(authentication, "P1")));
        return ResponseEntity.status(HttpStatus.CREATED).body(response(created));
    }

    @PatchMapping("/rubric-versions/{rubricId}")
    RubricResponse updateRubric(@PathVariable UUID rubricId, @RequestBody UpdateRubricRequest request,
                                Authentication authentication) {
        return response(assessment.updateRubric(rubricId, new AssessmentUseCase.UpdateRubricCommand(request.name(),
                request.passScore(), dimensions(request.dimensions()), request.version(), actorId(authentication),
                hasRole(authentication, "P1"))));
    }

    @PostMapping("/rubric-versions/{rubricId}/publish")
    RubricResponse publishRubric(@PathVariable UUID rubricId, @RequestBody VersionRequest request,
                                 Authentication authentication) {
        return response(assessment.publishRubric(rubricId,
                new AssessmentUseCase.VersionCommand(request.version(), actorId(authentication), hasRole(authentication, "P1"))));
    }

    @PostMapping("/rubric-versions/{rubricId}/derive")
    ResponseEntity<RubricResponse> deriveRubric(@PathVariable UUID rubricId, @RequestBody DeriveRubricRequest request,
                                                Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(response(assessment.deriveRubric(rubricId,
                new AssessmentUseCase.DeriveRubricCommand(request.effectiveAt(), actorId(authentication),
                        hasRole(authentication, "P1")))));
    }

    @GetMapping("/rubric-versions")
    List<RubricResponse> rubrics(@RequestParam UUID termId, Authentication authentication) {
        return assessment.rubrics(termId, new AssessmentUseCase.ReadCommand(hasRole(authentication, "P1")))
                .stream().map(this::response).toList();
    }

    @PostMapping("/portfolios")
    ResponseEntity<PortfolioResponse> createPortfolio(@RequestBody CreatePortfolioRequest request, Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(portfolioResponse(assessment.createPortfolio(
                new AssessmentUseCase.CreatePortfolioCommand(request.termId(), request.scopeType(), request.studentAccountId(),
                        request.teamId(), actorId(authentication), hasRole(authentication, "P1")))));
    }

    @PostMapping("/portfolios/{portfolioId}/generate")
    PortfolioResponse generatePortfolio(@PathVariable UUID portfolioId, @RequestBody VersionRequest request,
                                        Authentication authentication) {
        return portfolioResponse(assessment.generatePortfolio(portfolioId,
                new AssessmentUseCase.VersionCommand(request.version(), actorId(authentication), hasRole(authentication, "P1"))));
    }

    @PostMapping("/portfolios/{portfolioId}/publish")
    PortfolioResponse publishPortfolio(@PathVariable UUID portfolioId, @RequestBody VersionRequest request,
                                       Authentication authentication) {
        return portfolioResponse(assessment.publishPortfolio(portfolioId,
                new AssessmentUseCase.VersionCommand(request.version(), actorId(authentication), hasRole(authentication, "P1"))));
    }

    @GetMapping("/portfolios")
    List<PortfolioResponse> portfolios(@RequestParam UUID termId, Authentication authentication) {
        return assessment.portfolios(termId, new AssessmentUseCase.ReadCommand(hasRole(authentication, "P1")))
                .stream().map(this::portfolioResponse).toList();
    }

    @GetMapping("/me/portfolios")
    List<PortfolioResponse> myPortfolios(Authentication authentication) {
        return assessment.myPublishedPortfolios(new AssessmentUseCase.OwnReadCommand(actorId(authentication),
                hasRole(authentication, "P3"))).stream().map(this::portfolioResponse).toList();
    }

    @GetMapping("/portfolios/{portfolioId}/export-manifest")
    JsonNode exportManifest(@PathVariable UUID portfolioId, Authentication authentication) {
        return manifest(assessment.internalExportManifest(portfolioId,
                new AssessmentUseCase.P1ActorCommand(actorId(authentication), hasRole(authentication, "P1"))));
    }

    @PostMapping("/assessment-records")
    ResponseEntity<AssessmentRecordResponse> createAssessmentRecord(@RequestBody CreateAssessmentRecordRequest request,
                                                                      Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(assessmentRecordResponse(assessment.createAssessmentRecord(
                new AssessmentUseCase.CreateAssessmentRecordCommand(request.portfolioId(), request.rubricVersionId(),
                        grants(request.assessorGrants()), actorId(authentication), hasRole(authentication, "P1")))));
    }

    @PostMapping("/assessment-records/{assessmentRecordId}/score")
    ResponseEntity<ScoreResponse> score(@PathVariable UUID assessmentRecordId, @RequestBody ScoreRequest request,
                                        Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(scoreResponse(assessment.score(assessmentRecordId,
                new AssessmentUseCase.ScoreCommand(request.dimensionId(), request.score(), request.comment(), actorId(authentication),
                        hasRole(authentication, "P2"), hasRole(authentication, "T1")))));
    }

    @PostMapping("/assessment-records/{assessmentRecordId}/submit")
    AssessmentRecordResponse submitAssessment(@PathVariable UUID assessmentRecordId, Authentication authentication) {
        return assessmentRecordResponse(assessment.submitAssessment(assessmentRecordId,
                new AssessmentUseCase.ActorCommand(actorId(authentication), hasRole(authentication, "P2"), hasRole(authentication, "T1"))));
    }

    @GetMapping("/assessment-records")
    List<AssessmentRecordResponse> assessmentRecords(@RequestParam UUID termId, Authentication authentication) {
        return assessment.assessmentRecords(termId, new AssessmentUseCase.ReadCommand(hasRole(authentication, "P1")))
                .stream().map(this::assessmentRecordResponse).toList();
    }

    @PostMapping("/results/{resultId}/publish")
    ResultResponse publishResult(@PathVariable UUID resultId, @RequestBody PublishResultRequest request,
                                 Authentication authentication) {
        return resultResponse(assessment.publishResult(resultId, new AssessmentUseCase.PublishResultCommand(request.finalScore(),
                request.version(), actorId(authentication), hasRole(authentication, "P1"))));
    }

    @PostMapping("/results/{resultId}/correct")
    ResponseEntity<ResultResponse> correctResult(@PathVariable UUID resultId, @RequestBody CorrectResultRequest request,
                                                 Authentication authentication) {
        return ResponseEntity.status(HttpStatus.CREATED).body(resultResponse(assessment.correctResult(resultId,
                new AssessmentUseCase.CorrectResultCommand(request.finalScore(), request.reason(), request.version(),
                        actorId(authentication), hasRole(authentication, "P1")))));
    }

    @GetMapping("/results")
    List<ResultResponse> results(@RequestParam UUID termId, Authentication authentication) {
        return assessment.results(termId, new AssessmentUseCase.ReadCommand(hasRole(authentication, "P1")))
                .stream().map(this::resultResponse).toList();
    }

    @GetMapping("/me/results")
    List<ResultResponse> myResults(Authentication authentication) {
        return assessment.myCurrentPublishedResults(new AssessmentUseCase.OwnReadCommand(actorId(authentication),
                hasRole(authentication, "P3"))).stream().map(this::resultResponse).toList();
    }

    private List<AssessmentUseCase.DimensionCommand> dimensions(List<DimensionRequest> dimensions) {
        if (dimensions == null) {
            return null;
        }
        return dimensions.stream().map(dimension -> new AssessmentUseCase.DimensionCommand(dimension.code(), dimension.name(),
                dimension.weight(), dimension.maxScore(), dimension.allowedScorerRoles())).toList();
    }

    private List<AssessmentUseCase.AssessorGrantCommand> grants(List<AssessorGrantRequest> grants) {
        if (grants == null) return null;
        return grants.stream().map(grant -> new AssessmentUseCase.AssessorGrantCommand(grant.accountId(), grant.sourceRole())).toList();
    }

    private RubricResponse response(AssessmentRepository.RubricVersion rubric) {
        return new RubricResponse(rubric.id(), rubric.rootRubricId(), rubric.rubricRevision(), rubric.termId(), rubric.name(),
                rubric.passScore(), rubric.effectiveAt(), rubric.status().name(),
                rubric.version(), rubric.publishedByAccountId(), rubric.publishedAt(), rubric.updatedAt(), rubric.dimensions().stream()
                .map(dimension -> new DimensionResponse(dimension.id(), dimension.code(), dimension.name(), dimension.weight(),
                        dimension.maxScore(), dimension.displayOrder(), dimension.allowedScorerRoles())).toList());
    }

    private PortfolioResponse portfolioResponse(AssessmentRepository.Portfolio portfolio) {
        return new PortfolioResponse(portfolio.id(), portfolio.termId(), portfolio.scopeType(), portfolio.studentAccountId(),
                portfolio.teamId(), portfolio.status().name(), manifest(portfolio.manifestJson()), portfolio.version(),
                portfolio.generatedByAccountId(), portfolio.generatedAt(), portfolio.publishedByAccountId(), portfolio.publishedAt(),
                portfolio.updatedAt(), portfolio.sources().stream().map(source -> new PortfolioSourceResponse(source.sourceType(),
                source.sourceId(), source.sourceVersion(), manifest(source.snapshotJson()))).toList());
    }

    private AssessmentRecordResponse assessmentRecordResponse(AssessmentRepository.AssessmentRecord record) {
        return new AssessmentRecordResponse(record.id(), record.termId(), record.portfolioId(), record.rubricVersionId(),
                record.status().name(), record.version(), assessment.suggestedScoreFor(record), record.resultId(), record.updatedAt(),
                record.grants().stream().map(grant -> new AssessorGrantResponse(grant.assessorAccountId(), grant.sourceRole(),
                grant.submittedAt())).toList(), record.scores().stream().map(this::scoreResponse).toList());
    }

    private ScoreResponse scoreResponse(AssessmentRepository.AssessmentScore score) {
        return new ScoreResponse(score.id(), score.dimensionId(), score.scorerAccountId(), score.sourceRole(), score.score(),
                score.comment(), score.createdAt());
    }

    private ResultResponse resultResponse(AssessmentRepository.AssessmentResult result) {
        return new ResultResponse(result.id(), result.rootResultId(), result.previousResultId(), result.assessmentRecordId(),
                result.termId(), result.portfolioId(), result.resultRevision(), result.suggestedScore(), result.finalScore(),
                result.status().name(), result.correctionReason(), result.version(), result.publishedByAccountId(), result.publishedAt(),
                result.updatedAt());
    }

    private JsonNode manifest(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception exception) {
            throw new IllegalStateException("Stored assessment JSON is invalid.", exception);
        }
    }

    private UUID actorId(Authentication authentication) {
        return UUID.fromString(authentication.getName());
    }

    private boolean hasRole(Authentication authentication, String role) {
        return authentication.getAuthorities().stream().anyMatch(authority -> authority.getAuthority().equals("ROLE_" + role));
    }

    public record RubricRequest(UUID termId, String name, BigDecimal passScore, OffsetDateTime effectiveAt,
                                List<DimensionRequest> dimensions) {
    }

    public record UpdateRubricRequest(String name, BigDecimal passScore, List<DimensionRequest> dimensions, long version) {
    }

    public record DimensionRequest(String code, String name, BigDecimal weight, BigDecimal maxScore,
                                   List<String> allowedScorerRoles) {
    }

    public record VersionRequest(long version) {
    }

    public record DeriveRubricRequest(OffsetDateTime effectiveAt) {
    }

    public record RubricResponse(UUID id, UUID rootRubricId, int rubricRevision, UUID termId, String name,
                                 BigDecimal passScore, OffsetDateTime effectiveAt, String status, long version,
                                 UUID publishedByAccountId, OffsetDateTime publishedAt, OffsetDateTime updatedAt,
                                 List<DimensionResponse> dimensions) {
    }

    public record DimensionResponse(UUID id, String code, String name, BigDecimal weight, BigDecimal maxScore,
                                    int displayOrder, List<String> allowedScorerRoles) {
    }

    public record CreatePortfolioRequest(UUID termId, String scopeType, UUID studentAccountId, UUID teamId) {
    }

    public record PortfolioResponse(UUID id, UUID termId, String scopeType, UUID studentAccountId, UUID teamId,
                                    String status, JsonNode manifest, long version, UUID generatedByAccountId,
                                    OffsetDateTime generatedAt, UUID publishedByAccountId, OffsetDateTime publishedAt,
                                    OffsetDateTime updatedAt, List<PortfolioSourceResponse> sources) {
    }

    public record PortfolioSourceResponse(String sourceType, UUID sourceId, Long sourceVersion, JsonNode snapshot) {
    }

    public record CreateAssessmentRecordRequest(UUID portfolioId, UUID rubricVersionId,
                                                List<AssessorGrantRequest> assessorGrants) {
    }

    public record AssessorGrantRequest(UUID accountId, String sourceRole) {
    }

    public record ScoreRequest(UUID dimensionId, BigDecimal score, String comment) {
    }

    public record ScoreResponse(UUID id, UUID dimensionId, UUID scorerAccountId, String sourceRole,
                                BigDecimal score, String comment, OffsetDateTime createdAt) {
    }

    public record AssessmentRecordResponse(UUID id, UUID termId, UUID portfolioId, UUID rubricVersionId, String status,
                                           long version, BigDecimal suggestedScore, UUID resultId, OffsetDateTime updatedAt,
                                           List<AssessorGrantResponse> assessorGrants, List<ScoreResponse> scores) {
    }

    public record AssessorGrantResponse(UUID accountId, String sourceRole, OffsetDateTime submittedAt) {
    }

    public record PublishResultRequest(BigDecimal finalScore, long version) {
    }

    public record CorrectResultRequest(BigDecimal finalScore, String reason, long version) {
    }

    public record ResultResponse(UUID id, UUID rootResultId, UUID previousResultId, UUID assessmentRecordId, UUID termId,
                                 UUID portfolioId, int resultRevision, BigDecimal suggestedScore, BigDecimal finalScore,
                                 String status, String correctionReason, long version, UUID publishedByAccountId,
                                 OffsetDateTime publishedAt, OffsetDateTime updatedAt) {
    }
}
