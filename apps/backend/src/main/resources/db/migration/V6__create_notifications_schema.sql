create table shared_notifications (
    id uuid primary key,
    recipient_account_id uuid not null references iam_accounts(id),
    event_type varchar(64) not null,
    resource_type varchar(64) not null,
    resource_id uuid not null,
    title varchar(160) not null,
    message varchar(1000) not null,
    read_at timestamptz,
    version bigint not null default 1 check (version > 0),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp
);

create index shared_notifications_recipient_idx
    on shared_notifications (recipient_account_id, read_at, created_at desc);

create index shared_notifications_resource_idx
    on shared_notifications (resource_type, resource_id, created_at desc);
