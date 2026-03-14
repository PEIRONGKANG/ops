# RBAC Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add session-based authentication, server-side RBAC and scope checks, unified workflow status transitions, and audit logging.

**Architecture:** Keep the existing FastAPI + SQLite + React architecture, add session and audit tables, extend current resource tables with workflow fields, and move actor identity from request headers to bearer sessions. Preserve the existing weekly JSON payload model while layering workflow state and authorization around it.

**Tech Stack:** FastAPI, SQLite, React, Vite, localStorage, node:test, unittest

---

### Task 1: Session Authentication Backend

**Files:**
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/backend/tests/test_foundation.py`
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/backend/app/database.py`
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/backend/app/main.py`
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/backend/app/schemas.py`

**Step 1: Write the failing test**

Add tests for:
- login returns `token` and actor without password
- `GET /api/session` resolves actor from bearer token
- `POST /api/logout` revokes token

**Step 2: Run test to verify it fails**

Run: `python3 -m unittest discover -s backend/tests -p 'test_*.py'`
Expected: FAIL because session endpoints/storage do not exist.

**Step 3: Write minimal implementation**

Implement:
- `sessions` table
- token generation + hashing helpers
- `create_session`, `get_session_by_token`, `revoke_session`
- `/api/login`, `/api/session`, `/api/logout`
- bearer token parsing in `main.py`

**Step 4: Run test to verify it passes**

Run: `python3 -m unittest discover -s backend/tests -p 'test_*.py'`
Expected: PASS for session tests.

**Step 5: Commit**

```bash
git add backend/tests/test_foundation.py backend/app/database.py backend/app/main.py backend/app/schemas.py
git commit -m "feat: add session authentication"
```

### Task 2: Server-Side RBAC and Scope Enforcement

**Files:**
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/backend/tests/test_foundation.py`
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/backend/app/database.py`
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/backend/app/main.py`

**Step 1: Write the failing test**

Add tests for:
- P3 cannot read another student’s week
- P3 paired session can read/write paired student week
- P2 can read any student week
- P2 cannot write course config or accounts
- bootstrap/accounts do not leak password

**Step 2: Run test to verify it fails**

Run: `python3 -m unittest discover -s backend/tests -p 'test_*.py'`
Expected: FAIL on missing scope/role enforcement.

**Step 3: Write minimal implementation**

Implement:
- scope resolution helpers
- role gates for existing endpoints
- bootstrap/accounts response sanitization
- paired session support in login/session resolution

**Step 4: Run test to verify it passes**

Run: `python3 -m unittest discover -s backend/tests -p 'test_*.py'`
Expected: PASS for access control tests.

**Step 5: Commit**

```bash
git add backend/tests/test_foundation.py backend/app/database.py backend/app/main.py
git commit -m "feat: enforce session roles and scope"
```

### Task 3: Workflow Status and Audit Log Backend

**Files:**
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/backend/tests/test_foundation.py`
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/backend/app/database.py`
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/backend/app/main.py`
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/backend/app/schemas.py`

**Step 1: Write the failing test**

Add tests for:
- week submit changes status to `submitted`
- reviewer approve/reject updates workflow fields
- P1 archive changes status to `archived`
- audit log records submit/approve/reject/archive actions

**Step 2: Run test to verify it fails**

Run: `python3 -m unittest discover -s backend/tests -p 'test_*.py'`
Expected: FAIL because workflow endpoints/fields/logging are missing.

**Step 3: Write minimal implementation**

Implement:
- workflow fields on target tables
- `audit_logs` table and helpers
- workflow transition helpers
- `/api/workflows/submit|approve|reject|archive`
- validation of allowed transitions by role/resource

**Step 4: Run test to verify it passes**

Run: `python3 -m unittest discover -s backend/tests -p 'test_*.py'`
Expected: PASS for workflow and audit tests.

**Step 5: Commit**

```bash
git add backend/tests/test_foundation.py backend/app/database.py backend/app/main.py backend/app/schemas.py
git commit -m "feat: add workflow transitions and audit logs"
```

### Task 4: Frontend Session and Workflow State Integration

**Files:**
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/frontend/tests/foundation.test.js`
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/frontend/src/services/api.js`
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/frontend/src/App.jsx`
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/frontend/src/lib/foundation.js`

**Step 1: Write the failing test**

Add tests for:
- token persistence and session restore helpers
- workflow action availability for P1/P2/P3
- workflow summary extraction from server payload

**Step 2: Run test to verify it fails**

Run: `node --test frontend/tests/foundation.test.js`
Expected: FAIL because session/workflow helpers are not implemented.

**Step 3: Write minimal implementation**

Implement:
- bearer token storage
- `/session` restore flow in `App.jsx`
- logout token clearing
- 401 handling and forced sign-out
- workflow status state helpers

**Step 4: Run test to verify it passes**

Run: `node --test frontend/tests/foundation.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/tests/foundation.test.js frontend/src/services/api.js frontend/src/App.jsx frontend/src/lib/foundation.js
git commit -m "feat: wire frontend session auth and workflow state"
```

### Task 5: UI Actions for Submit/Approve/Reject/Archive

**Files:**
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/frontend/src/App.jsx`
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/frontend/src/components/CertificationTab.jsx`
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/frontend/src/components/ScoringTab.jsx`
- Modify: `/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/frontend/src/components/Sidebar.jsx`

**Step 1: Write the failing test**

Add tests for workflow UI helper behavior:
- P3 sees submit
- P2/P1 sees approve/reject
- P1 sees archive

**Step 2: Run test to verify it fails**

Run: `node --test frontend/tests/foundation.test.js`
Expected: FAIL because workflow UI helpers are missing.

**Step 3: Write minimal implementation**

Implement:
- workflow action buttons
- status chips
- reject reason input
- archive action for P1

**Step 4: Run test to verify it passes**

Run: `node --test frontend/tests/foundation.test.js`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/CertificationTab.jsx frontend/src/components/ScoringTab.jsx frontend/src/components/Sidebar.jsx frontend/tests/foundation.test.js
git commit -m "feat: add workflow controls to frontend"
```

### Task 6: Full Verification

**Files:**
- No code changes expected

**Step 1: Run backend verification**

Run: `python3 -m unittest discover -s backend/tests -p 'test_*.py'`
Expected: all tests pass

**Step 2: Run frontend tests**

Run: `node --test frontend/tests/core.test.js frontend/tests/foundation.test.js frontend/tests/report.test.js`
Expected: all tests pass

**Step 3: Run compile and lint**

Run: `python3 -m compileall backend`
Expected: success

Run: `npm_config_cache=/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/frontend/.npm-cache npm run lint`
Expected: success

**Step 4: Run production build**

Run: `npm_config_cache=/Users/ultrao/Documents/codes/codesFromFork/ops/.worktrees/prd-foundation/frontend/.npm-cache npm run build`
Expected: success

**Step 5: Commit**

```bash
git add .
git commit -m "feat: add rbac workflow foundation"
```
