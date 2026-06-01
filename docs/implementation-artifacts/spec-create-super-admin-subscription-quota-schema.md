---
title: 'Create Super Admin Subscription Quota Schema'
type: 'feature'
created: '2026-06-01'
status: 'done'
context:
  - '{project-root}/AGENTS.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** The system has subscription tier columns and hard-coded limits, but no Super Admin controlled data model for plan definitions, feature entitlements, tenant overrides, or metered usage counters. Without this schema, later HQ UI/service work would either keep duplicating hard-coded quota logic or mutate tenant subscription fields without a canonical entitlement source.

**Approach:** Add a DB-first quota foundation that preserves current `free_trial/basic/pro/enterprise` plan codes while introducing normalized plan, entitlement, override, and usage counter tables. Enforce RLS with HQ/tenant boundaries and expose a guarded RPC that returns effective entitlements after applying active tenant overrides.

## Boundaries & Constraints

**Always:** Keep existing tenant `subscription_tier` values compatible. Seed current KTV/customer/SMS limits exactly as existing app behavior. Enable RLS on every new table. Allow tenant users to read their own override/usage data, but only HQ can manage plans, entitlements, overrides, and counters.

**Ask First:** Changing prices, changing plan names/codes, migrating app enforcement from `src/lib/subscription.ts` to the new schema, or building the HQ UI/service layer in this batch.

**Never:** Do not remove current subscription columns or existing renewal RPCs. Do not expose quota mutation to branch users. Do not create tables without RLS.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Default plan seed | Migration applied | Four current plan codes exist with current monthly prices | Idempotent upsert |
| Default entitlement seed | Migration applied | KTV/customer/SMS limits match existing hard-coded values | Idempotent upsert |
| Tenant reads own quota data | Auth tenant user queries overrides/counters | Only rows for their tenant are visible | RLS filters by `get_auth_tenant_id()` |
| HQ manages quota data | HQ Super Admin mutates plan/override/counter rows | Mutation allowed | RLS requires `is_hq_super_admin()` |
| Cross-tenant entitlement RPC | Non-HQ user passes another tenant id | RPC raises unauthorized exception | No data returned |

</frozen-after-approval>

## Code Map

- `supabase/migrations/20260601011000_create_subscription_quota_schema.sql` -- Creates Super Admin subscription/quota catalog, RLS policies, seeds, and effective entitlement RPC.
- `src/__tests__/subscription-quota-schema.test.ts` -- Migration contract test for required tables, RLS, default seed values, and guarded RPC.
- `docs/DEVELOPMENT_LOG.md` -- Batch log and verification commands.

## Tasks & Acceptance

**Execution:**
- [x] `supabase/migrations/20260601011000_create_subscription_quota_schema.sql` -- Add `subscription_plans`, `subscription_plan_entitlements`, `tenant_subscription_overrides`, and `tenant_usage_counters`.
- [x] `supabase/migrations/20260601011000_create_subscription_quota_schema.sql` -- Add RLS policies for HQ management and tenant-scoped reads.
- [x] `supabase/migrations/20260601011000_create_subscription_quota_schema.sql` -- Seed existing plan codes and entitlement limits.
- [x] `supabase/migrations/20260601011000_create_subscription_quota_schema.sql` -- Add `get_effective_subscription_entitlements(UUID)` guarded RPC.
- [x] `src/__tests__/subscription-quota-schema.test.ts` -- Assert migration contract.

**Acceptance Criteria:**
- Given the migration is applied repeatedly, when seed data runs, then default plans/entitlements remain idempotently aligned with current app limits.
- Given a branch user attempts to mutate quota schema tables, when RLS evaluates, then only HQ Super Admin can pass mutation policies.
- Given a branch user requests effective entitlements for another tenant, when the RPC runs, then it raises an authorization error.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/subscription-quota-schema.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/subscription.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/subscription-actions.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand` -- pass.
- `npm.cmd test -- src/__tests__/state-machine.test.ts --runInBand` -- pass.
- `npx.cmd tsc --noEmit` -- pass.
- `npx.cmd eslint src/__tests__/subscription-quota-schema.test.ts` -- pass.
