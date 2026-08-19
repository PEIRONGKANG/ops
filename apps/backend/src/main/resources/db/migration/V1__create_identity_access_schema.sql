create table iam_accounts (
    id uuid primary key,
    login_id varchar(128) not null unique,
    display_name varchar(128) not null,
    status varchar(16) not null check (status in ('PENDING', 'ACTIVE', 'DISABLED')),
    password_hash varchar(255),
    must_change_password boolean not null default false,
    authorization_version bigint not null default 1 check (authorization_version > 0),
    last_login_at timestamptz,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    check ((status = 'PENDING' and password_hash is null) or (status <> 'PENDING' and password_hash is not null))
);

create table iam_role_assignments (
    id uuid primary key,
    account_id uuid not null references iam_accounts(id),
    role_code varchar(32) not null check (role_code in ('P1', 'P2', 'T1', 'P3', 'EXTERNAL_REVIEWER')),
    scope_type varchar(32),
    scope_id uuid,
    effective_from timestamptz not null default current_timestamp,
    effective_until timestamptz,
    granted_by_account_id uuid references iam_accounts(id),
    revoked_at timestamptz,
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    check (effective_until is null or effective_until > effective_from)
);

create unique index iam_role_assignments_active_unique
    on iam_role_assignments (account_id, role_code, coalesce(scope_type, ''), coalesce(scope_id::text, ''))
    where revoked_at is null;

create table iam_registration_requests (
    id uuid primary key,
    login_id varchar(128) not null,
    display_name varchar(128) not null,
    status varchar(16) not null check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    account_id uuid references iam_accounts(id),
    reviewed_by_account_id uuid references iam_accounts(id),
    reviewed_at timestamptz,
    review_reason varchar(500),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp
);

create unique index iam_registration_requests_pending_login_unique
    on iam_registration_requests (login_id) where status = 'PENDING';

create table iam_refresh_sessions (
    id uuid primary key,
    account_id uuid not null references iam_accounts(id),
    family_id uuid not null,
    token_hash varchar(128) not null unique,
    parent_session_id uuid references iam_refresh_sessions(id),
    authorization_version bigint not null,
    expires_at timestamptz not null,
    rotated_at timestamptz,
    revoked_at timestamptz,
    revoke_reason varchar(64),
    created_ip_hash varchar(128),
    user_agent_summary varchar(256),
    created_at timestamptz not null default current_timestamp,
    check (expires_at > created_at)
);

create index iam_refresh_sessions_account_idx on iam_refresh_sessions (account_id);
create index iam_refresh_sessions_family_idx on iam_refresh_sessions (family_id);

create table iam_auth_events (
    id uuid primary key,
    event_type varchar(64) not null,
    actor_account_id uuid references iam_accounts(id),
    subject_account_id uuid references iam_accounts(id),
    request_id varchar(64),
    ip_hash varchar(128),
    metadata jsonb not null default '{}'::jsonb,
    occurred_at timestamptz not null default current_timestamp
);

create index iam_auth_events_subject_idx on iam_auth_events (subject_account_id, occurred_at desc);

create table iam_login_throttle_windows (
    key_type varchar(16) not null check (key_type in ('LOGIN_ID', 'IP')),
    key_hash varchar(128) not null,
    failed_count integer not null check (failed_count >= 0),
    window_started_at timestamptz not null,
    blocked_until timestamptz,
    updated_at timestamptz not null default current_timestamp,
    primary key (key_type, key_hash)
);

create table iam_system_bootstrap (
    singleton boolean primary key default true check (singleton),
    bootstrap_p1_consumed_at timestamptz,
    bootstrap_account_id uuid references iam_accounts(id),
    created_at timestamptz not null default current_timestamp
);

insert into iam_system_bootstrap (singleton) values (true);
