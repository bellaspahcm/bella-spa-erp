# SERVER_ACTION_TIMING_BASELINE babycare-server-action-baseline-1790914882004

Status: PASS_ACTION_WRAPPER_ONLY
Environment: .env.e2e / bmnbqbcdbuklhopfbopv.supabase.co

## Scope

- Production mutation: FORBIDDEN
- Runtime code change: NONE
- Browser/UI latency: NOT_MEASURED
- Direct exported server action: NOT_MEASURED
- Action-path wrapper: MEASURED

## Flow Summary

| Flow | Action wrapper ms | DB ms | Audit ms | Outbox ms | Validation ms | Revalidation ms | Failed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| create_booking_action | 2919.83 | 2055.5 | 300.7 | 134.03 | 1.9 | 224.23 | 0 |
| complete_session_action | 1109.76 | 1021.97 | 0 | 82.93 | 0.06 | 2.1 | 0 |

## Slowest Steps

### create_booking_action
- insert_initial_session_logs [db]: 306.93ms
- safe_revalidate_paths [revalidation]: 224.23ms
- insert_deposit_revenue [db]: 197.95ms
- audit_customers_insert [audit]: 184.15ms
- find_pending_booking_for_customer [db]: 169.33ms
- tenant_resolution_probe [db]: 164.22ms
- existing_session_logs_count [db]: 157.93ms
- package_scope_package_select [db]: 154.12ms

### complete_session_action
- fetch_booking_for_completion [db]: 154.2ms
- fetch_existing_session_security_check [db]: 125.69ms
- update_session_completed [db]: 105.05ms
- fetch_current_booking_for_progress [db]: 102.89ms
- insert_salary_record_probe [db]: 100.75ms
- update_booking_progress [db]: 98.07ms
- count_completed_sessions [db]: 96.23ms
- insert_session_review_placeholder [db]: 95.73ms

## Classification

Root cause remains NOT_PROVEN. This baseline measures a proof/staging action-path wrapper, not production UI latency or a direct Next server-action invocation.

## Cleanup

PASS
