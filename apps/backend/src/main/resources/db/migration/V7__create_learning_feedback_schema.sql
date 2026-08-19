create unique index learning_template_version_scope_unique
    on gov_template_versions (id, term_id, store_id);

create unique index learning_template_component_version_unique
    on gov_template_components (id, template_version_id);

create table learning_feedback (
    id uuid primary key,
    term_id uuid not null references gov_terms(id),
    store_id uuid not null references gov_stores(id),
    student_account_id uuid not null references iam_accounts(id),
    shift_id uuid not null references ops_shifts(id),
    task_completion_id uuid references ops_task_completions(id),
    incident_id uuid references ops_incidents(id),
    evidence_id uuid references ops_evidence(id),
    observation varchar(2000) not null,
    recommendation varchar(2000) not null,
    requires_retraining boolean not null default false,
    retraining_due_at timestamptz,
    status varchar(16) not null check (status in ('OPEN', 'CLOSED')),
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    check (not requires_retraining or retraining_due_at is not null)
);

create unique index learning_feedback_identity_scope_unique
    on learning_feedback (id, term_id, store_id, student_account_id);

create or replace function validate_learning_feedback_references() returns trigger as $$
begin
    if not exists (
        select 1 from ops_shifts s
        join ops_operating_days d on d.id = s.operating_day_id
        where s.id = new.shift_id and d.term_id = new.term_id and d.store_id = new.store_id
    ) then
        raise exception 'Feedback shift is outside the feedback term or store.';
    end if;
    if new.task_completion_id is not null and not exists (
        select 1 from ops_task_completions t
        join ops_shift_assignments a on a.id = t.assignment_id
        where t.id = new.task_completion_id and t.shift_id = new.shift_id and a.account_id = new.student_account_id
    ) then
        raise exception 'Feedback task completion is not in the feedback shift or assigned to the student.';
    end if;
    if new.incident_id is not null and not exists (
        select 1 from ops_incidents i where i.id = new.incident_id and i.shift_id = new.shift_id
          and (i.reported_by_account_id = new.student_account_id or i.assignee_account_id = new.student_account_id)
    ) then
        raise exception 'Feedback incident is not in the feedback shift or related to the student.';
    end if;
    if new.evidence_id is not null and not exists (
        select 1 from ops_evidence e
        left join ops_task_completions t on t.id = e.task_completion_id
        left join ops_shift_assignments a on a.id = t.assignment_id
        where e.id = new.evidence_id and e.shift_id = new.shift_id
          and coalesce(a.account_id, e.submitted_by_account_id) = new.student_account_id
    ) then
        raise exception 'Feedback evidence is not in the feedback shift or related to the student.';
    end if;
    return new;
end;
$$ language plpgsql;

create trigger learning_feedback_reference_consistency
before insert or update of shift_id, student_account_id, task_completion_id, incident_id, evidence_id
on learning_feedback for each row execute function validate_learning_feedback_references();

create index learning_feedback_student_idx on learning_feedback (student_account_id, created_at desc);
create index learning_feedback_scope_idx on learning_feedback (term_id, store_id, created_at desc);

create table learning_feedback_history (
    id uuid primary key,
    feedback_id uuid not null references learning_feedback(id),
    event_type varchar(64) not null,
    actor_account_id uuid not null references iam_accounts(id),
    reason varchar(2000),
    previous_version bigint,
    new_version bigint not null,
    occurred_at timestamptz not null default current_timestamp
);

create index learning_feedback_history_feedback_idx on learning_feedback_history (feedback_id, occurred_at desc);

create table learning_retraining (
    id uuid primary key,
    feedback_id uuid not null unique,
    term_id uuid not null,
    store_id uuid not null,
    student_account_id uuid not null,
    status varchar(32) not null check (status in ('PENDING', 'SUBMITTED', 'RETEST_PENDING', 'PASSED', 'RETRAIN_REQUIRED')),
    due_at timestamptz,
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    foreign key (feedback_id, term_id, store_id, student_account_id)
        references learning_feedback (id, term_id, store_id, student_account_id)
);

create index learning_retraining_student_idx on learning_retraining (student_account_id, status, due_at);
create index learning_retraining_scope_idx on learning_retraining (term_id, store_id, status);

create table learning_retraining_evidence_relations (
    id uuid primary key,
    retraining_id uuid not null references learning_retraining(id),
    evidence_id uuid not null references ops_evidence(id),
    linked_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    unique (retraining_id, evidence_id)
);

create or replace function validate_retraining_evidence_relation() returns trigger as $$
begin
    if not exists (
        select 1
        from learning_retraining r
        join ops_evidence e on e.id = new.evidence_id
        join ops_shifts s on s.id = e.shift_id
        join ops_operating_days d on d.id = s.operating_day_id
        left join ops_task_completions t on t.id = e.task_completion_id
        left join ops_shift_assignments a on a.id = t.assignment_id
        where r.id = new.retraining_id and d.term_id = r.term_id and d.store_id = r.store_id
          and e.submitted_by_account_id = r.student_account_id
          and coalesce(a.account_id, e.submitted_by_account_id) = r.student_account_id
    ) then
        raise exception 'Retraining evidence is outside the retraining student or scope.';
    end if;
    return new;
end;
$$ language plpgsql;

create trigger learning_retraining_evidence_consistency
before insert or update of retraining_id, evidence_id on learning_retraining_evidence_relations
for each row execute function validate_retraining_evidence_relation();

