create table gov_terms (
    id uuid primary key,
    code varchar(64) not null unique,
    name varchar(128) not null,
    start_date date not null,
    end_date date not null,
    status varchar(16) not null check (status in ('DRAFT', 'PUBLISHED', 'ARCHIVED')),
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    check (end_date >= start_date)
);

create table gov_stores (
    id uuid primary key,
    code varchar(64) not null unique,
    name varchar(128) not null,
    status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp
);

create table gov_teaching_weeks (
    id uuid primary key,
    term_id uuid not null references gov_terms(id),
    week_number integer not null check (week_number > 0),
    name varchar(128) not null,
    start_date date not null,
    end_date date not null,
    phase_code varchar(64),
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    check (end_date >= start_date),
    unique (term_id, week_number)
);

create table gov_teams (
    id uuid primary key,
    term_id uuid not null references gov_terms(id),
    code varchar(64) not null,
    name varchar(128) not null,
    status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    unique (term_id, code)
);

create table gov_term_memberships (
    id uuid primary key,
    term_id uuid not null references gov_terms(id),
    account_id uuid not null references iam_accounts(id),
    team_id uuid references gov_teams(id),
    status varchar(16) not null check (status in ('ACTIVE', 'INACTIVE')),
    effective_from timestamptz not null default current_timestamp,
    effective_until timestamptz,
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    deactivated_by_account_id uuid references iam_accounts(id),
    deactivated_at timestamptz,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    check (effective_until is null or effective_until > effective_from),
    unique (term_id, account_id)
);

create index gov_term_memberships_account_idx on gov_term_memberships (account_id, term_id, status);

create table gov_template_versions (
    id uuid primary key,
    term_id uuid not null references gov_terms(id),
    store_id uuid not null references gov_stores(id),
    template_code varchar(64) not null,
    template_revision integer not null check (template_revision > 0),
    name varchar(128) not null,
    status varchar(16) not null check (status in ('DRAFT', 'PUBLISHED', 'RETIRED')),
    effective_from date not null,
    effective_until date,
    configuration jsonb not null,
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    published_by_account_id uuid references iam_accounts(id),
    published_at timestamptz,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    check (effective_until is null or effective_until >= effective_from),
    unique (term_id, store_id, template_code, template_revision)
);

create index gov_template_versions_scope_idx
    on gov_template_versions (term_id, store_id, template_code, status, effective_from);

create table gov_template_revision_sequences (
    term_id uuid not null references gov_terms(id),
    store_id uuid not null references gov_stores(id),
    template_code varchar(64) not null,
    last_revision integer not null check (last_revision > 0),
    primary key (term_id, store_id, template_code)
);

create table gov_template_components (
    id uuid primary key,
    template_version_id uuid not null references gov_template_versions(id),
    component_type varchar(32) not null check (component_type in
        ('ROLE', 'SHIFT_DEFINITION', 'SOP_TASK', 'MILESTONE', 'INCIDENT_CATEGORY', 'CERTIFICATION_RULE', 'RUBRIC_DEFINITION')),
    code varchar(64) not null,
    name varchar(128) not null,
    configuration jsonb not null default '{}'::jsonb,
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    unique (template_version_id, component_type, code)
);

create index gov_template_components_template_idx
    on gov_template_components (template_version_id, component_type, code);

create table audit_events (
    id uuid primary key,
    event_type varchar(64) not null,
    resource_type varchar(64) not null,
    resource_id uuid not null,
    actor_account_id uuid references iam_accounts(id),
    reason varchar(500),
    previous_version bigint,
    new_version bigint,
    metadata jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default current_timestamp
);

create index audit_events_resource_idx on audit_events (resource_type, resource_id, occurred_at desc);
create index audit_events_actor_idx on audit_events (actor_account_id, occurred_at desc);
