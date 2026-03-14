# P2/P3 Daily Review Workflow Design

## Context

The current daily operations page treats `P2` as a pure approver. `P2` can only stamp item-level approvals and does not have a dedicated place to record confirmation notes. The same daily form is also exposed as if `P2` should complete the raw execution content, which does not match the intended workflow.

The confirmed target workflow is:

- `P3` submits the raw daily execution record and uploads evidence photos.
- `P2` opens the selected `P3` record, reviews the submitted content, and may adjust the existing text or time fields when needed.
- `P2` does not upload the raw execution photos and does not fill a second copy of the execution form from scratch.
- `P2` writes confirmation notes for attendance, opening hygiene, closing hygiene, finance and inventory, receipt, and general notes.
- `P2` submission is final for the daily module. No second confirmation by `P3` is required afterward.

## Recommended Approach

Keep the existing daily module and add a dedicated `P2` confirmation layer inside the same day record. This avoids a separate review page, preserves the current navigation, and keeps a single source of truth per day.

## Data Model

Extend each `week.daily[day]` record with a nested `managerReview` object:

- `attendance`
- `opening`
- `closing`
- `finance`
- `receipt`
- `notes`
- `submittedAt`
- `submittedBy`

The existing raw execution fields remain the `P3` layer:

- check-in and check-out
- attendance note
- execution photos
- finance and inventory details
- receipt details
- daily notes

Legacy daily approval stamps should still be normalized so old saved records continue to render without crashing, but the page should stop depending on item-by-item approval buttons for the daily module.

## UI and Permissions

### P3 View

- `P3` continues to edit the raw execution content and upload all evidence photos.
- `P3` does not see the `P2` submit action.
- `P3` can read the current `P2` review notes and final review status when present.

### P2 View

- `P2` can load any `P3` scope and see the submitted raw execution content.
- `P2` can adjust the existing textual and time-based fields in place.
- Photo upload controls are hidden or disabled for `P2`.
- A dedicated `P2确认信息` block is shown with the required confirmation note fields.
- A single final submit action writes reviewer identity and timestamp into `managerReview`.

### P1 View

- `P1` keeps administrative access and should behave like a manager for the daily review layer.

## Submission Rules

`P2` final submission should require enough evidence in the record to avoid empty confirmations:

- attendance requires check-in or check-out or an attendance note
- opening requires opening photos or a manager opening note
- closing requires closing photos or a manager closing note
- finance requires finance text, inventory text, loss data, or finance-related photos
- receipt requires receipt text or receipt photos

The submit button should stay disabled until at least one required reviewable section has underlying data and the manager review notes are available where needed.

## Error Handling and Compatibility

- Existing saved weeks without `managerReview` must be upgraded in memory by the normalizer.
- Existing daily approval stamps remain visible as legacy status if present, but the new flow should not require them.
- The report generator can remain unchanged for this task unless the new review notes are already surfaced elsewhere.

## Testing Strategy

Use test-first development around pure workflow helpers:

- day-record normalization creates a stable `managerReview` shape
- role-based edit capabilities distinguish `P3` raw entry from `P2` review editing
- manager submission stamps reviewer metadata
- validation helpers enforce the new final-submit rules

UI verification then covers:

- `P2` no longer sees photo upload controls in the daily module
- `P2` sees the confirmation note block and final submit button
- `P3` keeps upload controls and does not get the final manager submit action
