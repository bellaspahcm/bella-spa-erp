---
title: 'Create HQ Subscription Service Actions'
type: 'feature'
created: '2026-06-01'
status: 'done'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The subscription/quota schema exists, but Super Admin has no service layer to read quota overview or mutate tenant subscription state safely. Direct UI mutations would risk missing audit trails, partial writes, or stale cache refresh after a failed mutation.

**Approach:** Add HQ-only server actions for subscription overview, tenant plan changes, quota overrides, and usage counter resets. Every mutation snapshots the existing row, writes a typed payload, records audit old/new data, and rolls back the DB write if audit logging fails.

## Boundaries & Constraints

**Always:** Require HQ auth before every read or write. Return explicit failure for DB and audit errors. Do not revalidate paths after failed mutations. Use generated Supabase table types for insert/update payloads.

**Ask First:** Building the Super Admin UI, changing plan prices/codes, or replacing current runtime quota enforcement with the new entitlement RPC.

**Never:** Do not allow branch users to mutate plan, override, or counter data. Do not swallow audit failures after a successful DB write. Do not update tenant subscription columns without rollback coverage.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| HQ overview | HQ admin opens subscription view | Plans, entitlements, tenants, overrides, and counters returned | Throw named query error on any failed select |
| Tenant plan change | Valid tenant and active plan | Tenant `subscription_tier` and optional expiry updated | Audit old/new, rollback tenant fields if audit fails |
| Quota override insert | No active override for feature | Active override inserted and audited | Delete inserted override if audit fails |
| Quota override update | Active override already exists | Existing row updated and audited | Restore previous override snapshot if audit fails |
| Usage counter reset | Counter exists | Used value reset to 0 with reset metadata | Restore previous counter snapshot if audit fails |
| Usage counter reset missing row | No counter exists | Zero counter inserted for period | Delete inserted counter if audit fails |

</frozen-after-approval>

## Code Map

- `src/services/hq-subscription-actions.ts` -- HQ-only subscription/quota overview and mutation actions with audit rollback.
- `src/types/database.types.ts` -- Generated type coverage for subscription quota tables and entitlement RPC.
- `src/__tests__/hq-subscription-actions.test.ts` -- Service contract tests for failure propagation, audit logging, and rollback.
- `docs/DEVELOPMENT_LOG.md` -- Batch log and verification commands.

## Tasks & Acceptance

**Execution:**
- [x] Add generated DB table/RPC types for the quota schema.
- [x] Add `getHqSubscriptionOverview`.
- [x] Add `updateTenantSubscriptionPlan` with audit rollback.
- [x] Add `setTenantQuotaOverride` with insert/update audit rollback.
- [x] Add `resetTenantUsageCounter` with update/insert audit rollback.
- [x] Add focused Jest coverage for success and failure side-effects.

**Acceptance Criteria:**
- Given any select in overview fails, when HQ loads subscription overview, then the action throws a named error instead of returning partial state.
- Given a mutation succeeds in DB but audit fails, when the action returns, then the DB mutation is rolled back and no cache revalidation is triggered.
- Given a valid HQ mutation succeeds and audit succeeds, when the action completes, then it returns success and revalidates `/hq` and `/dashboard/settings`.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/hq-subscription-actions.test.ts --runInBand` -- pass.
- `npx.cmd eslint src/services/hq-subscription-actions.ts src/__tests__/hq-subscription-actions.test.ts` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
