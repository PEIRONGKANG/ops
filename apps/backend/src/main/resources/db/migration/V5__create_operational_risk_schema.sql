create table ops_operating_summaries (
    id uuid primary key,
    shift_id uuid not null references ops_shifts(id),
    source_system varchar(128) not null,
    collection_method varchar(64) not null,
    source_reference varchar(512) not null,
    collected_at timestamptz not null,
    summary_data jsonb not null default '{}'::jsonb,
    pending_supplement boolean not null default false,
    status varchar(32) not null check (status in ('PENDING_SUPPLEMENT', 'RECORDED', 'CONFIRMED')),
    note varchar(1000),
    collected_by_account_id uuid not null references iam_accounts(id),
    confirmed_by_account_id uuid references iam_accounts(id),
    version bigint not null default 1 check (version > 0),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp
);

create index ops_operating_summaries_shift_idx on ops_operating_summaries (shift_id, status, created_at desc);

create table ops_incidents (
    id uuid primary key,
    shift_id uuid not null references ops_shifts(id),
    category_code varchar(64) not null,
    severity varchar(16) not null check (severity in ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    blocking boolean not null default false,
    description varchar(2000) not null,
    status varchar(32) not null check (status in ('REPORTED', 'ACKNOWLEDGED', 'IN_PROGRESS', 'PENDING_VERIFICATION', 'CLOSED', 'REOPENED')),
    reported_by_account_id uuid not null references iam_accounts(id),
    assignee_account_id uuid references iam_accounts(id),
    due_at timestamptz,
    control_measure varchar(1000),
    verification_evidence_reference varchar(1024),
    version bigint not null default 1 check (version > 0),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp
);

create index ops_incidents_shift_idx on ops_incidents (shift_id, blocking, status);

create table ops_incident_actions (
    id uuid primary key,
    incident_id uuid not null references ops_incidents(id),
    action_type varchar(32) not null check (action_type in ('CONTROL_MEASURE', 'VERIFICATION', 'VERIFICATION_RETURN', 'REOPEN', 'BLOCKING_WAIVER')),
    content varchar(1000) not null,
    assignee_account_id uuid references iam_accounts(id),
    due_at timestamptz,
    recorded_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp
);

create index ops_incident_actions_incident_idx on ops_incident_actions (incident_id, created_at desc);

create table ops_incident_evidence_relations (
    id uuid primary key,
    incident_id uuid not null references ops_incidents(id),
    relation_type varchar(32) not null check (relation_type in ('VERIFICATION')),
    evidence_reference varchar(1024) not null,
    linked_by_account_id uuid not null references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    unique (incident_id, relation_type, evidence_reference)
);

create index ops_incident_evidence_relations_incident_idx
    on ops_incident_evidence_relations (incident_id, relation_type, created_at desc);

create table ops_incident_history (
    id uuid primary key,
    incident_id uuid not null references ops_incidents(id),
    event_type varchar(64) not null,
    actor_account_id uuid not null references iam_accounts(id),
    reason varchar(1000),
    previous_status varchar(32),
    next_status varchar(32) not null,
    previous_version bigint,
    new_version bigint not null,
    occurred_at timestamptz not null default current_timestamp
);

create index ops_incident_history_incident_idx on ops_incident_history (incident_id, occurred_at desc);

create table ops_incident_blocking_waivers (
    id uuid primary key,
    incident_id uuid not null references ops_incidents(id),
    reason varchar(1000) not null,
    waived_by_account_id uuid not null references iam_accounts(id),
    previous_version bigint not null,
    new_version bigint not null,
    waived_at timestamptz not null default current_timestamp
);

create index ops_incident_blocking_waivers_incident_idx
    on ops_incident_blocking_waivers (incident_id, waived_at desc);

create table ops_handovers (
    id uuid primary key,
    shift_id uuid not null references ops_shifts(id),
    receiving_shift_id uuid references ops_shifts(id),
    receiving_account_id uuid not null references iam_accounts(id),
    required_for_close boolean not null default false,
    content jsonb not null,
    status varchar(16) not null check (status in ('DRAFT', 'SUBMITTED', 'RETURNED', 'ACCEPTED', 'APPROVED')),
    submitted_by_account_id uuid references iam_accounts(id),
    accepted_by_account_id uuid references iam_accounts(id),
    approved_by_account_id uuid references iam_accounts(id),
    version bigint not null default 1 check (version > 0),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp
);

create index ops_handovers_shift_idx on ops_handovers (shift_id, required_for_close, status);

create table ops_handover_versions (
    id uuid primary key,
    handover_id uuid not null references ops_handovers(id),
    content jsonb not null,
    status varchar(16) not null check (status in ('DRAFT', 'SUBMITTED', 'RETURNED', 'ACCEPTED', 'APPROVED')),
    resource_version bigint not null check (resource_version > 0),
    event_type varchar(64) not null,
    recorded_by_account_id uuid not null references iam_accounts(id),
    occurred_at timestamptz not null default current_timestamp,
    unique (handover_id, resource_version)
);

create index ops_handover_versions_handover_idx on ops_handover_versions (handover_id, resource_version desc);

create table ops_handover_history (
    id uuid primary key,
    handover_id uuid not null references ops_handovers(id),
    event_type varchar(64) not null,
    actor_account_id uuid not null references iam_accounts(id),
    reason varchar(1000),
    previous_status varchar(16),
    next_status varchar(16) not null,
    previous_version bigint,
    new_version bigint not null,
    occurred_at timestamptz not null default current_timestamp
);

create index ops_handover_history_handover_idx on ops_handover_history (handover_id, occurred_at desc);