create index learning_retraining_evidence_idx on learning_retraining_evidence_relations (retraining_id, created_at desc);

create table learning_retraining_actions (
    id uuid primary key,
    retraining_id uuid not null references learning_retraining(id),
    event_type varchar(64) not null,
    actor_account_id uuid not null references iam_accounts(id),
    reason varchar(2000),
    previous_status varchar(32),
    next_status varchar(32) not null,
    previous_version bigint,
    new_version bigint not null,
    occurred_at timestamptz not null default current_timestamp
);

create index learning_retraining_actions_retraining_idx on learning_retraining_actions (retraining_id, occurred_at desc);

create table learning_retraining_retests (
    id uuid primary key,
    retraining_id uuid not null references learning_retraining(id),
    passed boolean not null,
    result varchar(2000) not null,
    recorded_by_account_id uuid not null references iam_accounts(id),
    occurred_at timestamptz not null default current_timestamp
);

create index learning_retraining_retests_retraining_idx on learning_retraining_retests (retraining_id, occurred_at desc);

create table learning_certifications (
    id uuid primary key,
    term_id uuid not null,
    store_id uuid not null,
    student_account_id uuid not null references iam_accounts(id),
    template_version_id uuid not null,
    certification_rule_id uuid not null,
    rule_snapshot jsonb not null,
    note varchar(2000),
    status varchar(32) not null check (status in ('PENDING', 'CERTIFIED', 'NOT_CERTIFIED')),
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    foreign key (template_version_id, term_id, store_id)
        references gov_template_versions (id, term_id, store_id),
    foreign key (certification_rule_id, template_version_id)
        references gov_template_components (id, template_version_id),
    check ((rule_snapshot ->> 'id')::uuid = certification_rule_id),
    check (jsonb_typeof(rule_snapshot -> 'configuration') = 'object')
);

create or replace function validate_learning_certification_rule() returns trigger as $$
begin
    if not exists (
        select 1 from gov_template_components c
        where c.id = new.certification_rule_id and c.template_version_id = new.template_version_id
          and c.component_type = 'CERTIFICATION_RULE'
    ) then
        raise exception 'Certification rule is not a certification component of the selected template.';
    end if;
    return new;
end;
$$ language plpgsql;

create trigger learning_certification_rule_consistency
before insert or update of template_version_id, certification_rule_id on learning_certifications
for each row execute function validate_learning_certification_rule();

create index learning_certifications_student_idx on learning_certifications (student_account_id, status, created_at desc);
create index learning_certifications_scope_idx on learning_certifications (term_id, store_id, created_at desc);

create table learning_certification_evidence_relations (
    id uuid primary key,
    certification_id uuid not null references learning_certifications(id),
    evidence_id uuid not null references ops_evidence(id),
    linked_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    unique (certification_id, evidence_id)
);

create or replace function validate_certification_evidence_relation() returns trigger as $$
begin
    if not exists (
        select 1
        from learning_certifications c
        join ops_evidence e on e.id = new.evidence_id
        join ops_shifts s on s.id = e.shift_id
        join ops_operating_days d on d.id = s.operating_day_id
        left join ops_task_completions t on t.id = e.task_completion_id
        left join ops_shift_assignments a on a.id = t.assignment_id
        where c.id = new.certification_id and d.term_id = c.term_id and d.store_id = c.store_id
          and coalesce(a.account_id, e.submitted_by_account_id) = c.student_account_id
    ) then
        raise exception 'Certification evidence is outside the certification student or scope.';
    end if;
    return new;
end;
$$ language plpgsql;

create trigger learning_certification_evidence_consistency
before insert or update of certification_id, evidence_id on learning_certification_evidence_relations
for each row execute function validate_certification_evidence_relation();

create table learning_certification_decisions (
    id uuid primary key,
    certification_id uuid not null unique references learning_certifications(id),
    approved boolean not null,
    reason varchar(2000) not null,
    decided_by_account_id uuid not null references iam_accounts(id),
    retraining_id uuid references learning_retraining(id),
    previous_version bigint not null,
    new_version bigint not null,
    decided_at timestamptz not null default current_timestamp
);

create or replace function validate_certification_decision_retest() returns trigger as $$
begin
    if new.retraining_id is not null and not exists (
        select 1
        from learning_certifications c
        join learning_retraining r on r.id = new.retraining_id
        where c.id = new.certification_id
          and r.status = 'PASSED'
          and r.term_id = c.term_id
          and r.store_id = c.store_id
          and r.student_account_id = c.student_account_id
    ) then
        raise exception 'Certification retest is outside the certification student or scope.';
    end if;
    return new;
end;
$$ language plpgsql;

create trigger learning_certification_decision_retest_consistency
before insert or update of certification_id, retraining_id on learning_certification_decisions
for each row execute function validate_certification_decision_retest();

create index learning_certification_decisions_certification_idx
    on learning_certification_decisions (certification_id, decided_at desc);

create table learning_certification_history (
    id uuid primary key,
    certification_id uuid not null references learning_certifications(id),
    event_type varchar(64) not null,
    actor_account_id uuid not null references iam_accounts(id),
    reason varchar(2000),
    previous_status varchar(32),
    next_status varchar(32) not null,
    previous_version bigint,
    new_version bigint not null,
    occurred_at timestamptz not null default current_timestamp
);

create index learning_certification_history_certification_idx on learning_certification_history (certification_id, occurred_at desc);
