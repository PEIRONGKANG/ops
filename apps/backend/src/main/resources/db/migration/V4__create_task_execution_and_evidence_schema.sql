create table ops_task_completions (
    id uuid primary key,
    shift_id uuid not null references ops_shifts(id),
    assignment_id uuid not null references ops_shift_assignments(id),
    source_template_component_id uuid not null references gov_template_components(id),
    code varchar(64) not null,
    name varchar(128) not null,
    role_code varchar(64) not null,
    definition_snapshot jsonb not null,
    evidence_required boolean not null default false,
    p2_acceptance_required boolean not null default false,
    status varchar(16) not null check (status in ('PENDING', 'SUBMITTED', 'RETURNED', 'ACCEPTED', 'WITHDRAWN')),
    version bigint not null default 1 check (version > 0),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    unique (shift_id, assignment_id, source_template_component_id)
);

create index ops_task_completions_shift_assignment_idx on ops_task_completions (shift_id, assignment_id, status);

create table ops_task_completion_history (
    id uuid primary key,
    task_completion_id uuid not null references ops_task_completions(id),
    event_type varchar(64) not null,
    actor_account_id uuid not null references iam_accounts(id),
    reason varchar(500),
    previous_status varchar(16),
    next_status varchar(16) not null,
    previous_version bigint,
    new_version bigint not null,
    occurred_at timestamptz not null default current_timestamp
);

create index ops_task_completion_history_task_idx on ops_task_completion_history (task_completion_id, occurred_at desc);

create table ops_milestone_submissions (
    id uuid primary key,
    shift_id uuid not null references ops_shifts(id),
    source_template_component_id uuid not null references gov_template_components(id),
    code varchar(64) not null,
    name varchar(128) not null,
    definition_snapshot jsonb not null,
    required boolean not null default false,
    evidence_required boolean not null default false,
    status varchar(16) not null check (status in ('PENDING', 'SUBMITTED', 'RETURNED', 'APPROVED')),
    submitted_by_account_id uuid references iam_accounts(id),
    version bigint not null default 1 check (version > 0),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    unique (shift_id, source_template_component_id)
);

create index ops_milestone_submissions_shift_idx on ops_milestone_submissions (shift_id, status, required);

create table ops_milestone_decisions (
    id uuid primary key,
    milestone_submission_id uuid not null references ops_milestone_submissions(id),
    decision varchar(16) not null check (decision in ('SUBMITTED', 'RETURNED', 'APPROVED')),
    actor_account_id uuid not null references iam_accounts(id),
    reason varchar(500),
    previous_status varchar(16),
    next_status varchar(16) not null,
    previous_version bigint,
    new_version bigint not null,
    occurred_at timestamptz not null default current_timestamp
);

create index ops_milestone_decisions_submission_idx on ops_milestone_decisions (milestone_submission_id, occurred_at desc);

create table ops_evidence (
    id uuid primary key,
    shift_id uuid not null references ops_shifts(id),
    task_completion_id uuid references ops_task_completions(id),
    milestone_submission_id uuid references ops_milestone_submissions(id),
    kind varchar(32) not null check (kind in ('TEXT', 'EXTERNAL_LINK', 'OPERATING_SUMMARY_REFERENCE', 'OBJECT_REFERENCE')),
    text_content varchar(4000),
    external_url varchar(2048),
    reference_value varchar(1024),
    occurred_at timestamptz not null,
    submitted_by_account_id uuid not null references iam_accounts(id),
    version bigint not null default 1 check (version > 0),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    check ((task_completion_id is not null)::integer + (milestone_submission_id is not null)::integer = 1),
    check ((kind = 'TEXT' and text_content is not null)
        or (kind = 'EXTERNAL_LINK' and external_url is not null)
        or (kind in ('OPERATING_SUMMARY_REFERENCE', 'OBJECT_REFERENCE') and reference_value is not null))
);

create index ops_evidence_task_idx on ops_evidence (task_completion_id, created_at desc);
create index ops_evidence_milestone_idx on ops_evidence (milestone_submission_id, created_at desc);
