# SPEC: Use Tenant Usage Counters for SMS Metering

## Intent
Move SMS quota enforcement from the legacy `tenants.sms_allotment_used` column to `tenant_usage_counters`, matching the Super Admin quota schema.

## Scope
- Runtime SMS limit checks read current monthly usage from `get_tenant_sms_usage`.
- SMS increments write atomically to `tenant_usage_counters`.
- Subscription renewal resets both the source counter and legacy column for compatibility.
- Legacy `tenants.sms_allotment_used` remains synced but is no longer the runtime source of truth.

## Invariants
- Database/RPC errors must fail closed.
- Tenant isolation must be enforced in database RPCs.
- `tenant_usage_counters` uses monthly periods for `feature_key = 'sms'`.
- HQ-owned spas still bypass subscription quota checks before usage RPCs.

## Acceptance
- `checkSubscriptionLimit(..., 'sms')` calls `get_tenant_sms_usage`.
- A stale `tenants.sms_allotment_used` value cannot block or allow SMS quota by itself.
- `increment_tenant_sms` upserts `tenant_usage_counters` with an atomic increment.
- `renew_tenant_subscription` resets the current SMS usage counter to zero.
- Tests cover runtime behavior and migration contract.
