# P2/P3 Daily Review Workflow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Update the daily operations workflow so `P3` submits raw execution records and `P2` performs the final review with dedicated confirmation notes and no photo uploads.

**Architecture:** Preserve the existing per-day data model and add a normalized `managerReview` layer to each day record. Drive the UI from role-aware helpers so the same page can present `P3` entry mode and `P2` review mode without duplicating screens.

**Tech Stack:** React 19, Vite, ESLint, FastAPI, SQLite, Node test runner

---

### Task 1: Add failing workflow tests

**Files:**
- Create: `frontend/src/lib/dailyWorkflow.test.js`
- Test: `frontend/src/lib/dailyWorkflow.test.js`

**Step 1: Write the failing test**

```javascript
import test from "node:test";
import assert from "node:assert/strict";

import {
  createEmptyManagerReview,
  ensureManagerReview,
  canEditDailyField,
  canUploadDailyImages,
  canSubmitManagerReview,
  submitManagerReview,
} from "./dailyWorkflow";
```

Cover:

- manager review normalization
- `P3` can edit raw fields and upload images
- `P2` can edit allowed textual fields but cannot upload images
- manager submit stamps reviewer metadata

**Step 2: Run test to verify it fails**

Run: `node --test frontend/src/lib/dailyWorkflow.test.js`
Expected: FAIL because `./dailyWorkflow` does not exist yet.

**Step 3: Write minimal implementation**

Create `frontend/src/lib/dailyWorkflow.js` with the exported helpers required by the tests.

**Step 4: Run test to verify it passes**

Run: `node --test frontend/src/lib/dailyWorkflow.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/lib/dailyWorkflow.js frontend/src/lib/dailyWorkflow.test.js
git commit -m "test: add daily workflow role helpers"
```

### Task 2: Normalize daily records with manager review state

**Files:**
- Modify: `frontend/src/lib/core.js`
- Test: `frontend/src/lib/dailyWorkflow.test.js`

**Step 1: Write the failing test**

Add a test proving `ensureDayOnWeek()` returns a day record with a normalized `managerReview` object, even for legacy records.

**Step 2: Run test to verify it fails**

Run: `node --test frontend/src/lib/dailyWorkflow.test.js`
Expected: FAIL because `managerReview` is missing from normalized day records.

**Step 3: Write minimal implementation**

Update `ensureDayOnWeek()` to:

- initialize `managerReview`
- preserve legacy approvals
- keep existing saved data backward compatible

**Step 4: Run test to verify it passes**

Run: `node --test frontend/src/lib/dailyWorkflow.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/lib/core.js frontend/src/lib/dailyWorkflow.test.js
git commit -m "feat: normalize manager review data on daily records"
```

### Task 3: Wire role-aware daily actions in App

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/lib/dailyWorkflow.js`
- Test: `frontend/src/lib/dailyWorkflow.test.js`

**Step 1: Write the failing test**

Add tests for:

- final manager review submission metadata
- validation of whether the current day can be submitted by `P2`

**Step 2: Run test to verify it fails**

Run: `node --test frontend/src/lib/dailyWorkflow.test.js`
Expected: FAIL because submit validation or metadata stamping is incomplete.

**Step 3: Write minimal implementation**

Update `App.jsx` to:

- compute daily role mode from the current user
- block image uploads for `P2`
- save `managerReview` notes
- replace item-by-item daily approval actions with one final manager review submit action
- update success and error status messages

**Step 4: Run test to verify it passes**

Run: `node --test frontend/src/lib/dailyWorkflow.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/lib/dailyWorkflow.js frontend/src/lib/dailyWorkflow.test.js
git commit -m "feat: add manager review workflow for daily records"
```

### Task 4: Update the daily page UI for P3 and P2 modes

**Files:**
- Modify: `frontend/src/components/DailyTab.jsx`
- Modify: `frontend/src/App.jsx`
- Test: `frontend/src/lib/dailyWorkflow.test.js`

**Step 1: Write the failing test**

Add helper-level tests for the mode flags that drive:

- upload control visibility
- manager review section visibility
- final submit availability

**Step 2: Run test to verify it fails**

Run: `node --test frontend/src/lib/dailyWorkflow.test.js`
Expected: FAIL because the mode helpers do not expose the needed state.

**Step 3: Write minimal implementation**

Refactor `DailyTab.jsx` so:

- `P3` sees the existing upload and save flow
- `P2` sees read/edit access to the raw text and time fields
- `P2` sees the `P2确认信息` form and final submit action
- legacy approval text is replaced with final review status text

**Step 4: Run test to verify it passes**

Run: `node --test frontend/src/lib/dailyWorkflow.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/components/DailyTab.jsx frontend/src/App.jsx frontend/src/lib/dailyWorkflow.test.js
git commit -m "feat: split daily page into p3 entry and p2 review modes"
```

### Task 5: Verify the branch end-to-end

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/DailyTab.jsx`
- Modify: `frontend/src/lib/core.js`
- Modify: `frontend/src/lib/dailyWorkflow.js`
- Test: `frontend/src/lib/dailyWorkflow.test.js`

**Step 1: Run targeted tests**

Run: `node --test frontend/src/lib/dailyWorkflow.test.js`
Expected: PASS

**Step 2: Run frontend lint**

Run: `npm run lint`
Expected: PASS

**Step 3: Run frontend build**

Run: `npm run build`
Expected: PASS

**Step 4: Run backend verification**

Run: `python3 -m compileall backend`
Expected: PASS

**Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/DailyTab.jsx frontend/src/lib/core.js frontend/src/lib/dailyWorkflow.js frontend/src/lib/dailyWorkflow.test.js docs/plans/2026-03-14-p2-p3-daily-review-design.md docs/plans/2026-03-14-p2-p3-daily-review.md
git commit -m "feat: update p2 p3 daily review workflow"
```
