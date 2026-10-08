# ARCHITECTURE_GATE_RESULT_PR250_MAIN_CI_REAL_DB_FIX_2026_10_08

## Status

```ini
PR250_MAIN_CI_REAL_DB_FIX = PASS
CHANGE_TYPE = TEST_FIXTURE_ISOLATION + CI_PROOF_ROUTING
WAREHOUSE_RUNTIME_CHANGE = NO
LOGISTICS_KERNEL_CHANGE = NO
HEALTHCARE_KERNEL_CHANGE = NO
DB_SCHEMA_CHANGE = NO
RLS_CHANGE = NO
```

## Root Cause

`main` push CI for PR #250 failed in `CI - Quality Gates / Real Database Business E2E`, not in Warehouse runtime.

Failing suite:

```text
src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts
```

Observed failure:

```text
attendance read-back returned 0 rows after completion
PGRST116: Cannot coerce the result to a single JSON object
```

The proof reused tenants by fixed names across Real DB reruns:

```text
Beauty V2 Go Live Payroll Proof Tenant
Beauty V2 Go Live Payroll Proof Other Tenant
```

On shared Real DB reruns, retained append-only history can keep tenant shells alive. Reusing those tenants makes the proof less isolated than the rest of the Beauty V2 branch/payroll Real DB tests, which create unique tenant IDs per run.

The CI scope router also did not classify this specific Real DB proof file as a Real DB trigger, so a focused PR repair could skip the exact proof that failed on `main`.

## Minimal Fix

Create unique proof tenant IDs and names for each run.

Add the focused Beauty V2 go-live payroll proof file to the Real DB CI trigger allowlist so PR repair branches run the same class of proof before merge.

No runtime behavior was changed.

## Ownership / Boundary

```ini
OWNER = Beauty V2 Real DB proof harness
CONSUMER = CI Real Database Business E2E
CHANGE_AUTHORITY = test fixture isolation only
```

## Verification Plan

```ini
FOCUSED_TEST = src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts
TYPECHECK_CHANGED = run if local dependencies available
DIFF_CHECK = required
NO_ANY_CHANGED_FILES = required
REAL_DB_CI = required after PR push
```

## Stop Condition

After focused verification and PR CI, stop. Do not modify Warehouse, Logistics Kernel, RLS, schema, or production configuration.
