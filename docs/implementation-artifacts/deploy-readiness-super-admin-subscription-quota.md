# Deploy Readiness: Super Admin Subscription & Quota

## Scope
This checklist covers the Super Admin subscription/quota rollout:

- Plan catalog: `subscription_plans`
- Plan entitlements: `subscription_plan_entitlements`
- Tenant overrides: `tenant_subscription_overrides`
- Usage counters: `tenant_usage_counters`
- Runtime quota enforcement via `get_effective_subscription_entitlements`
- SMS metering via `get_tenant_sms_usage` and `increment_tenant_sms`
- Renewal via `renew_tenant_subscription`
- Tenant invoice pricing from `subscription_plans.price_monthly`

## Migration Order
Apply these migrations in filename order:

1. `supabase/migrations/20260601010000_harden_subscription_rpc.sql`
   - Hardens legacy renewal/SMS RPCs.
   - Adds `SECURITY DEFINER`, `SET search_path = public`, explicit grants, tenant guards, and invoice row lock.

2. `supabase/migrations/20260601011000_create_subscription_quota_schema.sql`
   - Creates plan, entitlement, override, and usage counter tables.
   - Enables RLS.
   - Seeds `free_trial`, `basic`, `pro`, `enterprise`.
   - Adds `get_effective_subscription_entitlements(UUID)`.

3. `supabase/migrations/20260602010000_use_usage_counters_for_sms.sql`
   - Replaces SMS usage runtime with `tenant_usage_counters`.
   - Adds `get_tenant_sms_usage(UUID)`.
   - Replaces `increment_tenant_sms(UUID)` with atomic counter upsert.
   - Replaces `renew_tenant_subscription(TEXT, TEXT)` so renewal resets current SMS usage counter and legacy `sms_allotment_used`.

## Static Readiness Checks
- [x] Migration order is valid: SMS counter functions are replaced only after `tenant_usage_counters` exists.
- [x] RPCs use `SECURITY DEFINER`.
- [x] RPCs set `search_path = public`.
- [x] RPC execute permissions are revoked from `PUBLIC` and granted to `authenticated, service_role`.
- [x] `tenant_usage_counters` keeps legacy `tenants.sms_allotment_used` synced for older displays.
- [x] Runtime quota numbers come from `get_effective_subscription_entitlements`, not static TypeScript limits.
- [x] Runtime plan display name comes from `subscription_plans.display_name`.
- [x] Invoice pricing comes from `subscription_plans.price_monthly`.

## Automated Verification Run
- [x] `npm.cmd test -- src/__tests__/subscription.test.ts --runInBand`
- [x] `npm.cmd test -- src/__tests__/subscription-actions.test.ts --runInBand`
- [x] `npm.cmd test -- src/__tests__/hq-subscription-actions.test.ts --runInBand`
- [x] `npm.cmd test -- src/__tests__/hq-subscription-ui.test.ts --runInBand`
- [x] `npm.cmd test -- src/__tests__/subscription-quota-schema.test.ts --runInBand`
- [x] `npm.cmd test -- src/__tests__/security-hardening.test.ts --runInBand`
- [x] `npx.cmd eslint src/lib/subscription.ts src/services/subscription-actions.ts src/services/hq-subscription-actions.ts src/app/hq/components/HqSubscriptionQuotaConsole.tsx src/__tests__/subscription.test.ts src/__tests__/subscription-actions.test.ts src/__tests__/hq-subscription-actions.test.ts src/__tests__/hq-subscription-ui.test.ts src/__tests__/subscription-quota-schema.test.ts`
- [x] `npx.cmd tsc --noEmit`

## Production Pre-Deploy Checklist
- [ ] Confirm production has no pending manual migration drift.
- [ ] Back up production database or confirm point-in-time recovery is available.
- [ ] Apply migrations in order through the approved Supabase deploy path.
- [ ] Confirm `subscription_plans` has active rows for all tenant `subscription_tier` codes currently in production.
- [ ] Confirm `subscription_plan_entitlements` has `ktv`, `customer`, and `sms` rows for every active plan.
- [ ] Confirm `tenant_usage_counters` exists before application code that calls `get_tenant_sms_usage` is deployed.
- [ ] Confirm Vercel/app deploy happens after migrations are applied.

## Post-Deploy Smoke Tests
- [ ] Open HQ subscription console and verify plan catalog loads.
- [ ] Change a tenant plan from HQ and verify audit log is written.
- [ ] Set a tenant quota override and verify runtime quota reflects the override.
- [ ] Reset a tenant SMS usage counter and verify `tenant_usage_counters.used_value = 0`.
- [ ] Create a tenant upgrade invoice and verify amount equals `subscription_plans.price_monthly * durationMonths`.
- [ ] Simulate or process a subscription payment and verify `renew_tenant_subscription` updates tenant expiry.
- [ ] Send one SMS/Zalo message and verify `tenant_usage_counters.used_value` increments by 1.
- [ ] Verify legacy `tenants.sms_allotment_used` mirrors the SMS counter after increment/renewal.
- [ ] Try a quota-exceeding KTV/customer/SMS action and verify it is blocked.

## Rollback Notes
- If app deploy fails but migrations succeeded, roll back the app first. The migrations are additive except RPC replacements and should remain compatible with current data.
- If SMS metering behaves unexpectedly, inspect `tenant_usage_counters` first, then `tenants.sms_allotment_used` as the compatibility mirror.
- Do not drop subscription/quota tables during incident rollback unless data has been backed up and business approval is explicit.

## Residual Risks
- This readiness pass is static plus automated Jest/TypeScript verification. It does not apply migrations to a live Supabase project.
- Unknown production `tenants.subscription_tier` values will fail closed because entitlement rows will be missing.
- Existing SMS usage before migration is preserved only in `tenants.sms_allotment_used`; current monthly `tenant_usage_counters` starts when the new RPCs are used or when HQ resets/renews.
