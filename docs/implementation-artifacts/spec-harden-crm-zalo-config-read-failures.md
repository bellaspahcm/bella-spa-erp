---
title: 'Harden CRM Zalo config read failures'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: '667fe7ffd681e281159453f86424191d9a1ab4c2'
context:
  - '{project-root}/docs/index.md'
  - '{project-root}/docs/implementation-artifacts/spec-harden-crm-stats-read-failures.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** CRM Zalo settings reads still hide database failures by returning a blank config or empty ZNS log list. This can make operators believe Zalo is simply unconfigured or has no logs while the actual issue is DB/RLS/read failure.

**Approach:** Make `getZaloConfig` and `getZaloZnsLogs` fail fast on real database errors while preserving successful empty data semantics. Leave token refresh behavior for a separate slice because it affects real Zalo sending and batch reminder delivery.

## Boundaries & Constraints

**Always:** Preserve successful return shapes: `getZaloConfig` returns `ZaloConfig`, `getZaloZnsLogs` returns an array. Keep unauthorized missing-tenant handling explicit. Keep blank Zalo fields valid only when the tenant row was loaded successfully. Let `useCrmPageData` surface failures through its existing `loadError`.

**Ask First:** Changing CRM UI layout, changing Zalo OAuth refresh behavior, changing send/batch reminder behavior, changing tenant schema, or modifying Zalo credential encryption.

**Never:** Do not return blank config on tenant query failure. Do not return `[]` on notification log query failure. Do not broaden this slice into `getOrRefreshZaloToken` or `saveZaloConfig` audit behavior.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Config success | Tenant row loads with Zalo fields | Return decrypted config with existing defaults for null fields | No error |
| Config DB failure | Tenant query errors | Reject with explicit `getZaloConfig` error | CRM hook catches and shows load error |
| Config missing row | Tenant query returns no row | Reject with explicit not-found error | No blank config |
| Logs success | Notification query returns rows or empty list | Return rows or `[]` | No error |
| Logs DB failure | Notification query errors | Reject with explicit `getZaloZnsLogs` error | No silent empty logs |
| No tenant | Current user lacks `tenant_id` | Config rejects unauthorized; logs preserve `[]` empty state | No data query needed after user lookup |

</frozen-after-approval>

## Code Map

- `src/services/crm/zalo-config.ts` -- Zalo config/log server actions to harden.
- `src/app/dashboard/crm/hooks/useCrmPageData.ts` -- caller already catches service failures and sets `loadError`.
- `src/__tests__/crm-zalo-config.test.ts` -- new focused tests for config/log read failure behavior.
- `docs/DEVELOPMENT_LOG.md` -- implementation handoff log.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/crm/zalo-config.ts` -- throw explicit errors for config/log DB failures while preserving success shapes.
- [x] `src/__tests__/crm-zalo-config.test.ts` -- cover config success, DB failure, missing row, logs success/empty, logs DB failure, no tenant.
- [x] `docs/DEVELOPMENT_LOG.md` -- append dated implementation and verification evidence.
- [x] `docs/implementation-artifacts/spec-harden-crm-zalo-config-read-failures.md` -- mark completed after verification.

**Acceptance Criteria:**
- Given the tenant Zalo config query fails, when `getZaloConfig` runs, then it rejects instead of returning blank config.
- Given the ZNS notification log query fails, when `getZaloZnsLogs` runs, then it rejects instead of returning `[]`.
- Given queries succeed with empty/null fields, when the functions run, then successful empty/default values are still returned.
- Given no tenant context, when config/log actions run, then existing unauthorized/empty-state behavior is preserved as specified.

## Spec Change Log

## Design Notes

This continues the CRM read-hardening sequence from stats/upcoming sessions. The key distinction is between "loaded successfully but blank" and "could not load"; only the former may render as empty configuration.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/crm-zalo-config.test.ts --runInBand` -- expected: focused CRM Zalo config tests pass.
- `npx.cmd tsc --noEmit --incremental false` -- expected: no TypeScript errors.
- `npx.cmd eslint src/services/crm/zalo-config.ts src/__tests__/crm-zalo-config.test.ts` -- expected: no ESLint errors.
- `npm.cmd test -- --runInBand` -- expected: full Jest suite passes.
- `npm.cmd run build` -- expected: production build succeeds.
