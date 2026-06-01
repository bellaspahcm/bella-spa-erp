---
title: 'Enforce Subscription Quota Schema'
type: 'refactor'
created: '2026-06-01'
status: 'done'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** HQ can now manage subscription plans, quota overrides, and usage counters, but runtime enforcement still uses hard-coded `SUBSCRIPTION_TIERS`. That means HQ changes are visible in the console but do not necessarily control KTV, customer, or SMS limit behavior.

**Approach:** Keep the existing tenant lookup, expiration handling, and HQ-owned bypass, but make franchise tenant quota checks resolve limits from `get_effective_subscription_entitlements(UUID)`. Treat entitlement RPC errors or missing requested features as fail-closed errors.

## Boundaries & Constraints

**Always:** Preserve fail-closed behavior for tenant lookup, count queries, SMS RPC, entitlement RPC, and missing entitlement rows. Keep HQ-owned non-franchise spas bypassed as before. Preserve current return shape for callers: `isBlocked`, `current`, `max`, `tier`, `isExpired`, and `limits`.

**Ask First:** Changing plan seed values, removing `SUBSCRIPTION_TIERS`, changing subscription expiry semantics, or replacing SMS usage storage with `tenant_usage_counters`.

**Never:** Do not fall back to hard-coded limits after entitlement RPC failure. Do not allow missing feature entitlement to imply unlimited quota. Do not add direct client-side quota enforcement.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Franchise tenant under plan limit | RPC returns plan entitlement for requested feature | Count is compared against RPC limit | Count query failure throws |
| Tenant override active | RPC returns `source = override` with higher/lower limit | Runtime `max` and `limits.*` use override value | No hard-coded limit drift |
| RPC denied/unavailable | `get_effective_subscription_entitlements` returns error | `checkSubscriptionLimit` throws named error | No resource creation proceeds as if unlimited |
| Missing requested entitlement | RPC omits `ktv`, `customer`, or `sms` being checked | `checkSubscriptionLimit` throws named missing entitlement error | No default/hard-code pass-through |
| HQ-owned spa | `franchise_agreement_date` is null | Bypass remains unlimited | No entitlement RPC required |

</frozen-after-approval>

## Code Map

- `src/lib/subscription.ts` -- Central runtime quota enforcement for KTV, customer, and SMS usage.
- `src/__tests__/subscription.test.ts` -- Regression coverage for subscription quota, RPC fail-closed behavior, and payment webhook.
- `docs/DEVELOPMENT_LOG.md` -- Batch log and verification commands.

## Tasks & Acceptance

**Execution:**
- [x] `src/lib/subscription.ts` -- Resolve franchise tenant limits from `get_effective_subscription_entitlements`.
- [x] `src/lib/subscription.ts` -- Throw on entitlement RPC failures and missing requested feature rows.
- [x] `src/__tests__/subscription.test.ts` -- Update mocks to use entitlement RPC data.
- [x] `src/__tests__/subscription.test.ts` -- Add override-driven quota test and fail-closed entitlement tests.
- [x] `docs/DEVELOPMENT_LOG.md` -- Record Batch 5 outcome and checks.

**Acceptance Criteria:**
- Given HQ sets an active quota override, when a protected flow calls `checkSubscriptionLimit`, then the returned `max` reflects the effective entitlement RPC result.
- Given the entitlement RPC fails, when a protected flow checks quota, then the check throws and does not allow the operation to continue as unlimited.
- Given the entitlement RPC omits the requested feature, when a protected flow checks quota, then the check throws a missing entitlement error.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/subscription.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/subscription-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/subscription-quota-schema.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/hq-subscription-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.
- `npx.cmd eslint src/lib/subscription.ts src/__tests__/subscription.test.ts` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
