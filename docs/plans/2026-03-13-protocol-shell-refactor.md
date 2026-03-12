# Protocol Shell Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor the React frontend into a Protocol-inspired docs workbench with left navigation, right content workspace, shared shell for logged-out and logged-in states, and structured module pages while preserving current business behavior.

**Architecture:** Keep `frontend/src/App.jsx` as the business-state orchestrator but replace the layout layer with a docs shell. Rework page composition through metadata-driven navigation and sectioned module layouts. Preserve backend contracts and existing save/approve/export handlers. Use the existing smoke script as the functional regression test while updating selectors for the new shell.

**Tech Stack:** React 19, Vite 7, Tailwind CSS 4, Font Awesome React, existing Playwright smoke script

---

### Task 1: Add shell dependencies and codify the new shell in smoke coverage

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/scripts/smoke.mjs`

**Step 1: Write the failing test**

Update `frontend/scripts/smoke.mjs` first so it expects the new docs shell landmarks after login:
- left navigation group headings
- top utility search field
- right workspace page heading

**Step 2: Run test to verify it fails**

Run: `npm run smoke`
Expected: FAIL because the current UI still renders the old hero/tab shell and the new selectors are missing.

**Step 3: Write minimal implementation**

Add Font Awesome React dependencies in `frontend/package.json` and refresh the lockfile with `npm install`.

**Step 4: Run test to verify baseline tooling still works**

Run:
- `npm run lint`
- `npm run build`

Expected: PASS. `npm run smoke` still fails until the shell lands.

**Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/scripts/smoke.mjs
git commit -m "test: define protocol shell smoke expectations"
```

### Task 2: Replace the global shell and navigation model

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/App.css`
- Modify: `frontend/src/components/Sidebar.jsx`
- Modify: `frontend/src/components/TabNav.jsx`

**Step 1: Write the failing test**

Use the smoke assertions from Task 1 to drive the new shell:
- shell renders shared layout before and after login
- docs nav appears on desktop
- top utility bar appears

**Step 2: Run test to verify it fails**

Run: `npm run smoke`
Expected: FAIL on missing docs shell selectors.

**Step 3: Write minimal implementation**

- Remove the current marketing-hero layout from `App.jsx`.
- Introduce grouped nav metadata and page-level title/description/action metadata.
- Rewrite `Sidebar.jsx` into the primary docs nav.
- Convert `TabNav.jsx` into a lightweight mobile subnav or compatibility wrapper.
- Replace the existing global CSS component layer with Protocol-inspired shell tokens and layout classes.

**Step 4: Run test to verify it passes**

Run:
- `npm run lint`
- `npm run build`
- `npm run smoke`

Expected: Shell-related smoke assertions pass; later module assertions may still fail until page content is restyled.

**Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/index.css frontend/src/App.css frontend/src/components/Sidebar.jsx frontend/src/components/TabNav.jsx
git commit -m "feat: add protocol-inspired application shell"
```

### Task 3: Refactor the logged-out overview and login experience into the shared shell

**Files:**
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/LoginPanel.jsx`

**Step 1: Write the failing test**

Extend smoke expectations so the logged-out page uses the shared shell and still exposes the login workflow from the right workspace.

**Step 2: Run test to verify it fails**

Run: `npm run smoke`
Expected: FAIL because the logged-out content still uses the old structure or lacks the new page landmarks.

**Step 3: Write minimal implementation**

- Render the unauthenticated state inside the new docs shell.
- Restyle `LoginPanel.jsx` into a page card with structured intro text, login guidance, and helper callouts.
- Keep existing login field behavior and dual-student logic unchanged.

**Step 4: Run test to verify it passes**

Run:
- `npm run lint`
- `npm run build`
- `npm run smoke`

Expected: Login path passes again under the new shell.

**Step 5: Commit**

```bash
git add frontend/src/App.jsx frontend/src/components/LoginPanel.jsx
git commit -m "feat: unify login flow with docs shell"
```

### Task 4: Convert operational modules into sectioned docs-style pages

**Files:**
- Modify: `frontend/src/components/CreativeTab.jsx`
- Modify: `frontend/src/components/DailyTab.jsx`
- Modify: `frontend/src/components/HandoverTab.jsx`
- Modify: `frontend/src/components/ReflectionTab.jsx`
- Modify: `frontend/src/components/MediaBlocks.jsx`

**Step 1: Write the failing test**

Adjust smoke assertions to expect the new page sections while still completing:
- creative save and poster upload
- daily save and evidence upload
- handover and reflection reachability

**Step 2: Run test to verify it fails**

Run: `npm run smoke`
Expected: FAIL because headings, section wrappers, or controls have moved.

**Step 3: Write minimal implementation**

- Restyle each module into `page header + section cards + guide/status side panels`.
- Keep props and events stable where possible.
- Improve image areas and approval status presentation to match the new docs-workbench language.

**Step 4: Run test to verify it passes**

Run:
- `npm run lint`
- `npm run build`
- `npm run smoke`

Expected: Module interaction flow passes under the new presentation.

**Step 5: Commit**

```bash
git add frontend/src/components/CreativeTab.jsx frontend/src/components/DailyTab.jsx frontend/src/components/HandoverTab.jsx frontend/src/components/ReflectionTab.jsx frontend/src/components/MediaBlocks.jsx frontend/scripts/smoke.mjs
git commit -m "feat: refactor weekly workflow pages into docs sections"
```

### Task 5: Refactor account management, status surfaces, and export entry points

**Files:**
- Modify: `frontend/src/components/AccountsTab.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/components/Sidebar.jsx`

**Step 1: Write the failing test**

Extend smoke coverage for:
- account management page reachability
- export buttons visible in the new shell
- role-sensitive controls remain present

**Step 2: Run test to verify it fails**

Run: `npm run smoke`
Expected: FAIL if account/export controls are no longer found after the shell refactor.

**Step 3: Write minimal implementation**

- Restyle account management into a docs page with clear sections for current account, P1 administration, and account list.
- Fold export/report entry points into the new shell without changing the export logic.
- Make status banners and approval summaries visually consistent with the new shell.

**Step 4: Run test to verify it passes**

Run:
- `npm run lint`
- `npm run build`
- `npm run smoke`

Expected: PASS across account and export flows.

**Step 5: Commit**

```bash
git add frontend/src/components/AccountsTab.jsx frontend/src/App.jsx frontend/src/components/Sidebar.jsx frontend/scripts/smoke.mjs
git commit -m "feat: refactor account and export surfaces"
```

### Task 6: Final polish and full verification

**Files:**
- Modify: any touched frontend files as needed for cleanup

**Step 1: Write the failing test**

No new behavior test. Use existing smoke/lint/build as the regression gate for cleanup-only refactors.

**Step 2: Run test to verify current state**

Run:
- `npm run lint`
- `npm run build`
- `npm run smoke`

Expected: PASS before cleanup changes.

**Step 3: Write minimal implementation**

- Remove dead classes and outdated hero/tab references.
- Tighten copy, spacing, and responsive edge cases.
- Ensure icon usage is consistent and not decorative noise.

**Step 4: Run test to verify it passes**

Run:
- `npm run lint`
- `npm run build`
- `npm run smoke`

Expected: PASS with no regressions.

**Step 5: Commit**

```bash
git add frontend
git commit -m "refactor: polish protocol-style frontend"
```

## Notes

- This environment does not provide a separate subagent dispatcher, so execution may need to be performed manually while still following the task order and validation gates above.
- Avoid changing backend code unless the smoke flow reveals a frontend-serving issue.
