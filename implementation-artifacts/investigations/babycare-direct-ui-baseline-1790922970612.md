# DIRECT_NEXT_OR_UI_TIMING_BASELINE babycare-direct-ui-baseline-1790922970612

Status: PASS_UI_BASELINE
Cleanup: PASS
Environment: .env.e2e / bmnbqbcdbuklhopfbopv.supabase.co / http://localhost:3217

## Scope

- Production mutation: FORBIDDEN
- Runtime contract context: PACKAGE_MODULE_KEY_CONTRACT_FIX_APPLIED
- Performance code change: NONE
- Browser submit latency: MEASURED
- Direct Next dev-server path: PRE_SUBMIT_MEASURED
- Direct exported server action: NOT_MEASURED

## UI Result

- Browser submit to save-complete business rows: 2962.97ms

## Next Action POSTs

| URL | Status | Next-Action | ms |
| --- | ---: | --- | ---: |
| /dashboard | 200 | 004b278249e2e797b0908ed3809ee12e2723c72b45 | 766.97 |
| /dashboard | 200 | 7f25d4d11f82fbf2b3252c0ce8a5c4dfaa87393524 | 304.9 |
| /dashboard | 200 | 00b3b7e14f1f8631bfbc3fbc9e6f00e16b0c4dd38e | 1242.48 |
| /dashboard | 200 | 00b3b7e14f1f8631bfbc3fbc9e6f00e16b0c4dd38e | 1111.35 |
| /dashboard | 200 | 00b3b7e14f1f8631bfbc3fbc9e6f00e16b0c4dd38e | 1166.31 |
| /dashboard | 200 | 00b3b7e14f1f8631bfbc3fbc9e6f00e16b0c4dd38e | 1104.25 |
| /dashboard | 200 | 7090a15606043f5dca6563331c55ee146b47af0ca5 | 654.61 |
| /dashboard | 200 | 0094d735db05be39f4afc7c9c078141abe0e8bca24 | 1148.24 |
| /dashboard | 200 | 40634e7c11ddce5d638b11d7e60f07f03cfabbebce | 444.13 |
| /dashboard | 200 | 004927b239e1d7ca73f62b40f75b17c505562c00b9 | 401.9 |
| /dashboard | 200 | 0024df18ebbdd8f9bd5d4778cf1812b38d2942ab48 | 498.71 |
| /dashboard | 200 | 409cb6a7f328d223426c5cfa0769cef243c33dd686 | 2350.82 |

## Step Timings

| Step | ms | Status |
| --- | ---: | --- |
| setup_proof_tenant | 1965.83 | OK |
| wait_for_dev_server | 8171.2 | OK |
| browser_goto_dashboard | 3897.23 | OK |
| open_booking_modal | 261.63 | OK |
| fill_customer_step | 797.92 | OK |
| fill_booking_step | 8235.8 | OK |
| submit_create_booking_until_success_visible_and_business_rows | 2962.96 | OK |
| run_browser_create_booking_flow | 17463.25 | OK |
| cleanup_delete_accounting_outbox_by_reference_ids | 79.51 | OK |
| cleanup_delete_session_logs | 102.84 | OK |
| cleanup_delete_revenue | 88.03 | OK |
| cleanup_delete_bookings | 122.78 | OK |
| cleanup_delete_packages | 86.22 | OK |
| cleanup_delete_customers | 173.53 | OK |

## Classification

Root cause remains NOT_PROVEN unless this UI timing is compared with the DB/action-wrapper baselines and repeated enough to rule out dev-server cold start/noise.
