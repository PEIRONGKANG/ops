# PRD Foundation Slice Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the first PRD foundation layer for course configuration, resources, and scheduling while preserving current weekly operations data.

**Architecture:** Extend the FastAPI + SQLite backend with normalized configuration tables and CRUD APIs, then expose P1-only management pages in the React frontend. Preserve existing `weeks` and `week_groups` behavior so current operational flows remain functional during the migration period.

**Tech Stack:** FastAPI, SQLite, React 19, Vite, Tailwind CSS 4

---

### Task 1: Add failing coverage for new foundation APIs

**Files:**
- Create: `backend/tests/test_foundation_api.py`
- Modify: `backend/app/main.py`
- Modify: `backend/app/database.py`

**Step 1: Write failing test**

Cover:

- `GET /api/foundation/bootstrap`
- `POST /api/terms`
- `POST /api/classes`
- `POST /api/course-batches`
- `POST /api/resources`

**Step 2: Run test to verify it fails**

Run: `python3 -m pytest backend/tests/test_foundation_api.py -q`

**Step 3: Implement minimal backend support**

Add new tables, seed defaults, and basic CRUD routes.

**Step 4: Run tests to verify pass**

Run: `python3 -m pytest backend/tests/test_foundation_api.py -q`

**Step 5: Commit**

Commit message: `feat: add PRD foundation backend APIs`

### Task 2: Add frontend API client and state wiring

**Files:**
- Modify: `frontend/src/services/api.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/lib/constants.js`

**Step 1: Write failing smoke expectations**

Extend smoke or add targeted test script expectations for the three new P1 pages.

**Step 2: Run to verify it fails**

Run: `npm run lint` and targeted smoke command

**Step 3: Implement minimal wiring**

Add foundation bootstrap state, new tabs, and page switching.

**Step 4: Re-run verification**

Run: `npm run lint`

**Step 5: Commit**

Commit message: `feat: wire foundation management state`

### Task 3: Build P1 management pages

**Files:**
- Create: `frontend/src/components/CourseConfigTab.jsx`
- Create: `frontend/src/components/ResourcesTab.jsx`
- Create: `frontend/src/components/SchedulingTab.jsx`
- Modify: `frontend/src/App.jsx`

**Step 1: Add failing targeted smoke checks**

Assert page headings and create actions for P1.

**Step 2: Run to verify fails**

Run: targeted smoke command

**Step 3: Implement the pages**

Support list/create/update flows with the new APIs.

**Step 4: Re-run verification**

Run: `npm run lint && npm run build`

**Step 5: Commit**

Commit message: `feat: add PRD foundation management pages`

### Task 4: Run regression verification

**Files:**
- Modify: `frontend/scripts/smoke.mjs`

**Step 1: Extend smoke to include new P1 pages without breaking current flows**

**Step 2: Run smoke and inspect output**

Run: `npm run smoke`

**Step 3: Fix any regressions**

**Step 4: Re-run full verification**

Run:

- `python3 -m compileall backend`
- `npm run lint`
- `npm run build`
- `npm run smoke`

**Step 5: Commit**

Commit message: `test: cover PRD foundation slice`
