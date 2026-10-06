# Architecture Gate Result: Haircut Chain Integration

Date: 2026-10-06

## Status

PASS FOR EVIDENCE ONLY

This gate authorizes only proof-harness changes needed to verify existing sealed Haircut components across Real DB integration boundaries.

## Scope

Booking -> Attendance -> Service/Package execution -> Inventory -> Payment/Revenue -> Payroll -> Commission -> Finance/AR -> Read-back.

## Product Manifest

- Product: Bella Haircut Shop
- Product key: `bella_haircut`
- Existing capabilities consumed: Core order booking/session/payment, Beauty/HR salary recalculation, inventory session consumption, Finance F3 AR.

## Ownership Map

- Product identity: Product Registry and `tenants.product_key`.
- Booking/session/payment: Core order services.
- Branch access: Platform org/people model.
- Inventory: existing inventory session consumption.
- Payroll/commission: existing salary recalculation and session commission payload.
- Finance/AR: existing Finance F3 receivable allocation.

## Change Authority

Authorized:

- Focused Real DB proof fixtures/tests.
- Proof harness fixture repair when existing sealed guards require canonical setup.

Not authorized:

- Runtime Haircut module edits.
- New product features.
- Payroll, Commission, Inventory, Finance, Platform, Healthcare, Logistics, or sealed Haircut refactors.
- New abstractions or contract replacements.

## Verification Plan

Run the focused Real DB proof tests:

```text
npm test -- src/__tests__/haircut-go-live-real-flow.test.ts src/__tests__/haircut-f3-debt-real-db-diagnostic.test.ts --runInBand
```

If Real DB credentials are absent or the suite times out, report `NOT_PROVEN`, not PASS.

## Verification Executed

```text
npm test -- src/__tests__/haircut-go-live-real-flow.test.ts src/__tests__/haircut-nail-chain-seal-real-db.test.ts src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts src/__tests__/inventory-session-consumption-real-db.test.ts src/__tests__/haircut-f3-debt-real-db-diagnostic.test.ts --runInBand
INITIAL RESULT: PARTIAL
INITIAL PASS: haircut-nail-chain-seal-real-db, beauty-v2-go-live-payroll-commission-real-db, inventory-session-consumption-real-db
INITIAL FAIL: haircut-go-live-real-flow, haircut-f3-debt-real-db-diagnostic
```

Follow-up focused reruns after proof-harness fixture repairs:

```text
npm test -- src/__tests__/haircut-go-live-real-flow.test.ts --runInBand
RESULT: FAIL
ROOT: service-role Real DB harness does not set the `app.current_user_id` / auth context required by `user_org_unit_access`, so Haircut branch resolution returns no branch for the current user.

npm test -- src/__tests__/haircut-f3-debt-real-db-diagnostic.test.ts --runInBand
RESULT: FAIL
ROOT: Finance F3 allocation posts the confirmed payment transaction but blocks because no exact F2 inflow cash movement is projected for that transaction.
```

Minimal integration fixes:

- Haircut Real DB proof harness now seeds auth users, product identity, Platform branch org units, person relationships, and branch-aware attendance, then executes server actions through a real signed-in Supabase user session.
- Finance F3 proof harness seeds TT99 semantic mappings through the canonical mapping table to avoid stale overloaded RPC ambiguity.
- Finance ledger outbox dispatcher now accepts both JSON strings and JSONB object payloads from Supabase, allowing the aggregate filter to dispatch the posted.v2 event to F2 cash projection.

Final focused verification:

```text
npm test -- src/__tests__/haircut-go-live-real-flow.test.ts src/__tests__/haircut-nail-chain-seal-real-db.test.ts src/__tests__/beauty-v2-go-live-payroll-commission-real-db.test.ts src/__tests__/inventory-session-consumption-real-db.test.ts src/__tests__/haircut-f3-debt-real-db-diagnostic.test.ts --runInBand
RESULT: PASS
Test Suites: 5 passed, 5 total
Tests: 6 passed, 6 total
Time: 70.707 s
```

## Conclusion

```text
HAIRCUT_CHAIN_INTEGRATION = PROVEN_BY_FOCUSED_REAL_DB_BOUNDARY_SET
SEALED_BASELINE = PRESERVED
HAIRCUT_RUNTIME_MODULE_CHANGE = NO
```
