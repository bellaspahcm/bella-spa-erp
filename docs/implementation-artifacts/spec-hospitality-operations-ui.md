---
title: 'Hospitality Operations UI'
type: 'feature'
created: '2026-10-09'
status: 'ready-for-dev'
context:
  - '{project-root}/docs/governance/BELLA_AI_CODING_CONSTITUTION.md'
  - '{project-root}/ARCHITECTURE_GATE_RESULT.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** Bella Hospitality has sealed backend/product service proof, but the browser surface is still a minimal proof form instead of a hotel operations console. Hotel staff need a usable first screen for dashboard and room/reservation operations without pretending unproven backend data exists.

**Approach:** Upgrade the existing `/hospitality/hotel-core-chain` entry into a presentation-first operations dashboard that reuses the existing Hotel Core chain action and result contract. Keep Dashboard and Room/Booking as the primary workflow, expose front-office/folio evidence from the same chain, and label housekeeping/maintenance surfaces as unproven unless backed by returned data.

## Boundaries & Constraints

**Always:** Use existing Hospitality product contracts; preserve current E2E test ids and proof text; show `NOT_PROVEN` instead of mock operational data; keep tenant/product/folio/payment evidence visible.

**Ask First:** Any new API, table, RPC, migration, status, workflow action, Platform/Core change, Finance contract change, or maintenance action that marks a room sellable.

**Never:** Do not edit Healthcare, Education, Logistics frozen kernels; do not invent live occupancy/housekeeping/maintenance counts; do not claim Go-Live from UI completion alone.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Initial operations screen | No successful chain result in query params | Dashboard, Rooms/Bookings, Front Office, and Housekeeping/Maintenance render with `NOT_PROVEN` evidence states | No fake counts or seeded rows |
| Proven chain result | Redirect params contain success values from existing action | KPI cards and operational panels show product, stay, occupancy, folio, finance, payment, room and reservation evidence | Existing E2E test ids still pass |
| Rejected chain | Action redirects with `error` | Error banner shows rejection code/message and does not mark proof as passed | Keep form available for rerun |

</frozen-after-approval>

## Code Map

- `src/app/hospitality/hotel-core-chain/page.tsx` -- current browser proof page and the only UI surface in scope.
- `src/services/hospitality-hotel-core-chain-actions.ts` -- existing server action and returned proof contract.
- `src/products/bella-hospitality/types/*.ts` -- canonical statuses and product-owned capability boundaries.
- `e2e/tests/38-hospitality-hotel-core-chain-browser-e2e.spec.ts` -- browser/Real DB proof that must remain compatible.

## Tasks & Acceptance

**Execution:**
- [x] `ARCHITECTURE_GATE_RESULT.md` -- record product ownership, contract dependency, change authority, and verification plan before code.
- [x] `docs/implementation-artifacts/spec-hospitality-operations-ui.md` -- capture scoped implementation contract.
- [x] `src/app/hospitality/hotel-core-chain/page.tsx` -- replace minimal proof form layout with operations dashboard while preserving action and test ids.
- [x] Verification commands -- run scoped checks and report PASS/NOT_PROVEN honestly.

**Acceptance Criteria:**
- Given no successful chain result, when a user opens `/hospitality/hotel-core-chain`, then operational panels render but all unbacked metrics are clearly `NOT_PROVEN`.
- Given a successful Hotel Core chain run, when the page redirects back, then product, stay, occupancy, folio, finance, payment, room and reservation evidence are visible without new backend contracts.
- Given existing Hospitality E2E selectors, when Playwright fills and submits the form, then the preserved test ids still target the same inputs/status values.

## Verification

**Commands:**
- `npx tsc --noEmit --pretty false --incremental false --project tsconfig.json` -- expected: no new diagnostics attributable to changed files, or report existing baseline separately.
- `npx eslint src/app/hospitality/hotel-core-chain/page.tsx` -- expected: no lint errors in changed page.
- `npx playwright test e2e/tests/38-hospitality-hotel-core-chain-browser-e2e.spec.ts` -- expected: PASS when Real DB/env/server are available; otherwise NOT_PROVEN.

**Evidence captured 2026-10-09:**
- Static verification: ESLint PASS, TypeScript PASS, `git diff --check` PASS.
- Hospitality service regression: 6 suites / 19 tests PASS.
- Dev smoke: BLOCKED_BY_DEPENDENCY_LAYOUT. Worktree has no local `node_modules`; external dependency execution makes Next resolve `./D:/.../next-dev.js` from the worktree and returns HTTP 500.
- Local dependency install: BLOCKED_BY_ENOSPC. `npm ci --ignore-scripts` failed with no space left on device; partial `node_modules` was removed.
- Real DB Browser E2E: NOT_PROVEN. Required DB/base-url environment variables are not present in this worktree session.
