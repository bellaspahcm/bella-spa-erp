# SPEC: Use Plan Catalog for Subscription Invoices

## Intent
Remove hard-coded subscription upgrade pricing from server actions and price new subscription invoices from the HQ-managed `subscription_plans` catalog.

## Scope
- `createUpgradeInvoice` reads the active plan row from `subscription_plans`.
- The pending invoice amount is calculated from `subscription_plans.price_monthly * durationMonths`.
- Missing, inactive, or failed plan lookups return explicit failure and do not insert invoices.
- Invalid subscription duration is rejected before any database mutation.

## Invariants
- Server actions must verify authentication and authorization internally.
- Invoice insert payloads must keep using generated Supabase table types.
- Database failures must return explicit failure status, never silently create fallback pricing.
- Existing tenant scoping for invoice payment simulation stays unchanged.

## Acceptance
- Changing a plan price in Super Admin changes future invoice amounts without code edits.
- Inactive or unknown plans cannot generate invoices.
- Plan lookup DB errors stop invoice creation.
- Tests assert the plan lookup, insert payload amount, and no-mutation failure paths.
