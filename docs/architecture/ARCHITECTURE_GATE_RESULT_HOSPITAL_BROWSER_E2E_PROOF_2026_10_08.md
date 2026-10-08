# Architecture Gate Result: Hospital Browser E2E Proof

Date: 2026-10-08

## Status

```text
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = PROVEN_FOR_CODE_RUNTIME_SCOPE
HOSPITAL_REAL_DB_RLS_PROOF = PASS
HOSPITAL_BROWSER_E2E_PROOF = PASS_FOR_READ_ONLY_AUTHENTICATED_ROUTE_SCOPE
GO_LIVE_DECISION = NO
```

## Scope

This gate proves authenticated Browser E2E route rendering for the current Hospital Go-Live surface.

This is not Real DB/RLS proof, not production integrity, not Backup/Restore readiness, not Finance worker execution, and not a human Go-Live decision.

## Browser Surface Proven

```text
/dashboard/hospital
/dashboard/hospital/admissions
/dashboard/hospital/beds
/dashboard/hospital/ancillary
/dashboard/hospital/nursing-vitals
/dashboard/hospital/mar
/dashboard/hospital/billing
```

## Root Causes Found

```text
SHARED_DASHBOARD_ALERTS_DEV_AUTH_CONTEXT
= getImportantAlerts used the default SSR Supabase client while the local authenticated E2E context used dev mock auth.

LEGACY_HOSPITAL_BROWSER_DIRECT_HEALTHCARE_PERSISTENCE
= browser Hospital UI paths attempted direct hc_* REST reads for fallback legacy data.

NURSING_PHARMACY_BROWSER_ENGINE_DIRECT_KERNEL_READS
= browser hooks called Healthcare engines directly, which triggered Kernel table access from the browser surface.
```

## Minimal Fixes

```text
getImportantAlerts()
  -> uses createDevelopmentBypassClient() so the existing dev mock E2E auth context can read dashboard alerts without RLS view failure.

healthcare-hospital-services browser boundary
  -> rejects direct Hospital browser access to Healthcare persistence tables, preserving existing fallback behavior.

Nursing and Pharmacy browser hook boundary
  -> returns controlled public-boundary failures in browser instead of issuing direct Kernel table reads.
```

## Boundaries Preserved

```text
NO Hospital direct hc_* browser access accepted as runtime proof
NO Healthcare Kernel bypass added
NO Real DB/RLS status changed by Browser E2E
NO production mutation
NO Finance worker execution claimed
NO Browser E2E mutation chain claimed
```

## Verification Evidence

Focused Browser E2E:

```text
npx playwright test e2e/tests/33-hospital-browser-e2e.spec.ts --project=chromium
= PASS

Tests: 7 passed
```

Focused regression:

```text
npx jest src/__tests__/dashboard-actions.test.ts --runInBand
= PASS

npx jest src/products/bella-hospital/__tests__/hospital-nursing-contract-runtime.test.ts src/products/bella-hospital/__tests__/hospital-medication-pharmacy-mar-contract-trace.test.ts src/products/bella-hospital/services/__tests__/hospital-nursing-minimal-runtime.test.ts src/products/bella-hospital/services/__tests__/hospital-medication-pharmacy-mar.service.test.ts --runInBand
= PASS

npx jest src/products/bella-hospital/__tests__/hospital-go-live-business-chain-proof.test.ts --runInBand
= PASS
```

## Canonical Status

```text
HOSPITAL_GO_LIVE_BUSINESS_CHAIN = PROVEN_FOR_CODE_RUNTIME_SCOPE
HOSPITAL_REAL_DB_RLS_PROOF = PASS
HOSPITAL_BROWSER_E2E_PROOF = PASS_FOR_READ_ONLY_AUTHENTICATED_ROUTE_SCOPE

FINANCE_WORKER_EXECUTION = NOT_PROVEN
REAL_DB_LEDGER_PERSISTENCE = NOT_PROVEN
RECONCILIATION_READ_BACK = NOT_PROVEN
PRODUCTION_INTEGRITY = NOT_PROVEN
GO_LIVE_DECISION = NO
```

## Next Required Capability

```text
HOSPITAL_FINANCE_WORKER_EXECUTION_PROOF
```

Do not treat this Browser E2E proof as production readiness or as a replacement for Finance worker, ledger persistence, reconciliation, production integrity, or Backup/Restore evidence.
