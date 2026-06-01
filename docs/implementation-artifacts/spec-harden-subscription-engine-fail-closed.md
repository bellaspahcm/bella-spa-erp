---
title: 'Harden Subscription Engine Fail Closed'
type: 'refactor'
created: '2026-06-01'
status: 'done'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/node_modules/next/dist/docs/01-app/01-getting-started/07-mutating-data.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The existing subscription/quota foundation can fail open: quota lookup/count/RPC failures may allow resource creation or hide usage updates, invoice history can silently return an empty list, and HQ tenant status changes can succeed without audit. This is unsafe before building a fuller Super Admin quota console.

**Approach:** Harden the current subscription engine first. Make quota checks and SMS increments fail closed, scope simulated subscription renewal to the current tenant invoice, harden DB RPC authorization, and require audit/rollback for HQ tenant status changes.

## Boundaries & Constraints

**Always:** Preserve current subscription tiers and branch subscription UX. Use generated Supabase types for DB payloads. Return explicit failures or throw on database/RPC errors. Keep service-role webhook support for real payment callbacks.

**Ask First:** Adding new plan/quota tables, changing pricing, replacing VietQR/SePay payment flow, or introducing the full Super Admin quota UI.

**Never:** Do not allow quota checks to return unlimited on DB errors. Do not allow direct simulated renewal for another tenant's invoice. Do not return success when tenant status audit fails.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Quota query success | Active franchise tenant under limit | Return current usage and max limit | N/A |
| Quota tenant query fails | `tenants` query error | Resource action is blocked by thrown error | Throw explicit query failure |
| KTV/customer count fails | Count query error | No fail-open resource creation | Throw explicit count failure |
| SMS increment fails | `increment_tenant_sms` RPC error/null | Caller receives failure | Throw explicit RPC failure |
| Invoice history query fails | Subscription invoice DB error | UI load fails visibly | Throw explicit query failure |
| Simulated invoice payment | Invoice belongs to current tenant | Calls renewal RPC with normalized invoice number | N/A |
| Cross-tenant invoice simulation | Invoice missing for current tenant | Do not call renewal RPC | Return explicit failure |
| HQ status audit fails | Tenant status update succeeds, audit throws | Restore old status/timestamp | Include rollback failure if restore fails |

</frozen-after-approval>

## Code Map

- `src/lib/subscription.ts` -- Central subscription limit checker and SMS usage increment helper.
- `src/services/subscription-actions.ts` -- Branch subscription status, invoice history, upgrade invoice creation, and simulated payment action.
- `src/services/hq-actions.ts` -- HQ tenant status mutation now requiring audit/rollback.
- `supabase/migrations/20260601010000_harden_subscription_rpc.sql` -- DB-side guards for subscription renewal and SMS counter RPCs.
- `src/__tests__/subscription.test.ts` -- Subscription limit and payment webhook regression tests.
- `src/__tests__/subscription-actions.test.ts` -- Server action tests for invoice fail-closed behavior.
- `src/__tests__/hq-actions.test.ts` -- HQ status rollback test.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/subscription.ts` -- Throw on tenant lookup, count, and SMS RPC errors instead of allowing unlimited/zero fallback.
- [x] `src/services/subscription-actions.ts` -- Throw invoice history errors, restrict invoice creation/simulation to admin users, and scope simulated renewal by tenant.
- [x] `src/services/hq-actions.ts` -- Snapshot tenant status, audit old/new status, and rollback status when audit fails.
- [x] `supabase/migrations/20260601010000_harden_subscription_rpc.sql` -- Add DB authorization and row locking to subscription RPCs.
- [x] `src/__tests__/*subscription*.test.ts` and `src/__tests__/hq-actions.test.ts` -- Cover fail-closed and rollback paths.

**Acceptance Criteria:**
- Given a DB/RPC failure in quota enforcement, when resource creation or SMS usage is checked, then the operation cannot proceed as if quota were unlimited.
- Given a branch user simulates invoice payment, when the invoice is not owned by that branch, then renewal RPC is not called.
- Given HQ changes tenant status and audit logging fails, then tenant status is restored and no success response is returned.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/subscription.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/subscription-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/hq-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/lib/subscription.ts src/services/subscription-actions.ts src/services/hq-actions.ts src/__tests__/subscription.test.ts src/__tests__/subscription-actions.test.ts src/__tests__/hq-actions.test.ts` -- pass.
