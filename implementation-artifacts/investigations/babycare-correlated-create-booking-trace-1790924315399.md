# CORRELATED_CREATE_BOOKING_TRACE babycare-correlated-create-booking-trace-1790924315399

Status: PASS_CORRELATED_TRACE
Cleanup: PASS
Environment: .env.e2e / bmnbqbcdbuklhopfbopv.supabase.co

## Scope

- Production mutation: FORBIDDEN
- Runtime performance code change: SKIP_PENDING_LOOKUP_FOR_NEW_CUSTOMER_APPLIED
- Flow: Create Booking only
- Direct exported Next server action internals: NOT_INSTRUMENTED

## UI Correlation

- UI baseline marker: babycare-direct-ui-baseline-1790924281618
- UI submit -> save-complete business rows: 2924.73ms
- Likely submit Next-Action POST: 2075.98ms (409cb6a7f328d223426c5cfa0769cef243c33dd686)
- Submit POST identification is inferred from latest UI baseline order, not direct symbol mapping.

## Action-Equivalent Trace Summary

| Bucket | ms |
| --- | ---: |
| action equivalent total | 1925.38 |
| db | 1239.04 |
| audit | 159.43 |
| outbox | 79.89 |
| validation | 1.81 |
| service | 0.2 |
| revalidation | 229.05 |
| response | 0.12 |

Dominant measured bucket: db (1239.04ms, 64.4% of action-equivalent total)

## Slowest Steps

| Step | Category | ms |
| --- | --- | ---: |
| insert_initial_session_logs | db | 232.46 |
| safe_revalidate_paths_probe | revalidation | 229.05 |
| resolve_booking_tenant_probe | db | 183.32 |
| deposit_accounting_period_probe | db | 92.92 |
| insert_deposit_revenue | db | 92.31 |
| package_scope_package_select | db | 85.38 |
| audit_customers_insert | audit | 84.1 |
| insert_booking_select | db | 83.64 |
| existing_session_logs_count | db | 83.35 |
| pricing_package_select | db | 81.09 |

## Cleanup Verification

customers=0, bookings=0, revenue=0, sessions=0

## Classification

Root cause remains NOT_PROVEN. DB is the dominant measured bucket in the action-equivalent trace only if shown above, but this is not yet a same-request exported Next server-action internal trace.
