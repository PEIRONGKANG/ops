create table ops_evidence_file_versions (
    id uuid primary key,
    evidence_id uuid not null references ops_evidence(id),
    file_version bigint not null check (file_version > 0),
    relative_path varchar(1024) not null,
    original_filename varchar(512) not null,
    safe_extension varchar(16) not null,
    declared_mime_type varchar(255),
    detected_mime_type varchar(255) not null,
    byte_size bigint not null check (byte_size >= 0),
    sha256 char(64) not null,
    status varchar(16) not null check (status in ('CURRENT', 'REPLACED', 'WITHDRAWN', 'PURGED')),
    reason varchar(500),
    uploaded_by_account_id uuid not null references iam_accounts(id),
    changed_by_account_id uuid references iam_accounts(id),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    purge_after timestamptz,
    purged_at timestamptz,
    purge_result varchar(32),
    unique (evidence_id, file_version),
    check (relative_path not like '/%' and relative_path not like '%..%'),
    constraint ops_evidence_file_versions_historical_purge_check check (
        (status in ('REPLACED', 'WITHDRAWN') and purge_after is not null)
        or (status in ('CURRENT', 'PURGED'))
    ),
    check (
        (status = 'PURGED' and purged_at is not null and purge_result is not null)
        or (status <> 'PURGED' and purged_at is null)
    )
);

create unique index ops_evidence_file_versions_current_unique
    on ops_evidence_file_versions (evidence_id)
    where status = 'CURRENT';

create index ops_evidence_file_versions_due_purge_idx
    on ops_evidence_file_versions (purge_after)
    where status in ('REPLACED', 'WITHDRAWN');

create index ops_evidence_file_versions_evidence_idx
    on ops_evidence_file_versions (evidence_id, file_version desc);
