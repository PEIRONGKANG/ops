package com.beverageops.learning.infrastructure.persistence;

import java.sql.ResultSet;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import com.beverageops.learning.domain.model.CourseResourceStatus;
import com.beverageops.learning.domain.port.CoursePreparationRepository;
import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
class JdbcCoursePreparationRepository implements CoursePreparationRepository {

    private final JdbcTemplate jdbc;

    JdbcCoursePreparationRepository(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public boolean isActiveStudent(UUID termId, UUID accountId) {
        return exists("""
                select exists (select 1 from gov_term_memberships m
                  join iam_accounts a on a.id = m.account_id and a.status = 'ACTIVE'
                  where m.term_id = ? and m.account_id = ? and m.status = 'ACTIVE'
                    and exists (select 1 from iam_role_assignments r where r.account_id = m.account_id
                      and r.role_code = 'P3' and r.revoked_at is null))
                """, termId, accountId);
    }

    @Override
    public Optional<TeamMembership> findActiveTeamMembership(UUID termId, UUID accountId) {
        return jdbc.query("""
                select term_id, team_id from gov_term_memberships
                where term_id = ? and account_id = ? and status = 'ACTIVE' and team_id is not null
                """, rs -> rs.next() ? Optional.of(new TeamMembership(rs.getObject("term_id", UUID.class),
                rs.getObject("team_id", UUID.class))) : Optional.empty(), termId, accountId);
    }

    @Override
    public Optional<TeachingWeek> findTeachingWeek(UUID teachingWeekId) {
        return jdbc.query("select id, term_id, phase_code from gov_teaching_weeks where id = ?", rs -> rs.next()
                ? Optional.of(new TeachingWeek(rs.getObject("id", UUID.class), rs.getObject("term_id", UUID.class),
                rs.getString("phase_code"))) : Optional.empty(), teachingWeekId);
    }

    @Override
    public boolean hasTeacherMembership(UUID termId, UUID accountId) {
        return exists("""
                select exists (select 1 from gov_term_memberships m
                  join iam_role_assignments r on r.account_id = m.account_id and r.role_code = 'T1'
                  where m.term_id = ? and m.account_id = ? and m.status = 'ACTIVE' and r.revoked_at is null)
                """, termId, accountId);
    }

    @Override
    public TeachingMaterial createMaterial(UUID id, UUID termId, UUID teachingWeekId, String title, String contentJson,
                                           UUID actorId) {
        return jdbc.queryForObject("""
                insert into learning_teaching_materials (id, term_id, teaching_week_id, title, content, status, created_by_account_id)
                values (?, ?, ?, ?, ?::jsonb, 'DRAFT', ?)
                returning id, term_id, teaching_week_id, title, content::text, status, version, created_by_account_id, created_at, updated_at
                """, (rs, row) -> material(rs), id, termId, teachingWeekId, title, contentJson, actorId);
    }

    @Override
    public Optional<TeachingMaterial> lockMaterial(UUID materialId) {
        return jdbc.query(materialSelect() + " where id = ? for update", rs -> rs.next()
                ? Optional.of(material(rs)) : Optional.empty(), materialId);
    }

    @Override
    public Optional<TeachingMaterial> findMaterial(UUID materialId) {
        return jdbc.query(materialSelect() + " where id = ?", rs -> rs.next()
                ? Optional.of(material(rs)) : Optional.empty(), materialId);
    }

    @Override
    public TeachingMaterial updateMaterial(UUID materialId, String title, String contentJson, long expectedVersion) {
        return jdbc.queryForObject("""
                update learning_teaching_materials set title = ?, content = ?::jsonb, version = version + 1,
                    updated_at = current_timestamp where id = ? and status = 'DRAFT' and version = ?
                returning id, term_id, teaching_week_id, title, content::text, status, version, created_by_account_id, created_at, updated_at
                """, (rs, row) -> material(rs), title, contentJson, materialId, expectedVersion);
    }

    @Override
    public TeachingMaterial publishMaterial(UUID materialId, UUID actorId, long expectedVersion) {
        return jdbc.queryForObject("""
                update learning_teaching_materials set status = 'PUBLISHED', published_by_account_id = ?, published_at = current_timestamp,
                    version = version + 1, updated_at = current_timestamp where id = ? and status = 'DRAFT' and version = ?
                returning id, term_id, teaching_week_id, title, content::text, status, version, created_by_account_id, created_at, updated_at
                """, (rs, row) -> material(rs), actorId, materialId, expectedVersion);
    }

    @Override
    public void acknowledgeMaterial(UUID materialId, UUID termId, UUID studentAccountId) {
        jdbc.update("""
                insert into learning_material_acknowledgements (id, material_id, term_id, student_account_id)
                values (?, ?, ?, ?) on conflict (material_id, student_account_id) do nothing
                """, UUID.randomUUID(), materialId, termId, studentAccountId);
    }

    @Override
    public boolean isMaterialAcknowledged(UUID materialId, UUID studentAccountId) {
        return exists("select exists (select 1 from learning_material_acknowledgements where material_id = ? and student_account_id = ?)",
                materialId, studentAccountId);
    }

    @Override
    public List<TeachingMaterial> findMaterials(UUID termId, boolean publishedOnly) {
        var status = publishedOnly ? " and status = 'PUBLISHED'" : "";
        return jdbc.query(materialSelect() + " where term_id = ?" + status + " order by updated_at desc",
                (rs, row) -> material(rs), termId);
    }

    @Override
    public CourseTask createTask(UUID id, UUID termId, UUID teachingWeekId, String title, String instructions,
                                 String scopeType, UUID actorId) {
        return jdbc.queryForObject("""
                insert into learning_course_tasks (id, term_id, teaching_week_id, title, instructions, scope_type, status, created_by_account_id)
                values (?, ?, ?, ?, ?, ?, 'DRAFT', ?)
                returning id, term_id, teaching_week_id, title, instructions, scope_type, status, version, created_by_account_id, created_at, updated_at
                """, (rs, row) -> task(rs), id, termId, teachingWeekId, title, instructions, scopeType, actorId);
    }

    @Override
    public Optional<CourseTask> lockTask(UUID taskId) {
        return jdbc.query(taskSelect() + " where id = ? for update", rs -> rs.next() ? Optional.of(task(rs)) : Optional.empty(), taskId);
    }

    @Override
    public CourseTask updateTask(UUID taskId, String title, String instructions, String scopeType, long expectedVersion) {
        return jdbc.queryForObject("""
                update learning_course_tasks set title = ?, instructions = ?, scope_type = ?, version = version + 1,
                    updated_at = current_timestamp where id = ? and status = 'DRAFT' and version = ?
                returning id, term_id, teaching_week_id, title, instructions, scope_type, status, version, created_by_account_id, created_at, updated_at
                """, (rs, row) -> task(rs), title, instructions, scopeType, taskId, expectedVersion);
    }

    @Override
    public CourseTask publishTask(UUID taskId, UUID actorId, long expectedVersion) {
        return jdbc.queryForObject("""
                update learning_course_tasks set status = 'PUBLISHED', published_by_account_id = ?, published_at = current_timestamp,
                    version = version + 1, updated_at = current_timestamp where id = ? and status = 'DRAFT' and version = ?
                returning id, term_id, teaching_week_id, title, instructions, scope_type, status, version, created_by_account_id, created_at, updated_at
                """, (rs, row) -> task(rs), actorId, taskId, expectedVersion);
    }

    @Override
    public List<CourseTask> findTasks(UUID termId, boolean publishedOnly) {
        var status = publishedOnly ? " and status = 'PUBLISHED'" : "";
        return jdbc.query(taskSelect() + " where term_id = ?" + status + " order by updated_at desc", (rs, row) -> task(rs), termId);
    }

    @Override
    public int nextSubmissionRevision(UUID taskId, UUID studentAccountId) {
        return jdbc.queryForObject("select coalesce(max(revision), 0) + 1 from learning_course_task_submissions where task_id = ? and student_account_id = ?",
                Integer.class, taskId, studentAccountId);
    }

    @Override
    public CourseTaskSubmission createSubmission(UUID id, UUID taskId, UUID termId, UUID studentAccountId, UUID teamId,
                                                 int revision, String contentJson) {
        return jdbc.queryForObject("""
                insert into learning_course_task_submissions (id, task_id, term_id, student_account_id, team_id, revision, content, status)
                values (?, ?, ?, ?, ?, ?, ?::jsonb, 'SUBMITTED')
                returning id, task_id, term_id, student_account_id, team_id, revision, content::text, status, created_at
                """, (rs, row) -> submission(rs), id, taskId, termId, studentAccountId, teamId, revision, contentJson);
    }

    @Override
    public List<CourseTaskSubmission> findSubmissionsForStudent(UUID taskId, UUID studentAccountId) {
        return jdbc.query(submissionSelect() + " where task_id = ? and student_account_id = ? order by revision desc",
                (rs, row) -> submission(rs), taskId, studentAccountId);
    }

    @Override
    public List<CourseTaskSubmission> findSubmissionsForTeam(UUID taskId, UUID teamId) {
        return jdbc.query(submissionSelect() + " where task_id = ? and team_id = ? order by revision desc", (rs, row) -> submission(rs),
                taskId, teamId);
    }

    @Override
    public List<CourseTaskSubmission> findSubmissions(UUID taskId) {
        return jdbc.query(submissionSelect() + " where task_id = ? order by created_at desc", (rs, row) -> submission(rs), taskId);
    }

    @Override
    public CreativeWork createCreativeWork(UUID id, UUID termId, UUID teamId, UUID teachingWeekId, String title,
                                           String contentJson, UUID actorId) {
        jdbc.update("""
                insert into learning_creative_works (id, term_id, team_id, teaching_week_id, title, status, created_by_account_id)
                values (?, ?, ?, ?, ?, 'DRAFT', ?)
                """, id, termId, teamId, teachingWeekId, title, actorId);
        jdbc.update("""
                insert into learning_creative_work_versions (id, creative_work_id, term_id, team_id, revision, content, created_by_account_id)
                values (?, ?, ?, ?, 1, ?::jsonb, ?)
                """, UUID.randomUUID(), id, termId, teamId, contentJson, actorId);
        return findCreativeWork(id).orElseThrow();
    }

    @Override
    public Optional<CreativeWork> lockCreativeWork(UUID creativeWorkId) {
        return jdbc.query(workSelect() + " where w.id = ? for update of w",
                rs -> rs.next() ? Optional.of(work(rs)) : Optional.empty(), creativeWorkId);
    }

    @Override
    public Optional<CreativeWork> findCreativeWork(UUID creativeWorkId) {
        return jdbc.query(workSelect() + " where w.id = ?", rs -> rs.next() ? Optional.of(work(rs)) : Optional.empty(), creativeWorkId);
    }

    @Override
    public CreativeWork updateCreativeWork(UUID creativeWorkId, String title, String contentJson, UUID actorId,
                                           long expectedVersion) {
        var work = lockCreativeWork(creativeWorkId).orElseThrow();
        var nextRevision = work.currentRevision() + 1;
        var updated = jdbc.update("""
                update learning_creative_works set title = ?, current_revision = ?, version = version + 1, updated_at = current_timestamp
                where id = ? and status = 'DRAFT' and version = ?
                """, title, nextRevision, creativeWorkId, expectedVersion);
        if (updated != 1) throw new EmptyResultDataAccessException(1);
        jdbc.update("""
                insert into learning_creative_work_versions (id, creative_work_id, term_id, team_id, revision, content, created_by_account_id)
                values (?, ?, ?, ?, ?, ?::jsonb, ?)
                """, UUID.randomUUID(), work.id(), work.termId(), work.teamId(), nextRevision, contentJson, actorId);
        return findCreativeWork(creativeWorkId).orElseThrow();
    }

    @Override
    public CreativeWork publishCreativeWork(UUID creativeWorkId, UUID actorId, long expectedVersion) {
        var updated = jdbc.update("""
                update learning_creative_works set status = 'PUBLISHED', published_by_account_id = ?, published_at = current_timestamp,
                    version = version + 1, updated_at = current_timestamp where id = ? and status = 'DRAFT' and version = ?
                """, actorId, creativeWorkId, expectedVersion);
        if (updated != 1) throw new EmptyResultDataAccessException(1);
        return findCreativeWork(creativeWorkId).orElseThrow();
    }

    @Override
    public Optional<CreativeWorkVersion> findCreativeWorkVersion(UUID creativeWorkId, int revision) {
        return jdbc.query("""
                select id, creative_work_id, revision, content::text, created_by_account_id, created_at
                from learning_creative_work_versions where creative_work_id = ? and revision = ?
                """, rs -> rs.next() ? Optional.of(new CreativeWorkVersion(rs.getObject("id", UUID.class),
                rs.getObject("creative_work_id", UUID.class), rs.getInt("revision"), rs.getString("content"),
                rs.getObject("created_by_account_id", UUID.class), rs.getObject("created_at", OffsetDateTime.class))) : Optional.empty(),
                creativeWorkId, revision);
    }

    @Override
    public CreativeWorkFeedback addCreativeWorkFeedback(UUID id, UUID creativeWorkId, int workRevision, UUID teacherAccountId,
                                                        String comment) {
        return jdbc.queryForObject("""
                insert into learning_creative_work_feedback (id, creative_work_id, work_revision, teacher_account_id, comment)
                values (?, ?, ?, ?, ?) returning id, creative_work_id, work_revision, teacher_account_id, comment, created_at
                """, (rs, row) -> new CreativeWorkFeedback(rs.getObject("id", UUID.class), rs.getObject("creative_work_id", UUID.class),
                rs.getInt("work_revision"), rs.getObject("teacher_account_id", UUID.class), rs.getString("comment"),
                rs.getObject("created_at", OffsetDateTime.class)), id, creativeWorkId, workRevision, teacherAccountId, comment);
    }

    @Override
    public List<CreativeWorkFeedback> findCreativeWorkFeedback(UUID creativeWorkId) {
        return jdbc.query("""
                select id, creative_work_id, work_revision, teacher_account_id, comment, created_at
                from learning_creative_work_feedback where creative_work_id = ? order by created_at asc
                """, (rs, row) -> new CreativeWorkFeedback(rs.getObject("id", UUID.class),
                rs.getObject("creative_work_id", UUID.class), rs.getInt("work_revision"),
                rs.getObject("teacher_account_id", UUID.class), rs.getString("comment"),
                rs.getObject("created_at", OffsetDateTime.class)), creativeWorkId);
    }

    @Override
    public List<CreativeWork> findCreativeWorks(UUID termId, UUID teamId, boolean publishedOnly) {
        var team = teamId == null ? "" : " and w.team_id = ?";
        var status = publishedOnly ? " and w.status = 'PUBLISHED'" : "";
        if (teamId == null) return jdbc.query(workSelect() + " where w.term_id = ?" + status + " order by w.updated_at desc",
                (rs, row) -> work(rs), termId);
        return jdbc.query(workSelect() + " where w.term_id = ?" + team + status + " order by w.updated_at desc",
                (rs, row) -> work(rs), termId, teamId);
    }

    @Override
    public Reflection createReflection(UUID id, UUID termId, UUID teachingWeekId, UUID studentAccountId, String content,
                                       String improvementPlan) {
        return jdbc.queryForObject("""
                insert into learning_reflections (id, term_id, teaching_week_id, student_account_id, content, improvement_plan, status)
                values (?, ?, ?, ?, ?, ?, 'DRAFT')
                returning id, term_id, teaching_week_id, student_account_id, content, improvement_plan, status, version, created_at, updated_at
                """, (rs, row) -> reflection(rs), id, termId, teachingWeekId, studentAccountId, content, improvementPlan);
    }

    @Override
    public Optional<Reflection> lockReflection(UUID reflectionId) {
        return jdbc.query(reflectionSelect() + " where id = ? for update", rs -> rs.next() ? Optional.of(reflection(rs)) : Optional.empty(), reflectionId);
    }

    @Override
    public Reflection updateReflection(UUID reflectionId, String content, String improvementPlan, long expectedVersion) {
        return jdbc.queryForObject("""
                update learning_reflections set content = ?, improvement_plan = ?, version = version + 1, updated_at = current_timestamp
                where id = ? and status = 'DRAFT' and version = ?
                returning id, term_id, teaching_week_id, student_account_id, content, improvement_plan, status, version, created_at, updated_at
                """, (rs, row) -> reflection(rs), content, improvementPlan, reflectionId, expectedVersion);
    }

    @Override
    public List<Reflection> findReflectionsForStudent(UUID studentAccountId) {
        return jdbc.query(reflectionSelect() + " where student_account_id = ? order by updated_at desc", (rs, row) -> reflection(rs), studentAccountId);
    }

    @Override
    public void appendAudit(String eventType, String resourceType, UUID resourceId, UUID actorId, String reason,
                            Long previousVersion, Long newVersion) {
        jdbc.update("""
                insert into audit_events (id, event_type, resource_type, resource_id, actor_account_id, reason, previous_version, new_version)
                values (?, ?, ?, ?, ?, ?, ?, ?)
                """, UUID.randomUUID(), eventType, resourceType, resourceId, actorId, reason, previousVersion, newVersion);
    }

    private boolean exists(String sql, Object... args) {
        return Boolean.TRUE.equals(jdbc.queryForObject(sql, Boolean.class, args));
    }

    private TeachingMaterial material(ResultSet rs) throws java.sql.SQLException {
        return new TeachingMaterial(rs.getObject("id", UUID.class), rs.getObject("term_id", UUID.class),
                rs.getObject("teaching_week_id", UUID.class), rs.getString("title"), rs.getString("content"),
                CourseResourceStatus.valueOf(rs.getString("status")), rs.getLong("version"),
                rs.getObject("created_by_account_id", UUID.class), rs.getObject("created_at", OffsetDateTime.class),
                rs.getObject("updated_at", OffsetDateTime.class));
    }

    private CourseTask task(ResultSet rs) throws java.sql.SQLException {
        return new CourseTask(rs.getObject("id", UUID.class), rs.getObject("term_id", UUID.class), rs.getObject("teaching_week_id", UUID.class),
                rs.getString("title"), rs.getString("instructions"), rs.getString("scope_type"),
                CourseResourceStatus.valueOf(rs.getString("status")), rs.getLong("version"), rs.getObject("created_by_account_id", UUID.class),
                rs.getObject("created_at", OffsetDateTime.class), rs.getObject("updated_at", OffsetDateTime.class));
    }

    private CourseTaskSubmission submission(ResultSet rs) throws java.sql.SQLException {
        return new CourseTaskSubmission(rs.getObject("id", UUID.class), rs.getObject("task_id", UUID.class), rs.getObject("term_id", UUID.class),
                rs.getObject("student_account_id", UUID.class), rs.getObject("team_id", UUID.class), rs.getInt("revision"),
                rs.getString("content"), rs.getString("status"), rs.getObject("created_at", OffsetDateTime.class));
    }

    private CreativeWork work(ResultSet rs) throws java.sql.SQLException {
        return new CreativeWork(rs.getObject("id", UUID.class), rs.getObject("term_id", UUID.class), rs.getObject("team_id", UUID.class),
                rs.getObject("teaching_week_id", UUID.class), rs.getString("title"), rs.getString("current_content"),
                CourseResourceStatus.valueOf(rs.getString("status")),
                rs.getInt("current_revision"), rs.getLong("version"), rs.getObject("created_by_account_id", UUID.class),
                rs.getObject("created_at", OffsetDateTime.class), rs.getObject("updated_at", OffsetDateTime.class));
    }

    private Reflection reflection(ResultSet rs) throws java.sql.SQLException {
        return new Reflection(rs.getObject("id", UUID.class), rs.getObject("term_id", UUID.class), rs.getObject("teaching_week_id", UUID.class),
                rs.getObject("student_account_id", UUID.class), rs.getString("content"), rs.getString("improvement_plan"),
                rs.getString("status"), rs.getLong("version"), rs.getObject("created_at", OffsetDateTime.class), rs.getObject("updated_at", OffsetDateTime.class));
    }

    private String materialSelect() {
        return "select id, term_id, teaching_week_id, title, content::text, status, version, created_by_account_id, created_at, updated_at from learning_teaching_materials";
    }

    private String taskSelect() {
        return "select id, term_id, teaching_week_id, title, instructions, scope_type, status, version, created_by_account_id, created_at, updated_at from learning_course_tasks";
    }

    private String submissionSelect() {
        return "select id, task_id, term_id, student_account_id, team_id, revision, content::text, status, created_at from learning_course_task_submissions";
    }

    private String workSelect() {
        return "select w.id, w.term_id, w.team_id, w.teaching_week_id, w.title, v.content::text current_content, w.status, w.current_revision, w.version, w.created_by_account_id, w.created_at, w.updated_at from learning_creative_works w join learning_creative_work_versions v on v.creative_work_id = w.id and v.revision = w.current_revision";
    }

    private String reflectionSelect() {
        return "select id, term_id, teaching_week_id, student_account_id, content, improvement_plan, status, version, created_at, updated_at from learning_reflections";
    }
}
