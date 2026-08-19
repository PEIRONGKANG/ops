create table ops_scope_grants (
    id uuid primary key,
    term_id uuid not null references gov_terms(id),
    store_id uuid not null references gov_stores(id),
    account_id uuid not null references iam_accounts(id),
    role_code varchar(32) not null check (role_code in ('P1', 'P2', 'T1')),
    effective_from timestamptz not null default current_timestamp,
    effective_until timestamptz,
    revoked_at timestamptz,
    granted_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    check (effective_until is null or effective_until > effective_from)
);

create unique index ops_scope_grants_active_unique
    on ops_scope_grants (term_id, store_id, account_id, role_code)
    where revoked_at is null;

create index ops_scope_grants_lookup_idx
    on ops_scope_grants (account_id, role_code, term_id, store_id)
    where revoked_at is null;

create table ops_operating_days (
    id uuid primary key,
    term_id uuid not null references gov_terms(id),
    store_id uuid not null references gov_stores(id),
    operating_date date not null,
    template_version_id uuid not null references gov_template_versions(id),
    template_revision integer not null check (template_revision > 0),
    template_snapshot jsonb not null,
    status varchar(16) not null check (status in ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'KEY_APPROVAL_PENDING', 'CLOSED', 'CANCELLED', 'REOPENED')),
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    unique (store_id, operating_date)
);

create index ops_operating_days_term_store_idx on ops_operating_days (term_id, store_id, operating_date desc);

create table ops_shifts (
    id uuid primary key,
    operating_day_id uuid not null references ops_operating_days(id),
    code varchar(64) not null,
    name varchar(128) not null,
    starts_at timestamptz not null,
    ends_at timestamptz not null,
    status varchar(32) not null check (status in ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'KEY_APPROVAL_PENDING', 'CLOSED', 'CANCELLED', 'REOPENED')),
    cancellation_reason varchar(500),
    version bigint not null default 1 check (version > 0),
    created_by_account_id uuid not null references iam_accounts(id),
    scheduled_by_account_id uuid references iam_accounts(id),
    started_by_account_id uuid references iam_accounts(id),
    closed_by_account_id uuid references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    check (ends_at > starts_at),
    check ((status = 'CANCELLED' and cancellation_reason is not null) or (status <> 'CANCELLED')),
    unique (operating_day_id, code)
);

create index ops_shifts_operating_day_idx on ops_shifts (operating_day_id, starts_at);

create table ops_shift_assignments (
    id uuid primary key,
    shift_id uuid not null references ops_shifts(id),
    account_id uuid not null references iam_accounts(id),
    role_code varchar(64) not null,
    status varchar(16) not null check (status in ('ASSIGNED', 'CANCELLED')),
    assignment_reason varchar(500),
    version bigint not null default 1 check (version > 0),
    assigned_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp
);

create index ops_shift_assignments_account_idx on ops_shift_assignments (account_id, status);

create unique index ops_shift_assignments_active_role_unique
    on ops_shift_assignments (shift_id, account_id, role_code)
    where status = 'ASSIGNED';

create table ops_assignment_change_history (
    id uuid primary key,
    assignment_id uuid not null references ops_shift_assignments(id),
    event_type varchar(64) not null,
    actor_account_id uuid not null references iam_accounts(id),
    reason varchar(500),
    previous_version bigint,
    new_version bigint,
    occurred_at timestamptz not null default current_timestamp
);

create index ops_assignment_change_history_assignment_idx
    on ops_assignment_change_history (assignment_id, occurred_at desc);

create table ops_shift_state_history (
    id uuid primary key,
    shift_id uuid not null references ops_shifts(id),
    from_status varchar(32),
    to_status varchar(32) not null,
    actor_account_id uuid not null references iam_accounts(id),
    reason varchar(500),
    previous_version bigint,
    new_version bigint not null,
    occurred_at timestamptz not null default current_timestamp
);

create index ops_shift_state_history_shift_idx on ops_shift_state_history (shift_id, occurred_at desc);
