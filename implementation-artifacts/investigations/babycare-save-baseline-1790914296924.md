# BABYCARE_SAVE_BASELINE babycare-save-baseline-1790914296924

Status: PASS_DB_CRITICAL_PATH_ONLY
Environment: .env.e2e / bmnbqbcdbuklhopfbopv.supabase.co

## Scope

- Production mutation: FORBIDDEN
- Runtime code change: NONE
- Server action total latency: NOT_MEASURED
- DB critical path baseline: MEASURED

## Flow Summary

| Flow | Steps | Total measured ms | Failed steps |
| --- | ---: | ---: | ---: |
| setup | 4 | 1934.1 | 0 |
| create_booking | 15 | 2864.14 | 0 |
| update_booking | 7 | 620.3 | 0 |
| complete_session | 11 | 1308.73 | 0 |

## Slowest Steps

### setup
- insert_tenant: 1246.85ms
- insert_admin_user: 373.54ms
- insert_package: 175.28ms
- insert_ktv_user: 138.43ms

### create_booking
- insert_booking_select: 591.34ms
- insert_initial_session_logs: 281.2ms
- insert_deposit_revenue: 231.55ms
- package_scope_package_select: 197.12ms
- find_pending_booking_for_customer: 174.93ms

### update_booking
- fetch_scheduled_sessions_for_conflict: 106.29ms
- fetch_old_booking_for_audit: 104.79ms
- update_booking_select: 89.09ms
- sync_scheduled_session_times: 87.12ms
- audit_bookings_update: 81.53ms

### complete_session
- update_booking_progress: 238.86ms
- fetch_booking_for_completion: 238.72ms
- fetch_current_booking_for_progress: 118.48ms
- insert_session_review_placeholder: 100.38ms
- update_session_completed: 97.23ms

## Classification

Root cause remains NOT_PROVEN because this measures DB critical path, not full UI/server action latency.
Use these timings to decide which exact app-level spans need instrumentation next.

## Cleanup

| Step | Status | ms |
| --- | --- | ---: |
| delete_accounting_outbox_by_tenant | OK | 78.19 |
| delete_session_reviews | OK | 88.86 |
| delete_session_logs | OK | 112.87 |
| delete_salary_records | OK | 95.68 |
| delete_revenue | OK | 81.38 |
| delete_bookings | OK | 113.09 |
| delete_audit_logs | OK | 80.91 |
| delete_packages | OK | 95.86 |
| delete_customers | OK | 183.6 |
| delete_users | OK | 8642.07 |
| delete_tenants | OK | 6276.14 |
