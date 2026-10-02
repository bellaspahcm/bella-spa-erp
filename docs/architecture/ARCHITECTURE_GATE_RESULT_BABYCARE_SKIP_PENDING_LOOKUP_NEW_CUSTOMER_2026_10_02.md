# ARCHITECTURE_GATE_RESULT - BabyCare Skip Pending Lookup For Newly Created Customer

Date: 2026-10-02
Status: PASS
Scope: Narrow BabyCare Create Booking performance hardening

## 1. Bella OS/Product Development Process Gate

This change follows Root Cause -> Minimal Fix -> Verify -> Seal -> Stop.

The current evidence shows Create Booking DB critical path is the dominant measured contributor, but the full save root cause remains NOT_PROVEN. The approved fix removes one proven redundant DB round trip only for customers created in the same Create Booking request.

## 2. Product Manifest

Product: Bella BabyCare legacy through the shared booking workflow.

Capability touched:

- Create Booking
- Customer creation branch inside Create Booking

Capabilities not touched:

- Audit
- Accounting outbox
- Revenue business truth
- Session creation
- Revalidation
- Package module scope
- Tenant/module entitlement
- Finance ownership
- Healthcare Kernel
- Education Kernel
- Logistics Kernel

## 3. Ownership Map

| Data | Owner | Change authority |
| --- | --- | --- |
| customers | BabyCare/shared booking legacy | Read/write already existing in Create Booking |
| bookings | BabyCare/shared booking legacy | Read/write already existing in Create Booking |
| packages | Service package contract | No change |
| tenants.enabled_modules | Tenant/module entitlement | No change |
| revenue | Finance-adjacent legacy revenue path | No change |
| accounting_outbox | Existing accounting outbox | No change |
| audit_logs | Existing audit mechanism | No change |

## 4. Contract Dependency Map

```text
Create Booking UI
  -> lifecycle-actions.createBooking
  -> create-booking-action.createBooking
  -> create-booking-helpers
  -> existing Supabase tables
```

No Kernel contract is modified.

## 5. Change Authority

Authorized:

- Mark whether `createCustomerForBookingIfNeeded` created a customer in the current request.
- Skip `findPendingBookingForCustomer` only when that marker is true.
- Preserve the existing lookup for existing customers.
- Add targeted tests.

Not authorized:

- Transaction rewrite
- Audit rewrite
- Outbox rewrite
- Revalidation change
- DB schema or migration
- Parallelization
- Broad helper refactor
- Cross-product performance work

## 6. UI -> Contract Reconciliation

No UI contract change.

Expected runtime behavior:

```text
New customer booking:
  insert customer
  skip pending-booking lookup for that new customer id
  create booking as before

Existing customer booking:
  keep pending-booking lookup exactly as before
```

## 7. Additive Migration Plan

None.

No schema, migration, seed, cleanup, or production data mutation is authorized.

## 8. 11 Automated Verification Gates Plan

| Gate | Plan |
| --- | --- |
| Type safety | Targeted Jest/TS coverage only; no broad typecheck claim |
| Unit behavior | Assert new-customer path skips pending lookup |
| Regression behavior | Assert existing-customer path keeps pending lookup |
| Functional create booking | Targeted Create Booking tests |
| Auditability | No audit path changes |
| Outbox | No outbox path changes |
| Tenant isolation | Tenant/package scope validation unchanged |
| Atomicity/rollback | Existing rollback path unchanged |
| Real DB proof | Dedicated E2E/proof only |
| Performance proof | Correlated trace before/after |
| Production safety | BabyCare production untouched |

## Result

PASS for the approved minimal fix only.

Runtime performance implementation may proceed only within this boundary.
