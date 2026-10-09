# Architecture Gate Result - Hospitality Phase 4 Folio + Payment

Date: 2026-10-08

## Result

```ini
GATE = PASS
PHASE = 4_FOLIO_PAYMENT
CODE_AUTHORIZED = YES
DB_AUTHORIZED = YES
UI_AUTHORIZED = NO
ROUTE_IMPLEMENTATION_AUTHORIZED = NO
HOUSEKEEPING_AUTHORIZED = NO
MAINTENANCE_AUTHORIZED = NO
FNB_AUTHORIZED = NO
REVENUE_ENGINE_AUTHORIZED = NO
TRAVEL_AUTHORIZED = NO
RESOURCE_KERNEL_AUTHORIZED = NO
ALLOCATION_ENGINE_AUTHORIZED = NO
PAYMENT_ENGINE_AUTHORIZED = NO
```

## Problem / Non-Goals

Phase 4 opens the final Hotel Core transaction capability: an active or
completed stay can receive a product-owned folio, the folio can post a room
charge, Finance can recognize the receivable through its public contract, and
a confirmed payment can be allocated to that receivable through the same
Finance contract.

Authorized chain:

```text
Guest
  -> Stay
  -> Folio
  -> Folio Item
  -> Finance Receivable Contract
  -> Outstanding Balance
  -> Finance Payment Allocation Contract
  -> Settled Folio
  -> Closed Folio
```

Non-goals:

- Hospitality payment engine
- Direct writes to Finance tables
- Generic receivable, revenue, or accounting engine
- Housekeeping
- Maintenance
- F&B
- Travel / Tour
- Generic Resource / Availability / Allocation kernel
- Generic allocation engine

## Truth and Source of Truth

| Question | Source | Result |
| --- | --- | --- |
| Product identity | Phase 0 ProductRegistry / ProductResolver proof | `bella_hospitality` is sealed |
| Hotel physical foundation | Phase 1 Real DB / RLS proof | Property, Room Type, and Room are sealed |
| Guest + reservation | Phase 2 Real DB / RLS proof | Guest, Reservation, Reserved Room are sealed |
| Stay and occupancy | Phase 3 Real DB / RLS proof | Active/completed stay is sealed |
| Receivable/payment primitives | `ISemanticReceivableChargeContract` | Finance owns recognition and payment allocation |
| Resource kernel | `RESOURCE_AVAILABILITY_ALLOCATION_DECISION_2026_10_08.md` | Not created |
| Folio semantics | User-approved Phase 4 boundary | Hospitality owns folio, items, and finance links only |

## Business Test Contract

| Rule | Canonical source | Expected invariant |
| --- | --- | --- |
| Folio | Phase 4 boundary | A folio belongs to one tenant/property/stay/guest |
| Folio item | Phase 4 boundary | A posted room charge belongs to one folio and positive amount |
| Receivable recognition | Finance public contract | Hospitality sends `SERVICE_RECEIVABLE_RECOGNIZED`; Finance returns invoice/receivable identifiers |
| Outstanding balance | Phase 4 boundary | Product balance increases after charge recognition and decreases after payment application |
| Payment allocation | Finance public contract | Payment allocation is requested by invoice through `allocateConfirmedPaymentToInvoiceReceivable` |
| Overpayment | Phase 4 boundary | Hospitality rejects payment amount greater than current folio outstanding |
| Closure | Phase 4 boundary | Only a settled folio can be closed |
| Tenant isolation | Bella RLS contract | Tenant A cannot read Tenant B folio rows through RLS |

Hospitality does not record debit/credit, account codes, cash movements, or AR
allocation internals. Those remain Finance-owned.

## Product Manifest Delta

Phase 4 does not change ProductRegistry. It adds product-owned Hospitality
contracts under the sealed `bella_hospitality` identity:

```text
Folio
Folio Item
Folio Finance Link
Folio Payment Application Link
```

## Ownership Map

