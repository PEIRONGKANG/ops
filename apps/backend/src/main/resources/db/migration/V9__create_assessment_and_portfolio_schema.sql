create table assessment_rubric_versions (
    id uuid primary key,
    root_rubric_id uuid not null,
    rubric_revision integer not null check (rubric_revision > 0),
    term_id uuid not null references gov_terms(id),
    name varchar(200) not null,
    pass_score numeric(7, 2) not null check (pass_score >= 0 and pass_score <= 100),
    effective_at timestamptz not null,
    status varchar(16) not null check (status in ('DRAFT', 'PUBLISHED')),
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    published_by_account_id uuid references iam_accounts(id),
    published_at timestamptz,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    unique (id, term_id),
    unique (root_rubric_id, rubric_revision),
    foreign key (root_rubric_id) references assessment_rubric_versions(id)
);

create index assessment_rubric_versions_term_idx
    on assessment_rubric_versions (term_id, root_rubric_id, rubric_revision desc);

create table assessment_rubric_dimensions (
    id uuid primary key,
    rubric_version_id uuid not null references assessment_rubric_versions(id),
    code varchar(64) not null,
    name varchar(200) not null,
    weight numeric(7, 2) not null check (weight > 0 and weight <= 100),
    max_score numeric(7, 2) not null check (max_score > 0),
    display_order integer not null check (display_order > 0),
    unique (rubric_version_id, code),
    unique (rubric_version_id, display_order)
);

create table assessment_rubric_dimension_scorer_roles (
    rubric_dimension_id uuid not null references assessment_rubric_dimensions(id),
    scorer_role varchar(16) not null check (scorer_role in ('P2', 'T1')),
    primary key (rubric_dimension_id, scorer_role)
);

create table assessment_portfolios (
    id uuid primary key,
    term_id uuid not null references gov_terms(id),
    scope_type varchar(16) not null check (scope_type in ('STUDENT', 'TEAM')),
    student_account_id uuid references iam_accounts(id),
    team_id uuid references gov_teams(id),
    status varchar(24) not null check (status in ('DRAFT', 'GENERATED', 'PUBLISHED')),
    manifest jsonb not null default '{}'::jsonb,
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    generated_by_account_id uuid references iam_accounts(id),
    generated_at timestamptz,
    published_by_account_id uuid references iam_accounts(id),
    published_at timestamptz,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    check ((scope_type = 'STUDENT' and student_account_id is not null and team_id is null)
        or (scope_type = 'TEAM' and team_id is not null and student_account_id is null)),
    unique (id, term_id)
);

create index assessment_portfolios_scope_idx
    on assessment_portfolios (term_id, scope_type, student_account_id, team_id, status, updated_at desc);

create table assessment_portfolio_membership_snapshots (
    id uuid primary key,
    portfolio_id uuid not null references assessment_portfolios(id),
    source_type varchar(48) not null,
    source_id uuid not null,
    source_version bigint,
    snapshot jsonb not null,
    created_at timestamptz not null default current_timestamp,
    unique (portfolio_id, source_type, source_id)
);

create table assessment_records (
    id uuid primary key,
    term_id uuid not null references gov_terms(id),
    portfolio_id uuid not null references assessment_portfolios(id),
    rubric_version_id uuid not null references assessment_rubric_versions(id),
    status varchar(32) not null check (status in ('DRAFT', 'READY_FOR_PUBLICATION')),
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    unique (portfolio_id, rubric_version_id)
);

create index assessment_records_term_idx on assessment_records (term_id, status, updated_at desc);

create table assessment_assessor_grants (
    id uuid primary key,
    assessment_record_id uuid not null references assessment_records(id),
    assessor_account_id uuid not null references iam_accounts(id),
    source_role varchar(16) not null check (source_role in ('P2', 'T1')),
    submitted_at timestamptz,
    created_at timestamptz not null default current_timestamp,
    unique (assessment_record_id, assessor_account_id, source_role)
);

create table assessment_scores (
    id uuid primary key,
    assessment_record_id uuid not null references assessment_records(id),
    rubric_dimension_id uuid not null references assessment_rubric_dimensions(id),
    scorer_account_id uuid not null references iam_accounts(id),
    source_role varchar(16) not null check (source_role in ('P2', 'T1')),
    score numeric(7, 2) not null check (score >= 0),
    comment varchar(2000) not null,
    created_at timestamptz not null default current_timestamp,
    unique (assessment_record_id, rubric_dimension_id, scorer_account_id, source_role)
);

create index assessment_scores_record_idx on assessment_scores (assessment_record_id, rubric_dimension_id);

create table assessment_result_versions (
    id uuid primary key,
    root_result_id uuid not null,
    previous_result_id uuid references assessment_result_versions(id),
    assessment_record_id uuid not null references assessment_records(id),
    term_id uuid not null references gov_terms(id),
    portfolio_id uuid not null references assessment_portfolios(id),
    result_revision integer not null check (result_revision > 0),
    suggested_score numeric(7, 2),
    final_score numeric(7, 2),
    status varchar(16) not null check (status in ('DRAFT', 'PUBLISHED')),
    correction_reason varchar(2000),
    version bigint not null default 1 check (version > 0),
    published_by_account_id uuid references iam_accounts(id),
    published_at timestamptz,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    foreign key (root_result_id) references assessment_result_versions(id),
    unique (root_result_id, result_revision)
);

create index assessment_result_versions_term_idx
    on assessment_result_versions (term_id, portfolio_id, status, published_at desc);
