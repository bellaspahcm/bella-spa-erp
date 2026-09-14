# Bella English Center E7 Tuition & Billing Architecture Gate Result

**Date:** 2026-09-14
**Status:** ARCHITECTURE GATE PASS
**Scope:** E7 Tuition & Billing for Bella English Center.
**Canonical base:** `origin/main@b386e06f`

---

## Product Manifest

E7 provides English Center-specific tuition operations:

- Tuition plan catalog for programs/classes/enrollments.
- Enrollment/class tuition assignment.
- Product-owned invoice metadata and line items.
- Payment receipt, allocation, settlement status, and receivable views.
- Optional Finance OS posting through injected Finance public contracts.

E7 does not implement a product-owned ledger, cash engine, chart of accounts,
revenue recognition policy, payroll, or teacher compensation.

---

## Ownership Map

| Data / Capability | Owner | E7 Decision |
| --- | --- | --- |
| Tuition plan catalog | English Center Product E7 | Create `english_center_tuition_plans`. |
| Tuition assignment | English Center Product E7 | Create `english_center_tuition_assignments` linked to E2 enrollment and optional E3 class. |
| Invoice metadata / line items | English Center Product E7 | Create product invoice and invoice-line tables. |
| Payment receipt / allocation | English Center Product E7 | Create product payment and allocation tables for operational status. |
| Enrollment context | English Center Product E2 over Education Enrollment Contract | Reuse `english_center_enrollments`; do not mutate Education Kernel. |
| Class context | English Center Product E3 | Reuse `english_center_classes`. |
| Ledger posting mechanics | Finance OS F1 Ledger | Use `ILedgerEngine`; no direct Finance table writes. |
| Cash movement reads | Finance OS F2 Cash Reporting | Use `ICashReportingEngine`; no direct Finance table reads. |
| Chart of accounts and revenue policy | Finance / Enterprise | Not owned by English Center; posting lines must be supplied by finance-owned policy. |
| Tenant / branch authorization | Platform | Product tables use tenant and branch scoped RLS. |

---

## Contract Dependency Map

```text
Bella English Center E7
  -> Product-owned E2/E3 context:
       english_center_enrollments
       english_center_classes
  -> Product-owned E7:
       english_center_tuition_plans
       english_center_tuition_assignments
       english_center_tuition_invoices
       english_center_tuition_invoice_lines
       english_center_tuition_payments
       english_center_tuition_payment_allocations
  -> Finance OS F1:
       ILedgerEngine.postTransaction()
  -> Finance OS F2:
       ICashReportingEngine.getCashMovements()
```

Ledger posting is allowed only when a finance-owned posting instruction is
provided to the product service. English Center does not derive account codes,
COA mappings, or revenue recognition rules.

---

## Additive Migration Plan

Create product-owned tables only:

```text
english_center_tuition_plans
english_center_tuition_assignments
english_center_tuition_invoices
english_center_tuition_invoice_lines
english_center_tuition_payments
english_center_tuition_payment_allocations
```

All tables include `tenant_id`; operational tables include `branch_id`. RLS uses
Platform branch access via `user_org_unit_access`. Migration is additive and
does not alter Education Kernel or Finance Kernel tables.

---

## 11 Verification Gates Plan

| Gate | Required E7 Evidence |
| --- | --- |
| 1. Architecture Compliance | No Education Kernel, Finance Kernel, Healthcare Kernel, or core Platform modification. |
| 2. Contract Boundary | Finance interactions use `ILedgerEngine` / `ICashReportingEngine`; no direct Finance table access. |
| 3. Tenant Isolation | Service validates tenant context on enrollment/class/assignment/invoice/payment. |
| 4. RLS & Authorization | E7 tables use tenant and branch scoped RLS. |
| 5. Database Migration Safety | Additive product tables and indexes only. |
| 6. Event-After-Persistence | No domain events are published in E7 scope. |
| 7. Finance Policy Routing | COA/revenue policy is not hard-coded; posting instruction is external. |
| 8. Temporal Provenance | Invoice/payment records are additive; settlement is derived from allocations. |
| 9. Rule Governance | No accounting policy, discount policy, or revenue rule is embedded in Product. |
| 10. Audit Evidence Integrity | Product records keep finance transaction ids and idempotency keys for traceability. |
| 11. Platform Regression | Run focused E7 tests, English Center regression, scoped typecheck, migration checks, architecture guard, and relevant conformance gates. |

---

## Architectural Gap Decision

`ARCHITECTURAL GAP DETECTED` is not triggered for E7 because the required
Finance public contracts exist:

- `ILedgerEngine` for ledger posting.
- `ICashReportingEngine` for cash movement reads.

E7 proceeds as an English Center product extension. Finance / Enterprise still
owns account mapping and accounting treatment; English Center only passes
finance-owned posting instructions through the public contract.