| Data / Contract | Owner | Phase 4 action |
| --- | --- | --- |
| `bella_hospitality` product key | Platform Product Registry | Reuse |
| Party identity | Platform Party | Reuse via Hospitality Guest |
| Stay | Hospitality Product Phase 3 | Reuse sealed table |
| Folio | Hospitality Product | Create product table and service contract |
| Folio Item | Hospitality Product | Create product table and service contract |
| Receivable recognition | Finance OS | Reuse public contract only |
| Payment allocation | Finance OS | Reuse public contract only |
| Finance invoice / cash / AR tables | Finance OS | No direct access |
| Hospitality payment engine | Not authorized | Not created |
| Resource / Availability / Allocation kernel | Not created | Forbidden |

## Contract Dependency Map

```text
Tenant.product_key = bella_hospitality
  -> ProductRegistry / ProductResolver
  -> Hospitality Stay
  -> Hospitality Folio
  -> Hospitality Folio Item
  -> Finance ISemanticReceivableChargeContract
       -> recognizeServiceReceivable
       -> allocateConfirmedPaymentToInvoiceReceivable
```

## Change Authority

Authorized:

- New product-owned files under `src/products/bella-hospitality/`
- New additive migration creating folio and folio link tables
- Static/unit/Real DB tests for folio, finance contract boundary, balance,
  payment application, closure, RLS, and migration shape

Not authorized:

- Healthcare H1-H12 files or `hc_*` tables
- Education kernel files
- Logistics E7.1/E7.2/E7.3 files
- Beauty H5/H8 files
- App route/UI files
- Finance services, engines, migrations, or tables
- Travel/Tour files
- Global Resource / Availability / Allocation kernel

## UI -> Contract Reconciliation

No UI is modified in Phase 4.

## Additive Migration Plan

Create product-owned tables only:

```text
hospitality_folios
hospitality_folio_items
hospitality_folio_finance_links
hospitality_folio_payment_applications
```

Each table:

- Has `tenant_id`
- Has RLS enabled
- Has authenticated/service role grants
- Uses additive `CREATE TABLE IF NOT EXISTS`
- Stores Finance identifiers as opaque link fields returned by the public
  Finance contract

No migration modifies Platform, Beauty, Healthcare, Education, Logistics,
Finance, Housekeeping, Travel, or Resource tables.

## 11 Automated Verification Gates Plan

1. Folio service unit tests prove Open -> Charge -> Outstanding -> Payment -> Settled -> Closed.
2. Unit tests prove Finance is called through `ISemanticReceivableChargeContract` only.
3. Migration shape test proves additive folio tables, RLS, grants, and no direct Finance table FK/write.
4. Real DB test proves Stay -> Folio -> Charge -> Payment application with persisted links.
5. Real DB negative test proves overpayment rejection and no product payment application row.
6. Real DB RLS test proves same-tenant visibility and cross-tenant invisibility for folios.
7. Product identity regression tests prove `bella_hospitality` still resolves through ProductRegistry/ProductResolver.
8. Static architecture tests prove no direct Finance internals and no Resource kernel / allocation engine.
9. `npm run arch:guard` protects sealed Logistics E7.1/E7.2/E7.3.
10. Scoped ESLint and `npm run typecheck:changed` must pass with zero diagnostics.
11. `npm run db:migration:zero-downtime`, `npm run db:migration:check` with `BASE_REF=origin/main`, and `git diff --check` must pass.

## Decision

```ini
HOSPITALITY_PHASE4_FOLIO_PAYMENT = PASS
FOLIO = CREATED
FOLIO_ITEM = CREATED
FINANCE_RECEIVABLE_CONTRACT = REUSED
FINANCE_PAYMENT_ALLOCATION_CONTRACT = REUSED
HOSPITALITY_PAYMENT_ENGINE = NOT_CREATED
HOUSEKEEPING = NOT_STARTED
MAINTENANCE = NOT_STARTED
FNB = NOT_STARTED
TRAVEL = NOT_STARTED
RESOURCE_KERNEL = NOT_CREATED
ALLOCATION_ENGINE = NOT_CREATED
```
