# SPEC: Remove Subscription Tier Hard Code

## Intent
Remove the remaining runtime dependency on hard-coded `SUBSCRIPTION_TIERS` in subscription quota checks so plan display metadata comes from the HQ-managed plan catalog.

## Scope
- `checkSubscriptionLimit` reads the tenant's plan display name from `subscription_plans`.
- Quota numbers continue to come from `get_effective_subscription_entitlements`.
- HQ-owned spas keep an explicit unlimited bypass without reading franchise plan data.
- Expired franchise subscriptions return blocked zero limits with the catalog display name.
- Plan lookup database errors fail closed.

## Invariants
- Runtime quota limits must not fall back to legacy static plan numbers.
- Entitlement RPC errors or missing features remain explicit failures.
- SMS usage remains sourced from `tenant_usage_counters`.
- Resource count failures remain explicit failures.

## Acceptance
- No `SUBSCRIPTION_TIERS` constant is used in `src/lib/subscription.ts`.
- `limits.tierName` reflects `subscription_plans.display_name` when available.
- Plan lookup failures throw `[checkSubscriptionLimit] subscription_plans query failed: ...`.
- Existing subscription, HQ, and quota tests pass.
