# DIRECT_NEXT_OR_UI_TIMING_BASELINE babycare-direct-ui-baseline-1790924281618

Status: PASS_UI_BASELINE
Cleanup: PASS
Environment: .env.e2e / bmnbqbcdbuklhopfbopv.supabase.co / http://localhost:3217

## Scope

- Production mutation: FORBIDDEN
- Runtime contract context: PACKAGE_MODULE_KEY_CONTRACT_FIX_APPLIED
- Performance code change: SKIP_PENDING_LOOKUP_FOR_NEW_CUSTOMER_APPLIED
- Browser submit latency: MEASURED
- Direct Next dev-server path: PRE_SUBMIT_MEASURED
- Direct exported server action: NOT_MEASURED

## UI Result

- Browser submit to save-complete business rows: 2924.73ms

## Next Action POSTs

| URL | Status | Next-Action | ms |
| --- | ---: | --- | ---: |
| /dashboard | 200 | 004b278249e2e797b0908ed3809ee12e2723c72b45 | 555.57 |
| /dashboard | 200 | 7f25d4d11f82fbf2b3252c0ce8a5c4dfaa87393524 | 288.51 |
| /dashboard | 200 | 00b3b7e14f1f8631bfbc3fbc9e6f00e16b0c4dd38e | 1068.37 |
| /dashboard | 200 | 00b3b7e14f1f8631bfbc3fbc9e6f00e16b0c4dd38e | 1073.96 |
| /dashboard | 200 | 00b3b7e14f1f8631bfbc3fbc9e6f00e16b0c4dd38e | 1027.66 |
| /dashboard | 200 | 00b3b7e14f1f8631bfbc3fbc9e6f00e16b0c4dd38e | 1152.11 |
| /dashboard | 200 | 7090a15606043f5dca6563331c55ee146b47af0ca5 | 566.71 |
| /dashboard | 200 | 0094d735db05be39f4afc7c9c078141abe0e8bca24 | 1089.61 |
| /dashboard | 200 | 40634e7c11ddce5d638b11d7e60f07f03cfabbebce | 372.7 |
| /dashboard | 200 | 004927b239e1d7ca73f62b40f75b17c505562c00b9 | 376.45 |
| /dashboard | 200 | 0024df18ebbdd8f9bd5d4778cf1812b38d2942ab48 | 469.23 |
| /dashboard | 200 | 409cb6a7f328d223426c5cfa0769cef243c33dd686 | 2075.98 |

## Step Timings

| Step | ms | Status |
| --- | ---: | --- |
| setup_proof_tenant | 1248.3 | OK |
| wait_for_dev_server | 8129.5 | OK |
| browser_goto_dashboard | 4054.5 | OK |
| open_booking_modal | 269.65 | OK |
| fill_customer_step | 724.53 | OK |
| fill_booking_step | 7741.85 | OK |
| submit_create_booking_until_success_visible_and_business_rows | 2924.72 | OK |
| run_browser_create_booking_flow | 16926.87 | OK |
| cleanup_delete_accounting_outbox_by_reference_ids | 70.76 | OK |
| cleanup_delete_session_logs | 116.03 | OK |
| cleanup_delete_revenue | 82.73 | OK |
| cleanup_delete_bookings | 103.48 | OK |
| cleanup_delete_packages | 73.85 | OK |
| cleanup_delete_customers | 122.59 | OK |

## Classification

Root cause remains NOT_PROVEN unless this UI timing is compared with the DB/action-wrapper baselines and repeated enough to rule out dev-server cold start/noise.
