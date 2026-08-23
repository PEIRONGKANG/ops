# P3/P2 今日运营工作台 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a role-aware Material 3 “今日运营” workspace where P3 executes assigned shift work and P2 manages scoped daily operations through the existing backend APIs.

**Architecture:** Add a typed operations API adapter over the existing `ApiClient`, then compose a single workspace shell with role-specific queues and a shared shift detail view. Keep server state authoritative: the UI renders dashboard and shift responses, sends versioned commands, refreshes after mutations, and blocks actions while data is unavailable.

**Tech Stack:** React 19, TypeScript, MUI 7 Material 3 styling, Vitest + Testing Library, existing FastAPI-compatible `ApiClient` contract backed by Spring Boot endpoints.

---

### Task 1: Add operations API contracts and adapter

**Files:**
- Create: `apps/web/src/features/operations/operationsApi.ts`
- Test: `apps/web/src/features/operations/operationsApi.test.ts`

**Steps:**
1. Write failing adapter tests for P3 dashboard, P2 today dashboard, personal/scoped shift detail, task/milestone reads, versioned task commands, shift lifecycle commands, incident and handover reads.
2. Run the focused Vitest file and confirm the missing adapter fails.
3. Implement typed entities and endpoint methods using the existing `ApiClient`; preserve UUIDs, versions, status strings and multipart evidence upload boundaries.
4. Run the focused tests and confirm all endpoint paths and payloads pass.
5. Commit `feat(web): add operations api adapter`.

### Task 2: Build role-aware operations workspace state

**Files:**
- Create: `apps/web/src/features/operations/OperationsWorkspacePage.tsx`
- Test: `apps/web/src/features/operations/OperationsWorkspacePage.test.tsx`
- Modify: `apps/web/src/app/App.tsx`

**Steps:**
1. Write failing tests for P3 loading/empty/error states, P2 actionable queues, role-specific visibility, and selecting a shift.
2. Run the focused tests and confirm the workspace is not available yet.
3. Implement a single page that loads `/me/operations-dashboard` for P3 and `/operations/today` for P2, renders a flat M3 page scaffold, and loads selected shift data from the correct endpoint.
4. Add the operations API to `AppContent` and render the operations workspace for P2/P3 profiles while preserving the P1 startup configuration flow.
5. Run focused tests and confirm role/data boundaries.
6. Commit `feat(web): add role-aware operations workspace`.

### Task 3: Implement P3 task execution and evidence interactions

**Files:**
- Modify: `apps/web/src/features/operations/OperationsWorkspacePage.tsx`
- Test: `apps/web/src/features/operations/OperationsWorkspacePage.test.tsx`

**Steps:**
1. Add failing tests for submitting a pending/returned task, showing P2 return reasons, creating text evidence, and blocking submit when required evidence is absent.
2. Implement task rows with status, role, evidence requirement and one primary action; use a M3 dialog for evidence entry and a file input for supported evidence files.
3. Refresh the selected shift after mutation and route all failures through the global Toast provider.
4. Run focused tests and confirm P3 cannot access acceptance or scheduling controls.
5. Commit `feat(web): add p3 shift execution flow`.

### Task 4: Implement P2 scheduling, approval, risk and handover actions

**Files:**
- Modify: `apps/web/src/features/operations/OperationsWorkspacePage.tsx`
- Test: `apps/web/src/features/operations/OperationsWorkspacePage.test.tsx`

**Steps:**
1. Add failing tests for P2 task accept/return, milestone approval/return, start/request-close/close, and visible blocking incident/handover queues.
2. Implement P2-only action rows and confirmation dialogs requiring a reason for return/close-related actions.
3. Refresh dashboard and selected shift state after every successful command; disable controls during requests and on stale version errors.
4. Run focused tests and confirm P3 never receives P2 commands.
5. Commit `feat(web): add p2 shift management flow`.

### Task 5: Apply M3 visual and responsive QA

**Files:**
- Modify: `apps/web/src/features/operations/OperationsWorkspacePage.tsx`
- Test: `apps/web/src/features/operations/OperationsWorkspacePage.test.tsx`

**Steps:**
1. Add accessibility assertions for named main regions, keyboard reachable list rows, dialogs, status labels and no duplicate primary actions.
2. Tune layout for 390px, 840px, 1024px and 1440px using existing theme breakpoints; keep the page free of horizontal overflow.
3. Run `npm test -- --run`, `npm run lint`, `npm run build`, and `git diff --check`.
4. Commit `feat(web): polish operations workspace responsive behavior`.

### Task 6: Verify Docker and delivery

**Files:**
- No source changes expected.

**Steps:**
1. Rebuild the web image with Docker Compose without removing the PostgreSQL volume.
2. Verify `http://localhost:5173/` returns HTTP 200 and backend authentication remains available.
3. Run the backend Maven suite when backend source is unchanged as a compatibility gate.
4. Push `renovate` and verify local/remote commit hashes match.
