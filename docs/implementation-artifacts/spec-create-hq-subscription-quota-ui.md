---
title: 'Create HQ Subscription Quota UI'
type: 'feature'
created: '2026-06-01'
status: 'done'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The Super Admin subscription/quota schema and server actions exist, but HQ users still cannot inspect or operate them from `/hq`. The evaluation gap remains visible because plan, quota override, and usage counters are API-only.

**Approach:** Add a dedicated Subscription & Quota tab to the HQ dashboard that loads the new overview action and exposes controlled workflows for changing tenant plans, setting quota overrides, and resetting usage counters.

## Boundaries & Constraints

**Always:** Keep all writes routed through existing HQ server actions with audit rollback. Keep the UI dense and operational like the current HQ dashboard. Show explicit loading/empty states and toast failures. Do not stage unrelated Supabase temp files or local settings.

**Ask First:** Changing pricing, plan codes, entitlement seed values, or replacing runtime quota enforcement from hard-coded checks to `get_effective_subscription_entitlements`.

**Never:** Do not let the client write directly to Supabase quota tables. Do not hide mutation failures behind optimistic success. Do not rebuild the HQ dashboard layout or refactor unrelated tabs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Open tab | HQ user selects Subscription & Quota | Plans, tenants, overrides, and counters load from `getHqSubscriptionOverview` | Toast error and keep safe empty state if load fails |
| Change tenant plan | Tenant, active plan, optional expiry selected | Calls `updateTenantSubscriptionPlan`, refreshes overview and tenant list on success | Toast server action error, no local success state |
| Set quota override | Tenant, feature, limit/unlimited, unit, reset period submitted | Calls `setTenantQuotaOverride`, refreshes overview on success | Client blocks invalid negative/missing limit, server errors shown |
| Reset usage counter | Existing counter row selected | Calls `resetTenantUsageCounter` for the exact tenant/feature/period | Confirmation prompt before mutation, server errors shown |

</frozen-after-approval>

## Code Map

- `src/app/hq/components/HqDashboardChrome.tsx` -- HQ tab registry and tab type union.
- `src/app/hq/hq-dashboard-client.tsx` -- Parent dashboard shell and tab routing.
- `src/app/hq/components/HqSubscriptionQuotaConsole.tsx` -- New client-side Subscription & Quota console.
- `src/services/hq-subscription-actions.ts` -- Existing HQ server actions used by the console.
- `src/__tests__/hq-subscription-ui.test.ts` -- Static integration contract for tab and action wiring.
- `docs/DEVELOPMENT_LOG.md` -- Batch log and verification commands.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/hq/components/HqDashboardChrome.tsx` -- Add `subscriptions` tab key and label.
- [x] `src/app/hq/hq-dashboard-client.tsx` -- Add refresh signal and render the new console in the subscription tab.
- [x] `src/app/hq/components/HqSubscriptionQuotaConsole.tsx` -- Implement overview, plan changes, quota override form, and usage counter reset controls.
- [x] `src/__tests__/hq-subscription-ui.test.ts` -- Assert UI/action wiring for the new tab.
- [x] `docs/DEVELOPMENT_LOG.md` -- Record Batch 4 outcome and checks.

**Acceptance Criteria:**
- Given an HQ user opens `/hq`, when they select Subscription & Quota, then the dashboard shows plan catalog, tenant subscription controls, active overrides, and usage counters.
- Given a mutation returns `{ success: false }`, when the user submits the UI form, then the console displays an error and does not show a success toast.
- Given a mutation succeeds, when the action resolves, then the console reloads overview data so visible state reflects the persisted change.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/hq-subscription-ui.test.ts --runInBand` -- expected: pass.
- `npm.cmd test -- src/__tests__/hq-subscription-actions.test.ts --runInBand` -- expected: pass.
- `npm.cmd test -- src/__tests__/subscription-quota-schema.test.ts --runInBand` -- expected: pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- expected: pass.
- `npx.cmd tsc --noEmit` -- expected: pass.
- `npx.cmd eslint src/app/hq/components/HqSubscriptionQuotaConsole.tsx src/app/hq/hq-dashboard-client.tsx src/app/hq/components/HqDashboardChrome.tsx src/__tests__/hq-subscription-ui.test.ts` -- expected: pass.
