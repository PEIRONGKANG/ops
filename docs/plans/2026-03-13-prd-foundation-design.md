# PRD Foundation Slice Design

## Scope

This slice implements the first PRD foundation layer while keeping the current weekly operations flow usable:

- Course organization data for terms, classes, course batches, groups, and weekly schedule assignments
- Resource center data and APIs
- P1 management pages for course configuration, resource management, and scheduling
- Backward-compatible database initialization so existing `users`, `weeks`, and `week_groups` remain readable

This slice does not yet attempt the full PRD:

- No full 13-23 process refactor yet
- No scoring/ranking/dashboard yet
- No complete auth/session redesign yet
- No PDF export yet

## Architecture

The backend remains a single FastAPI app with SQLite, but gains normalized configuration tables alongside the existing JSON week records. Existing weekly data stays in place; new configuration entities attach metadata needed by later PRD phases.

The frontend keeps the current application shell and operational pages, but adds P1-only management pages and foundational state loading. Existing student/manager flows continue to use the current week JSON model until later phases replace them.

## Data Model

New tables:

- `terms`
- `classes`
- `course_batches`
- `course_batch_classes`
- `groups`
- `group_members`
- `schedule_assignments`
- `resources`

Compatibility approach:

- Keep `users`, `weeks`, `week_groups`
- Add optional metadata fields in week payloads when available
- Seed a default term/class/batch from current data so legacy usage still works immediately

## UI

New P1 tabs:

- Course Configuration
- Resource Center
- Group Scheduling

Each page supports lightweight CRUD and is optimized for operational setup, not polished administration workflows yet.

## Verification

Minimum verification for this slice:

- Backend compile check
- Frontend lint
- Frontend build
- Targeted smoke of login plus new P1 configuration pages
