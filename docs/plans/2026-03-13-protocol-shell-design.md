# Protocol-Inspired Frontend Refactor Design

**Date:** 2026-03-13
**Scope:** `/frontend` application shell and page presentation

## Goal

Refactor the existing React frontend into a documentation-style workbench inspired by Tailwind UI's Protocol template: fixed left navigation, right content workspace, lightweight top utility bar, structured page sections, and calmer docs-oriented visual language. The current business logic, API contract, role rules, and data model remain intact.

## Constraints

- Keep FastAPI endpoints and SQLite schema unchanged.
- Keep existing business capabilities:
  - login and dual-student session sync
  - weekly group setup
  - creative planning
  - daily execution and approvals
  - handover
  - reflection
  - account management
  - report preview/export
- Preserve current save/approve/export behaviors from `frontend/src/App.jsx`.
- Support desktop and mobile; mobile can collapse the left nav into a drawer.
- Use Font Awesome React packages for navigation and UI icons.

## Non-Goals

- No backend API redesign.
- No changes to approval semantics or week data shape.
- No replacement of the existing smoke flow with a new test runner.
- No attempt to clone the reference template exactly.

## Information Architecture

The app moves from "marketing hero + top tabs" to "docs shell + section pages".

### Left Navigation

- Brand header
- Session summary / current identity
- Grouped navigation
  - `开始使用`
    - 系统概览
    - 登录 / 当前会话
  - `本周轮值`
    - 周次与分组
    - 周三策划
    - 每日执行
    - 次周交接
    - 总结反思
  - `管理与归档`
    - 审核状态
    - 周报导出
    - 账号管理
- Footer actions
  - quick status
  - logout

### Right Workspace

- Sticky top utility bar
  - search-style command field
  - current identity / role chip
  - contextual quick actions
- Page header
  - title
  - page description
  - primary and secondary actions
- Main content area
  - form sections for data entry
  - guide cards for instructions and requirements
  - meta/status cards for approvals and session state

## Visual Direction

- Palette: light gray, soft sage, deep ink, restrained green accents.
- Typography: strong sans hierarchy with tighter spacing and less dramatic serif usage than the current UI.
- Surfaces: thin borders, modest shadows, large but controlled radii.
- Backgrounds: subtle grid/line treatment in header bands and page hero surfaces.
- Motion: limited to nav selection, drawer open/close, and small content fades.

## Component Strategy

## App Shell

- `App.jsx` becomes the orchestration layer for:
  - shell layout
  - route-like active page selection
  - page metadata and contextual actions
  - existing business state and handlers
- Introduce page metadata helpers instead of wiring all visual copy inline.

## Sidebar

- Rewrite `Sidebar.jsx` as the primary docs navigation.
- Move week controls, group controls, report actions, and status messaging into structured nav subsections.
- Surface current selection and role-specific capabilities more clearly.

## Login / Overview

- Replace the unauthenticated hero landing with a docs-style overview page that shares the same shell.
- Keep login form but embed it in the right workspace as the primary action block.

## Module Pages

- Keep existing data props and handlers where possible.
- Refactor each tab component into sectioned layouts:
  - primary form sections
  - helper/guide blocks
  - approval/status side cards
- This preserves logic while moving presentation closer to the Protocol reference structure.

## Icons

- Add:
  - `@fortawesome/react-fontawesome`
  - `@fortawesome/free-solid-svg-icons`
  - `@fortawesome/free-regular-svg-icons`
  - `@fortawesome/free-brands-svg-icons`
- Use icons consistently for nav, states, search, approval hints, export, account actions, and the optional `x-twitter` brand touchpoint if a branded/outbound surface needs it.

## Data Flow

No data-flow rewrite is planned.

- `api.js` remains unchanged unless minor helper additions are needed.
- `App.jsx` still owns:
  - bootstrap
  - session persistence
  - current week loading
  - per-module saves
  - approvals
  - account CRUD
  - report generation
- Presentational restructuring must not change payload shapes sent to the backend.

## Responsive Behavior

- Desktop:
  - fixed left nav
  - scrollable right content
- Tablet:
  - narrower nav
  - topbar remains sticky
- Mobile:
  - left nav becomes overlay drawer
  - topbar exposes menu toggle
  - content stacks to one column
  - side guidance cards move below primary forms

## Testing Strategy

- Use the existing Playwright smoke workflow as the primary behavior check.
- Update smoke expectations where selectors depend on the old visual shell.
- Verify:
  - login
  - load/create week
  - group save
  - creative save/upload
  - daily save/upload
  - role-sensitive pages remain reachable
  - report preview/export triggers still exist
- Run:
  - `npm run lint`
  - `npm run build`
  - `npm run smoke`

## Risks

- `App.jsx` already mixes business logic and view composition, so shell refactor can create regressions if page metadata and layout logic are not separated carefully.
- Existing smoke selectors are likely to break because headings and button placement will move.
- Mobile behavior needs explicit treatment because the current UI is not a docs-shell layout.

## Implementation Summary

The safest path is to preserve current state and handler logic in `App.jsx`, replace the page shell and navigation model, then restyle each module component into structured docs-like sections. This yields the target layout without reopening backend or persistence concerns.
