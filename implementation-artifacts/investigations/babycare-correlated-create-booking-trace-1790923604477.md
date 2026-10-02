# CORRELATED_CREATE_BOOKING_TRACE babycare-correlated-create-booking-trace-1790923604477

Status: PASS_CORRELATED_TRACE
Cleanup: PASS
Environment: .env.e2e / bmnbqbcdbuklhopfbopv.supabase.co

## Scope

- Production mutation: FORBIDDEN
- Runtime performance code change: NONE
- Flow: Create Booking only
- Direct exported Next server action internals: NOT_INSTRUMENTED

## UI Correlation

- UI baseline marker: babycare-direct-ui-baseline-1790922970612
- UI submit -> save-complete business rows: 2962.97ms
- Likely submit Next-Action POST: 2350.82ms (409cb6a7f328d223426c5cfa0769cef243c33dd686)
- Submit POST identification is inferred from latest UI baseline order, not direct symbol mapping.

## Action-Equivalent Trace Summary

| Bucket | ms |
| --- | ---: |
| action equivalent total | 2286.35 |
| db | 1538.65 |
| audit | 204.37 |
| outbox | 83.27 |
| validation | 2.97 |
| service | 0.16 |
| revalidation | 214.61 |
| response | 0.06 |

Dominant measured bucket: db (1538.65ms, 67.3% of action-equivalent total)

## Slowest Steps

| Step | Category | ms |
| --- | --- | ---: |
| resolve_booking_tenant_probe | db | 250.56 |
| insert_initial_session_logs | db | 224.83 |
| safe_revalidate_paths_probe | revalidation | 214.61 |
| insert_deposit_revenue | db | 143.92 |
| insert_customer_select | db | 113.19 |
| deposit_accounting_period_probe | db | 106.99 |
| audit_customers_insert | audit | 106.98 |
| find_pending_booking_for_customer | db | 103.61 |
| audit_bookings_insert | audit | 97.39 |
| package_scope_package_select | db | 94.4 |

## Cleanup Verification

customers=0, bookings=0, revenue=0, sessions=0

## Classification

Root cause remains NOT_PROVEN. DB is the dominant measured bucket in the action-equivalent trace only if shown above, but this is not yet a same-request exported Next server-action internal trace.
