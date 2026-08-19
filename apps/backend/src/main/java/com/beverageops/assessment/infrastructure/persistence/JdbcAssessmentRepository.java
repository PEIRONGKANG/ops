package com.beverageops.assessment.infrastructure.persistence;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.assessment.domain.model.AssessmentRecordStatus;
import com.beverageops.assessment.domain.model.PortfolioStatus;
import com.beverageops.assessment.domain.model.ResultStatus;
import com.beverageops.assessment.domain.model.RubricStatus;
import com.beverageops.assessment.domain.port.AssessmentRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JdbcAssessmentRepository implements AssessmentRepository {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;

    public JdbcAssessmentRepository(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean termExists(UUID termId) {
        return Boolean.TRUE.equals(jdbcTemplate.query("select exists(select 1 from gov_terms where id = ?)",
                resultSet -> resultSet.next() && resultSet.getBoolean(1), termId));
    }

    @Override
    public boolean isActiveTermMember(UUID termId, UUID accountId) {
        return Boolean.TRUE.equals(jdbcTemplate.query("""
                        select exists(select 1 from gov_term_memberships
                        where term_id = ? and account_id = ? and status = 'ACTIVE'
                          and effective_from <= current_timestamp
                          and (effective_until is null or effective_until > current_timestamp))
                        """, resultSet -> resultSet.next() && resultSet.getBoolean(1), termId, accountId));
    }

    @Override
    public boolean teamExistsInTerm(UUID termId, UUID teamId) {
        return Boolean.TRUE.equals(jdbcTemplate.query("""
                        select exists(select 1 from gov_teams where id = ? and term_id = ? and status = 'ACTIVE')
                        """, resultSet -> resultSet.next() && resultSet.getBoolean(1), teamId, termId));
    }

    @Override
    public boolean accountHasRole(UUID accountId, String role) {
        return Boolean.TRUE.equals(jdbcTemplate.query("""
                        select exists(select 1 from iam_role_assignments
                        where account_id = ? and role_code = ? and revoked_at is null
                          and effective_from <= current_timestamp
                          and (effective_until is null or effective_until > current_timestamp))
                        """, resultSet -> resultSet.next() && resultSet.getBoolean(1), accountId, role));
    }

    @Override
    public RubricVersion createRubric(UUID id, UUID termId, String name, BigDecimal passScore, OffsetDateTime effectiveAt,
                                      List<RubricDimension> dimensions, UUID actorId) {
        jdbcTemplate.update("""
                insert into assessment_rubric_versions
                    (id, root_rubric_id, rubric_revision, term_id, name, pass_score, effective_at, status, created_by_account_id)
                values (?, ?, 1, ?, ?, ?, ?, 'DRAFT', ?)
                """, id, id, termId, name, passScore, effectiveAt, actorId);
        saveDimensions(id, dimensions);
        return findRubric(id).orElseThrow();
    }

    @Override
    public RubricVersion deriveRubric(UUID id, RubricVersion publishedRubric, OffsetDateTime effectiveAt, UUID actorId) {
        jdbcTemplate.query("""
                        select id from assessment_rubric_versions where id = ? for update
                        """, resultSet -> null, publishedRubric.rootRubricId());
        var nextRevision = jdbcTemplate.queryForObject("""
                        select coalesce(max(rubric_revision), 0) + 1
                        from assessment_rubric_versions where root_rubric_id = ?
                        """, Integer.class, publishedRubric.rootRubricId());
        jdbcTemplate.update("""
                insert into assessment_rubric_versions
                    (id, root_rubric_id, rubric_revision, term_id, name, pass_score, effective_at, status, created_by_account_id)
                values (?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)
                """, id, publishedRubric.rootRubricId(), nextRevision,
                publishedRubric.termId(), publishedRubric.name(), publishedRubric.passScore(), effectiveAt, actorId);
        var copiedDimensions = publishedRubric.dimensions().stream().map(dimension -> new RubricDimension(UUID.randomUUID(),
                dimension.code(), dimension.name(), dimension.weight(), dimension.maxScore(), dimension.displayOrder(),
                dimension.allowedScorerRoles())).toList();
        saveDimensions(id, copiedDimensions);
        return findRubric(id).orElseThrow();
    }

    @Override
    public Optional<RubricVersion> lockRubric(UUID rubricId) {
        return jdbcTemplate.query("""
                        select id, root_rubric_id, rubric_revision, term_id, name, pass_score, effective_at, status, version, created_by_account_id,
                               published_by_account_id, published_at, created_at, updated_at
                        from assessment_rubric_versions where id = ? for update
                        """, resultSet -> resultSet.next() ? Optional.of(rubric(resultSet)) : Optional.empty(), rubricId);
    }

    @Override
    public Optional<RubricVersion> findRubric(UUID rubricId) {
        return jdbcTemplate.query("""
                        select id, root_rubric_id, rubric_revision, term_id, name, pass_score, effective_at, status, version, created_by_account_id,
                               published_by_account_id, published_at, created_at, updated_at
                        from assessment_rubric_versions where id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(rubric(resultSet)) : Optional.empty(), rubricId);
    }

    @Override
    public List<RubricVersion> findRubrics(UUID termId) {
        return jdbcTemplate.query("""
                        select id, root_rubric_id, rubric_revision, term_id, name, pass_score, effective_at, status, version, created_by_account_id,
                               published_by_account_id, published_at, created_at, updated_at
                        from assessment_rubric_versions where term_id = ? order by root_rubric_id, rubric_revision desc
                        """, (resultSet, rowNumber) -> rubric(resultSet), termId);
    }

    @Override
    public RubricVersion updateRubric(UUID rubricId, String name, BigDecimal passScore,
                                      List<RubricDimension> dimensions, long expectedVersion) {
        var updated = jdbcTemplate.update("""
                update assessment_rubric_versions
                set name = ?, pass_score = ?, version = version + 1, updated_at = current_timestamp
                where id = ? and status = 'DRAFT' and version = ?
                """, name, passScore, rubricId, expectedVersion);
        if (updated != 1) {
            throw new EmptyResultDataAccessException(1);
        }
        jdbcTemplate.update("""
                delete from assessment_rubric_dimension_scorer_roles
                where rubric_dimension_id in (select id from assessment_rubric_dimensions where rubric_version_id = ?)
                """, rubricId);
        jdbcTemplate.update("delete from assessment_rubric_dimensions where rubric_version_id = ?", rubricId);
        saveDimensions(rubricId, dimensions);
        return findRubric(rubricId).orElseThrow();
    }

    @Override
    public RubricVersion publishRubric(UUID rubricId, UUID actorId, long expectedVersion) {
        var updated = jdbcTemplate.update("""
                update assessment_rubric_versions
                set status = 'PUBLISHED', published_by_account_id = ?, published_at = current_timestamp,
                    version = version + 1, updated_at = current_timestamp
                where id = ? and status = 'DRAFT' and version = ?
                """, actorId, rubricId, expectedVersion);
        if (updated != 1) {
            throw new EmptyResultDataAccessException(1);
        }
        return findRubric(rubricId).orElseThrow();
    }

    @Override
    public Portfolio createPortfolio(UUID id, UUID termId, String scopeType, UUID studentAccountId, UUID teamId, UUID actorId) {
        jdbcTemplate.update("""
                insert into assessment_portfolios
                    (id, term_id, scope_type, student_account_id, team_id, status, created_by_account_id)
                values (?, ?, ?, ?, ?, 'DRAFT', ?)
                """, id, termId, scopeType, studentAccountId, teamId, actorId);
        return findPortfolio(id).orElseThrow();
    }

    @Override
    public Optional<Portfolio> lockPortfolio(UUID portfolioId) {
        return jdbcTemplate.query("""
                        select id, term_id, scope_type, student_account_id, team_id, status, manifest, version,
                               created_by_account_id, generated_by_account_id, generated_at,
                               published_by_account_id, published_at, created_at, updated_at
                        from assessment_portfolios where id = ? for update
                        """, resultSet -> resultSet.next() ? Optional.of(portfolio(resultSet)) : Optional.empty(), portfolioId);
    }

    @Override
    public Optional<Portfolio> findPortfolio(UUID portfolioId) {
        return jdbcTemplate.query("""
                        select id, term_id, scope_type, student_account_id, team_id, status, manifest, version,
                               created_by_account_id, generated_by_account_id, generated_at,
                               published_by_account_id, published_at, created_at, updated_at
                        from assessment_portfolios where id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(portfolio(resultSet)) : Optional.empty(), portfolioId);
    }

    @Override
    public List<Portfolio> findPortfolios(UUID termId) {
        return jdbcTemplate.query("""
                        select id, term_id, scope_type, student_account_id, team_id, status, manifest, version,
                               created_by_account_id, generated_by_account_id, generated_at,
                               published_by_account_id, published_at, created_at, updated_at
                        from assessment_portfolios where term_id = ? order by updated_at desc, id
                        """, (resultSet, rowNumber) -> portfolio(resultSet), termId);
    }

    @Override
    public List<Portfolio> findPublishedPortfoliosForAccount(UUID accountId) {
        return jdbcTemplate.query("""
                        select p.id, p.term_id, p.scope_type, p.student_account_id, p.team_id, p.status, p.manifest, p.version,
                               p.created_by_account_id, p.generated_by_account_id, p.generated_at,
                               p.published_by_account_id, p.published_at, p.created_at, p.updated_at
                        from assessment_portfolios p
                        where p.status = 'PUBLISHED'
                          and (p.student_account_id = ? or exists (
                              select 1 from gov_term_memberships m
                              where m.term_id = p.term_id and m.team_id = p.team_id
                                and m.account_id = ? and m.status = 'ACTIVE'
                          ))
                        order by p.published_at desc, p.id
                        """, (resultSet, rowNumber) -> portfolio(resultSet), accountId, accountId);
    }

    @Override
    public List<PortfolioSourceSnapshot> collectPortfolioSources(Portfolio portfolio) {
        var sources = new ArrayList<PortfolioSourceSnapshot>();
        if ("STUDENT".equals(portfolio.scopeType())) {
            sources.addAll(jdbcTemplate.query("""
                            select id, version, content, improvement_plan, teaching_week_id
                            from learning_reflections where term_id = ? and student_account_id = ? and status = 'SUBMITTED'
                            """, (resultSet, rowNumber) -> source("REFLECTION", resultSet.getObject("id", UUID.class),
                    resultSet.getLong("version"), Map.of("content", resultSet.getString("content"),
                    "improvementPlan", resultSet.getString("improvement_plan"), "teachingWeekId", resultSet.getObject("teaching_week_id", UUID.class))),
                    portfolio.termId(), portfolio.studentAccountId()));
            sources.addAll(jdbcTemplate.query("""
                            select id, version, observation, recommendation, requires_retraining, retraining_due_at, status,
                                   shift_id, task_completion_id, incident_id, evidence_id
                            from learning_feedback where term_id = ? and student_account_id = ?
                            """, (resultSet, rowNumber) -> source("FEEDBACK", resultSet.getObject("id", UUID.class),
                    resultSet.getLong("version"), snapshot("observation", resultSet.getString("observation"),
                    "recommendation", resultSet.getString("recommendation"),
                    "requiresRetraining", resultSet.getBoolean("requires_retraining"),
                    "retrainingDueAt", java.util.Objects.toString(resultSet.getObject("retraining_due_at", OffsetDateTime.class), ""),
                    "status", resultSet.getString("status"), "shiftId", resultSet.getObject("shift_id", UUID.class),
                    "taskCompletionId", resultSet.getObject("task_completion_id", UUID.class),
                    "incidentId", resultSet.getObject("incident_id", UUID.class),
                    "evidenceId", resultSet.getObject("evidence_id", UUID.class))),
                    portfolio.termId(), portfolio.studentAccountId()));
            sources.addAll(jdbcTemplate.query("""
                            select r.id, r.version, r.feedback_id, r.status, r.due_at
                            from learning_retraining r where r.term_id = ? and r.student_account_id = ?
                            """, (resultSet, rowNumber) -> source("RETRAINING", resultSet.getObject("id", UUID.class),
                    resultSet.getLong("version"), snapshot("feedbackId", resultSet.getObject("feedback_id", UUID.class),
                    "status", resultSet.getString("status"),
                    "dueAt", java.util.Objects.toString(resultSet.getObject("due_at", OffsetDateTime.class), ""))),
                    portfolio.termId(), portfolio.studentAccountId()));
            sources.addAll(jdbcTemplate.query("""
                            select e.id, e.version, e.kind, e.occurred_at, e.shift_id, e.task_completion_id,
                                   e.milestone_submission_id
                            from ops_evidence e
                            join ops_shifts s on s.id = e.shift_id
                            join ops_operating_days d on d.id = s.operating_day_id
                            left join ops_task_completions t on t.id = e.task_completion_id
                            left join ops_shift_assignments a on a.id = t.assignment_id
                            where d.term_id = ? and coalesce(a.account_id, e.submitted_by_account_id) = ?
                            """, (resultSet, rowNumber) -> source("EVIDENCE", resultSet.getObject("id", UUID.class),
                    resultSet.getLong("version"), snapshot("kind", resultSet.getString("kind"),
                    "occurredAt", java.util.Objects.toString(resultSet.getObject("occurred_at", OffsetDateTime.class), ""),
                    "shiftId", resultSet.getObject("shift_id", UUID.class),
                    "taskCompletionId", resultSet.getObject("task_completion_id", UUID.class),
                    "milestoneSubmissionId", resultSet.getObject("milestone_submission_id", UUID.class))),
                    portfolio.termId(), portfolio.studentAccountId()));
            sources.addAll(jdbcTemplate.query("""
                            select id, revision, content, task_id from learning_course_task_submissions
                            where term_id = ? and student_account_id = ?
                            """, (resultSet, rowNumber) -> source("COURSE_TASK_SUBMISSION", resultSet.getObject("id", UUID.class),
                    (long) resultSet.getInt("revision"), Map.of("taskId", resultSet.getObject("task_id", UUID.class),
                    "content", resultSet.getString("content"))), portfolio.termId(), portfolio.studentAccountId()));
            sources.addAll(jdbcTemplate.query("""
                            select id, status, note, version from learning_certifications
                            where term_id = ? and student_account_id = ?
                            """, (resultSet, rowNumber) -> source("CERTIFICATION", resultSet.getObject("id", UUID.class),
                    resultSet.getLong("version"), Map.of("status", resultSet.getString("status"),
                    "note", java.util.Objects.toString(resultSet.getString("note"), ""))), portfolio.termId(), portfolio.studentAccountId()));
            sources.addAll(jdbcTemplate.query("""
                            select c.id, c.version, c.status, c.updated_at
                            from ops_task_completions c
                            join ops_shift_assignments a on a.id = c.assignment_id
                            join ops_shifts s on s.id = c.shift_id
                            join ops_operating_days d on d.id = s.operating_day_id
                            where d.term_id = ? and a.account_id = ?
                            """, (resultSet, rowNumber) -> source("SHIFT_TASK_COMPLETION", resultSet.getObject("id", UUID.class),
                    resultSet.getLong("version"), Map.of("status", resultSet.getString("status"),
                    "updatedAt", java.util.Objects.toString(resultSet.getObject("updated_at", OffsetDateTime.class), ""))),
                    portfolio.termId(), portfolio.studentAccountId()));
            sources.addAll(jdbcTemplate.query("""
                            select w.id, w.version, w.title, w.status, v.content
                            from learning_creative_works w
                            join learning_creative_work_versions v
                              on v.creative_work_id = w.id and v.revision = w.current_revision
                            join gov_term_memberships m
                              on m.term_id = w.term_id and m.team_id = w.team_id
                            where w.term_id = ? and m.account_id = ? and m.status = 'ACTIVE'
                              and w.status = 'PUBLISHED'
                            """, (resultSet, rowNumber) -> source("CREATIVE_WORK", resultSet.getObject("id", UUID.class),
                    resultSet.getLong("version"), Map.of("title", resultSet.getString("title"),
                    "status", resultSet.getString("status"), "content", resultSet.getString("content"))),
                    portfolio.termId(), portfolio.studentAccountId()));
        } else {
            sources.addAll(jdbcTemplate.query("""
                            select w.id, w.version, w.title, w.status, v.content
                            from learning_creative_works w
                            join learning_creative_work_versions v
                              on v.creative_work_id = w.id and v.revision = w.current_revision
                            where w.term_id = ? and w.team_id = ? and w.status = 'PUBLISHED'
                            """, (resultSet, rowNumber) -> source("CREATIVE_WORK", resultSet.getObject("id", UUID.class),
                    resultSet.getLong("version"), Map.of("title", resultSet.getString("title"),
                    "status", resultSet.getString("status"), "content", resultSet.getString("content"))),
                    portfolio.termId(), portfolio.teamId()));
        }
        return List.copyOf(sources);
    }

    @Override
    public Portfolio generatePortfolio(UUID portfolioId, UUID actorId, String manifestJson,
                                       List<PortfolioSourceSnapshot> sources, long expectedVersion) {
        var updated = jdbcTemplate.update("""
                update assessment_portfolios
                set status = 'GENERATED', manifest = cast(? as jsonb), generated_by_account_id = ?, generated_at = current_timestamp,
                    version = version + 1, updated_at = current_timestamp
                where id = ? and status = 'DRAFT' and version = ?
                """, manifestJson, actorId, portfolioId, expectedVersion);
        if (updated != 1) {
            throw new EmptyResultDataAccessException(1);
        }
        jdbcTemplate.update("delete from assessment_portfolio_membership_snapshots where portfolio_id = ?", portfolioId);
        for (PortfolioSourceSnapshot source : sources) {
            jdbcTemplate.update("""
                    insert into assessment_portfolio_membership_snapshots
                        (id, portfolio_id, source_type, source_id, source_version, snapshot)
                    values (?, ?, ?, ?, ?, cast(? as jsonb))
                    """, source.id(), portfolioId, source.sourceType(), source.sourceId(), source.sourceVersion(), source.snapshotJson());
        }
        return findPortfolio(portfolioId).orElseThrow();
    }

    @Override
    public Portfolio publishPortfolio(UUID portfolioId, UUID actorId, long expectedVersion) {
        var updated = jdbcTemplate.update("""
                update assessment_portfolios
                set status = 'PUBLISHED', published_by_account_id = ?, published_at = current_timestamp,
                    version = version + 1, updated_at = current_timestamp
                where id = ? and status = 'GENERATED' and version = ?
                """, actorId, portfolioId, expectedVersion);
        if (updated != 1) {
            throw new EmptyResultDataAccessException(1);
        }
        return findPortfolio(portfolioId).orElseThrow();
    }

    @Override
    public AssessmentRecord createAssessmentRecord(UUID id, UUID resultId, Portfolio portfolio, RubricVersion rubric,
                                                   List<AssessorGrant> grants, UUID actorId) {
        jdbcTemplate.update("""
                insert into assessment_records
                    (id, term_id, portfolio_id, rubric_version_id, status, created_by_account_id)
                values (?, ?, ?, ?, 'DRAFT', ?)
                """, id, portfolio.termId(), portfolio.id(), rubric.id(), actorId);
        for (AssessorGrant grant : grants) {
            jdbcTemplate.update("""
                    insert into assessment_assessor_grants (id, assessment_record_id, assessor_account_id, source_role)
                    values (?, ?, ?, ?)
                    """, grant.id(), id, grant.assessorAccountId(), grant.sourceRole());
        }
        jdbcTemplate.update("""
                insert into assessment_result_versions
                    (id, root_result_id, assessment_record_id, term_id, portfolio_id, result_revision, status)
                values (?, ?, ?, ?, ?, 1, 'DRAFT')
                """, resultId, resultId, id, portfolio.termId(), portfolio.id());
        return findAssessmentRecord(id).orElseThrow();
    }

    @Override
    public Optional<AssessmentRecord> lockAssessmentRecord(UUID assessmentRecordId) {
        return jdbcTemplate.query("""
                        select id, term_id, portfolio_id, rubric_version_id, status, version, created_by_account_id, created_at, updated_at
                        from assessment_records where id = ? for update
                        """, resultSet -> resultSet.next() ? Optional.of(assessmentRecord(resultSet)) : Optional.empty(), assessmentRecordId);
    }

    @Override
    public Optional<AssessmentRecord> findAssessmentRecord(UUID assessmentRecordId) {
        return jdbcTemplate.query("""
                        select id, term_id, portfolio_id, rubric_version_id, status, version, created_by_account_id, created_at, updated_at
                        from assessment_records where id = ?
                        """, resultSet -> resultSet.next() ? Optional.of(assessmentRecord(resultSet)) : Optional.empty(), assessmentRecordId);
    }

    @Override
    public List<AssessmentRecord> findAssessmentRecords(UUID termId) {
        return jdbcTemplate.query("""
                        select id, term_id, portfolio_id, rubric_version_id, status, version, created_by_account_id, created_at, updated_at
                        from assessment_records where term_id = ? order by updated_at desc, id
                        """, (resultSet, rowNumber) -> assessmentRecord(resultSet), termId);
    }

    @Override
    public AssessmentScore addScore(UUID id, UUID assessmentRecordId, UUID dimensionId, UUID scorerAccountId,
                                    String sourceRole, BigDecimal score, String comment) {
        jdbcTemplate.update("""
                insert into assessment_scores
                    (id, assessment_record_id, rubric_dimension_id, scorer_account_id, source_role, score, comment)
                values (?, ?, ?, ?, ?, ?, ?)
                """, id, assessmentRecordId, dimensionId, scorerAccountId, sourceRole, score, comment);
        jdbcTemplate.update("update assessment_records set version = version + 1, updated_at = current_timestamp where id = ?", assessmentRecordId);
        return jdbcTemplate.query("""
                        select id, rubric_dimension_id, scorer_account_id, source_role, score, comment, created_at
                        from assessment_scores where id = ?
                        """, resultSet -> {
            if (!resultSet.next()) throw new EmptyResultDataAccessException(1);
            return score(resultSet);
        }, id);
    }

    @Override
    public AssessmentRecord markAssessorSubmitted(UUID assessmentRecordId, UUID assessorAccountId, String sourceRole,
                                                  AssessmentRecordStatus status) {
        var changed = jdbcTemplate.update("""
                update assessment_assessor_grants set submitted_at = current_timestamp
                where assessment_record_id = ? and assessor_account_id = ? and source_role = ? and submitted_at is null
                """, assessmentRecordId, assessorAccountId, sourceRole);
        if (changed != 1) {
            throw new EmptyResultDataAccessException(1);
        }
        jdbcTemplate.update("""
                update assessment_records set status = ?, version = version + 1, updated_at = current_timestamp where id = ?
                """, status.name(), assessmentRecordId);
        return findAssessmentRecord(assessmentRecordId).orElseThrow();
    }

    @Override
    public Optional<AssessmentResult> lockResult(UUID resultId) {
        return jdbcTemplate.query(resultSql("where id = ? for update"),
                resultSet -> resultSet.next() ? Optional.of(assessmentResult(resultSet)) : Optional.empty(), resultId);
    }

    @Override
    public Optional<AssessmentResult> findResult(UUID resultId) {
        return jdbcTemplate.query(resultSql("where id = ?"),
                resultSet -> resultSet.next() ? Optional.of(assessmentResult(resultSet)) : Optional.empty(), resultId);
    }

    @Override
    public boolean isCurrentPublishedResult(AssessmentResult result) {
        return Boolean.TRUE.equals(jdbcTemplate.query("""
                        select exists(
                            select 1 from assessment_result_versions
                            where root_result_id = ? and status = 'PUBLISHED'
                            group by root_result_id having max(result_revision) = ?
                        )
                        """, resultSet -> resultSet.next() && resultSet.getBoolean(1),
                result.rootResultId(), result.resultRevision()));
    }

    @Override
    public List<AssessmentResult> findResults(UUID termId) {
        return jdbcTemplate.query(resultSql("where term_id = ? order by published_at desc nulls last, created_at desc"),
                (resultSet, rowNumber) -> assessmentResult(resultSet), termId);
    }

    @Override
    public List<AssessmentResult> findCurrentPublishedResultsForAccount(UUID accountId) {
        return jdbcTemplate.query("""
                        select r.id, r.root_result_id, r.previous_result_id, r.assessment_record_id, r.term_id, r.portfolio_id,
                               r.result_revision, r.suggested_score, r.final_score, r.status, r.correction_reason, r.version,
                               r.published_by_account_id, r.published_at, r.created_at, r.updated_at
                        from assessment_result_versions r
                        join assessment_portfolios p on p.id = r.portfolio_id
                        where r.status = 'PUBLISHED'
                          and (p.student_account_id = ? or exists (
                              select 1 from gov_term_memberships m
                              where m.term_id = p.term_id and m.team_id = p.team_id
                                and m.account_id = ? and m.status = 'ACTIVE'
                          ))
                          and r.result_revision = (
                              select max(current_version.result_revision)
                              from assessment_result_versions current_version
                              where current_version.root_result_id = r.root_result_id and current_version.status = 'PUBLISHED'
                          )
                        order by r.published_at desc, r.id
                        """, (resultSet, rowNumber) -> assessmentResult(resultSet), accountId, accountId);
    }

    @Override
    public AssessmentResult publishResult(UUID resultId, UUID actorId, BigDecimal suggestedScore,
                                          BigDecimal finalScore, long expectedVersion) {
        var updated = jdbcTemplate.update("""
                update assessment_result_versions
                set suggested_score = ?, final_score = ?, status = 'PUBLISHED', published_by_account_id = ?,
                    published_at = current_timestamp, version = version + 1, updated_at = current_timestamp
                where id = ? and status = 'DRAFT' and version = ?
                """, suggestedScore, finalScore, actorId, resultId, expectedVersion);
        if (updated != 1) {
            throw new EmptyResultDataAccessException(1);
        }
        return findResult(resultId).orElseThrow();
    }

    @Override
    public AssessmentResult createCorrection(UUID id, AssessmentResult previous, UUID actorId,
                                             BigDecimal finalScore, String reason) {
        jdbcTemplate.update("""
                insert into assessment_result_versions
                    (id, root_result_id, previous_result_id, assessment_record_id, term_id, portfolio_id,
                     result_revision, suggested_score, final_score, status, correction_reason,
                     published_by_account_id, published_at)
                values (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PUBLISHED', ?, ?, current_timestamp)
                """, id, previous.rootResultId(), previous.id(), previous.assessmentRecordId(), previous.termId(),
                previous.portfolioId(), previous.resultRevision() + 1, previous.suggestedScore(), finalScore, reason, actorId);
        return findResult(id).orElseThrow();
    }

    private Portfolio portfolio(ResultSet resultSet) throws java.sql.SQLException {
        var id = resultSet.getObject("id", UUID.class);
        return new Portfolio(id, resultSet.getObject("term_id", UUID.class), resultSet.getString("scope_type"),
                resultSet.getObject("student_account_id", UUID.class), resultSet.getObject("team_id", UUID.class),
                PortfolioStatus.valueOf(resultSet.getString("status")), resultSet.getString("manifest"),
                resultSet.getLong("version"), resultSet.getObject("created_by_account_id", UUID.class),
                resultSet.getObject("generated_by_account_id", UUID.class), resultSet.getObject("generated_at", OffsetDateTime.class),
                resultSet.getObject("published_by_account_id", UUID.class), resultSet.getObject("published_at", OffsetDateTime.class),
                resultSet.getObject("created_at", OffsetDateTime.class), resultSet.getObject("updated_at", OffsetDateTime.class),
                portfolioSources(id));
    }

    private List<PortfolioSourceSnapshot> portfolioSources(UUID portfolioId) {
        return jdbcTemplate.query("""
                        select id, source_type, source_id, source_version, snapshot
                        from assessment_portfolio_membership_snapshots where portfolio_id = ?
                        order by source_type, source_id
                        """, (resultSet, rowNumber) -> new PortfolioSourceSnapshot(resultSet.getObject("id", UUID.class),
                resultSet.getString("source_type"), resultSet.getObject("source_id", UUID.class),
                resultSet.getObject("source_version", Long.class), resultSet.getString("snapshot")), portfolioId);
    }

    private PortfolioSourceSnapshot source(String type, UUID sourceId, Long sourceVersion, Map<String, Object> snapshot) {
        return new PortfolioSourceSnapshot(UUID.randomUUID(), type, sourceId, sourceVersion, json(snapshot));
    }

    private Map<String, Object> snapshot(Object... entries) {
        var result = new java.util.LinkedHashMap<String, Object>();
        for (int index = 0; index < entries.length; index += 2) {
            result.put((String) entries[index], entries[index + 1]);
        }
        return result;
    }

    private AssessmentRecord assessmentRecord(ResultSet resultSet) throws java.sql.SQLException {
        var id = resultSet.getObject("id", UUID.class);
        return new AssessmentRecord(id, resultSet.getObject("term_id", UUID.class), resultSet.getObject("portfolio_id", UUID.class),
                resultSet.getObject("rubric_version_id", UUID.class), AssessmentRecordStatus.valueOf(resultSet.getString("status")),
                resultSet.getLong("version"), resultSet.getObject("created_by_account_id", UUID.class),
                resultSet.getObject("created_at", OffsetDateTime.class), resultSet.getObject("updated_at", OffsetDateTime.class),
                grants(id), scores(id), resultId(id));
    }

    private List<AssessorGrant> grants(UUID assessmentRecordId) {
        return jdbcTemplate.query("""
                        select id, assessor_account_id, source_role, submitted_at
                        from assessment_assessor_grants where assessment_record_id = ? order by source_role, assessor_account_id
                        """, (resultSet, rowNumber) -> new AssessorGrant(resultSet.getObject("id", UUID.class),
                resultSet.getObject("assessor_account_id", UUID.class), resultSet.getString("source_role"),
                resultSet.getObject("submitted_at", OffsetDateTime.class)), assessmentRecordId);
    }

    private List<AssessmentScore> scores(UUID assessmentRecordId) {
        return jdbcTemplate.query("""
                        select id, rubric_dimension_id, scorer_account_id, source_role, score, comment, created_at
                        from assessment_scores where assessment_record_id = ? order by created_at, id
                        """, (resultSet, rowNumber) -> score(resultSet), assessmentRecordId);
    }

    private AssessmentScore score(ResultSet resultSet) throws java.sql.SQLException {
        return new AssessmentScore(resultSet.getObject("id", UUID.class), resultSet.getObject("rubric_dimension_id", UUID.class),
                resultSet.getObject("scorer_account_id", UUID.class), resultSet.getString("source_role"),
                resultSet.getBigDecimal("score"), resultSet.getString("comment"),
                resultSet.getObject("created_at", OffsetDateTime.class));
    }

    private UUID resultId(UUID assessmentRecordId) {
        return jdbcTemplate.query("""
                        select id from assessment_result_versions where assessment_record_id = ?
                        order by result_revision desc limit 1
                        """, resultSet -> resultSet.next() ? resultSet.getObject(1, UUID.class) : null, assessmentRecordId);
    }

    private String resultSql(String suffix) {
        return """
                select id, root_result_id, previous_result_id, assessment_record_id, term_id, portfolio_id,
                       result_revision, suggested_score, final_score, status, correction_reason, version,
                       published_by_account_id, published_at, created_at, updated_at
                from assessment_result_versions
                """ + suffix;
    }

    private AssessmentResult assessmentResult(ResultSet resultSet) throws java.sql.SQLException {
        return new AssessmentResult(resultSet.getObject("id", UUID.class), resultSet.getObject("root_result_id", UUID.class),
                resultSet.getObject("previous_result_id", UUID.class), resultSet.getObject("assessment_record_id", UUID.class),
                resultSet.getObject("term_id", UUID.class), resultSet.getObject("portfolio_id", UUID.class),
                resultSet.getInt("result_revision"), resultSet.getBigDecimal("suggested_score"),
                resultSet.getBigDecimal("final_score"), ResultStatus.valueOf(resultSet.getString("status")),
                resultSet.getString("correction_reason"), resultSet.getLong("version"),
                resultSet.getObject("published_by_account_id", UUID.class), resultSet.getObject("published_at", OffsetDateTime.class),
                resultSet.getObject("created_at", OffsetDateTime.class), resultSet.getObject("updated_at", OffsetDateTime.class));
    }

    private String json(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Portfolio source could not be serialized.", exception);
        }
    }

    @Override
    public void appendAudit(String eventType, String resourceType, UUID resourceId, UUID actorId,
                            Long previousVersion, Long newVersion) {
        jdbcTemplate.update("""
                insert into audit_events
                    (id, event_type, resource_type, resource_id, actor_account_id, previous_version, new_version, metadata)
                values (?, ?, ?, ?, ?, ?, ?, '{}'::jsonb)
                """, UUID.randomUUID(), eventType, resourceType, resourceId, actorId, previousVersion, newVersion);
    }

    private RubricVersion rubric(ResultSet resultSet) throws java.sql.SQLException {
        var id = resultSet.getObject("id", UUID.class);
        return new RubricVersion(id, resultSet.getObject("root_rubric_id", UUID.class), resultSet.getInt("rubric_revision"),
                resultSet.getObject("term_id", UUID.class), resultSet.getString("name"), resultSet.getBigDecimal("pass_score"),
                resultSet.getObject("effective_at", OffsetDateTime.class), RubricStatus.valueOf(resultSet.getString("status")),
                resultSet.getLong("version"), resultSet.getObject("created_by_account_id", UUID.class),
                resultSet.getObject("published_by_account_id", UUID.class), resultSet.getObject("published_at", OffsetDateTime.class),
                resultSet.getObject("created_at", OffsetDateTime.class), resultSet.getObject("updated_at", OffsetDateTime.class),
                dimensions(id));
    }

    private List<RubricDimension> dimensions(UUID rubricId) {
        return jdbcTemplate.query("""
                        select id, code, name, weight, max_score, display_order
                        from assessment_rubric_dimensions where rubric_version_id = ? order by display_order
                        """, (resultSet, rowNumber) -> {
            var dimensionId = resultSet.getObject("id", UUID.class);
            return new RubricDimension(dimensionId, resultSet.getString("code"), resultSet.getString("name"),
                    resultSet.getBigDecimal("weight"), resultSet.getBigDecimal("max_score"), resultSet.getInt("display_order"),
                    jdbcTemplate.queryForList("""
                            select scorer_role from assessment_rubric_dimension_scorer_roles
                            where rubric_dimension_id = ? order by scorer_role
                            """, String.class, dimensionId));
        }, rubricId);
    }

    private void saveDimensions(UUID rubricId, List<RubricDimension> dimensions) {
        for (RubricDimension dimension : dimensions) {
            jdbcTemplate.update("""
                    insert into assessment_rubric_dimensions
                        (id, rubric_version_id, code, name, weight, max_score, display_order)
                    values (?, ?, ?, ?, ?, ?, ?)
                    """, dimension.id(), rubricId, dimension.code(), dimension.name(), dimension.weight(),
                    dimension.maxScore(), dimension.displayOrder());
            for (String role : dimension.allowedScorerRoles()) {
                jdbcTemplate.update("""
                        insert into assessment_rubric_dimension_scorer_roles (rubric_dimension_id, scorer_role)
                        values (?, ?)
                        """, dimension.id(), role);
            }
        }
    }
}
