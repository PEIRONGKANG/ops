create table learning_teaching_materials (
    id uuid primary key,
    term_id uuid not null references gov_terms(id),
    teaching_week_id uuid not null references gov_teaching_weeks(id),
    title varchar(200) not null,
    content jsonb not null,
    status varchar(16) not null check (status in ('DRAFT', 'PUBLISHED')),
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    published_by_account_id uuid references iam_accounts(id),
    published_at timestamptz,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    unique (id, term_id)
);

create table learning_material_acknowledgements (
    id uuid primary key,
    material_id uuid not null references learning_teaching_materials(id),
    term_id uuid not null references gov_terms(id),
    student_account_id uuid not null references iam_accounts(id),
    acknowledged_at timestamptz not null default current_timestamp,
    unique (material_id, student_account_id),
    foreign key (material_id, term_id) references learning_teaching_materials(id, term_id)
);

create index learning_materials_term_idx on learning_teaching_materials (term_id, status, updated_at desc);

create table learning_course_tasks (
    id uuid primary key,
    term_id uuid not null references gov_terms(id),
    teaching_week_id uuid not null references gov_teaching_weeks(id),
    title varchar(200) not null,
    instructions varchar(4000) not null,
    scope_type varchar(16) not null check (scope_type in ('INDIVIDUAL', 'TEAM')),
    status varchar(16) not null check (status in ('DRAFT', 'PUBLISHED')),
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    published_by_account_id uuid references iam_accounts(id),
    published_at timestamptz,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    unique (id, term_id)
);

create table learning_course_task_submissions (
    id uuid primary key,
    task_id uuid not null references learning_course_tasks(id),
    term_id uuid not null references gov_terms(id),
    student_account_id uuid not null references iam_accounts(id),
    team_id uuid references gov_teams(id),
    revision integer not null check (revision > 0),
    content jsonb not null,
    status varchar(16) not null check (status in ('SUBMITTED', 'RETURNED')),
    created_at timestamptz not null default current_timestamp,
    unique (task_id, student_account_id, revision),
    foreign key (task_id, term_id) references learning_course_tasks(id, term_id)
);

create index learning_course_task_submissions_scope_idx
    on learning_course_task_submissions (task_id, student_account_id, revision desc);

create table learning_creative_works (
    id uuid primary key,
    term_id uuid not null references gov_terms(id),
    team_id uuid not null references gov_teams(id),
    teaching_week_id uuid not null references gov_teaching_weeks(id),
    title varchar(200) not null,
    status varchar(16) not null check (status in ('DRAFT', 'PUBLISHED')),
    current_revision integer not null default 1 check (current_revision > 0),
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    published_by_account_id uuid references iam_accounts(id),
    published_at timestamptz,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    unique (id, term_id, team_id)
);

create table learning_creative_work_versions (
    id uuid primary key,
    creative_work_id uuid not null references learning_creative_works(id),
    term_id uuid not null references gov_terms(id),
    team_id uuid not null references gov_teams(id),
    revision integer not null check (revision > 0),
    content jsonb not null,
    created_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    unique (creative_work_id, revision),
    foreign key (creative_work_id, term_id, team_id)
        references learning_creative_works(id, term_id, team_id)
);

create table learning_creative_work_feedback (
    id uuid primary key,
    creative_work_id uuid not null references learning_creative_works(id),
    work_revision integer not null,
    teacher_account_id uuid not null references iam_accounts(id),
    comment varchar(4000) not null,
    created_at timestamptz not null default current_timestamp
);

create index learning_creative_work_scope_idx on learning_creative_works (term_id, team_id, status, updated_at desc);

create table learning_reflections (
    id uuid primary key,
    term_id uuid not null references gov_terms(id),
    teaching_week_id uuid not null references gov_teaching_weeks(id),
    student_account_id uuid not null references iam_accounts(id),
    content varchar(4000) not null,
    improvement_plan varchar(4000) not null,
    status varchar(16) not null check (status in ('DRAFT', 'SUBMITTED')),
    version bigint not null default 1 check (version > 0),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    unique (id, term_id, student_account_id)
);

create index learning_reflections_student_idx on learning_reflections (student_account_id, updated_at desc);

create or replace function validate_course_term_week() returns trigger as $$
begin
    if not exists (select 1 from gov_teaching_weeks w where w.id = new.teaching_week_id and w.term_id = new.term_id) then
        raise exception 'Course resource week is outside its term.';
    end if;
    return new;
end;
$$ language plpgsql;

create trigger teaching_material_term_week_consistency
before insert or update of term_id, teaching_week_id on learning_teaching_materials
for each row execute function validate_course_term_week();

create trigger course_task_term_week_consistency
before insert or update of term_id, teaching_week_id on learning_course_tasks
for each row execute function validate_course_term_week();

create trigger reflection_term_week_consistency
before insert or update of term_id, teaching_week_id on learning_reflections
for each row execute function validate_course_term_week();

create or replace function validate_creative_work_team_scope() returns trigger as $$
begin
    if not exists (select 1 from gov_teams t where t.id = new.team_id and t.term_id = new.term_id) then
        raise exception 'Creative work team is outside its term.';
    end if;
    if not exists (select 1 from gov_teaching_weeks w where w.id = new.teaching_week_id and w.term_id = new.term_id) then
        raise exception 'Creative work week is outside its term.';
    end if;
    return new;
end;
$$ language plpgsql;

create trigger creative_work_scope_consistency
before insert or update of term_id, team_id, teaching_week_id on learning_creative_works
for each row execute function validate_creative_work_team_scope();

create or replace function validate_course_submission_scope() returns trigger as $$
begin
    if not exists (select 1 from learning_course_tasks t where t.id = new.task_id and t.term_id = new.term_id and t.status = 'PUBLISHED') then
        raise exception 'Course submission task is outside the submitted term or not published.';
    end if;
    if new.team_id is not null and not exists (select 1 from gov_teams t where t.id = new.team_id and t.term_id = new.term_id) then
        raise exception 'Course submission team is outside its term.';
    end if;
    return new;
end;
$$ language plpgsql;

create trigger course_submission_scope_consistency
before insert or update of task_id, term_id, team_id on learning_course_task_submissions
for each row execute function validate_course_submission_scope();
