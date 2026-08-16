# F4 ACCOUNTS PAYABLE ENGINE — ARCHITECTURAL INVARIANTS

> **Freeze Status: 🔒 FROZEN**
> This document is the authoritative invariant ledger for F4.
> Every invariant listed here is enforced at the database layer and verified by integration tests.
> Any proposed change that weakens an invariant requires Human Architect review and a new ADR.

---

## Invariant Classification

- **P0** — Must never be violated under any circumstances. System is corrupt if broken.
- **P1** — Must hold in production. Breaking requires incident response.
- **P2** — Architectural guidance. Violations are tracked and remediated.

---

## F4 Core Invariants

### F4-I-1: Positive Monetary Facts (P0)

> No zero or negative amount facts may be recorded. All entries in the subledger and allocation logs must represent positive values.

**Enforcement:**
- Checked via `CHECK (amount_minor > 0)` and `CHECK (allocated_amount_minor > 0)` constraints on all subledger tables (`finance_vendor_bills`, `finance_vendor_bill_lines`, `finance_payable_ledger`, `finance_payable_allocations`, `finance_vendor_prepayments`).
- Negative adjustments or refunds are recorded strictly as separate fact entries with compensatory flags, leaving historic postings untouched.

**Test Evidence:** Verified by test suite functional cases.

---

### F4-I-2: Currency Consistency & FX Provenance (P0)

> If a vendor bill currency differs from a cash outflow currency, an explicit exchange rate and rate direction validation are required.

**Enforcement:**
- Checked dynamically inside `finance_disburse_payment()`. Mismatched currencies raise `FX_RATE_REQUIRED` if the exchange rate defaults to `1.0` or if no valid rates are provided.
- Table check constraints enforce that `rate_direction` is set to `'BILL_TO_CASH'`.

**Test Evidence:** Verified in F4 Proof Runner currency validation tests.

---

### F4-I-3: Reversal Symmetry (P0)

> Reversals must match the original allocation amount and currency details exactly. Each disbursement allocation can be reversed at most once.

**Enforcement:**
- Enforced by `finance_reverse_disbursement()`, which reads the standard disbursement and replicates its cash and allocated amounts exactly into a new `REVERSAL` record.
- The conditional index `uq_payable_allocations_reversal` blocks duplicate reversals of the same original allocation ID at the database level.

**Test Evidence:** Verified by G5-03/G5-04 and reversal tests in the F4 Proof Runner.

---

### F4-I-4: Tenant FK Consistency (P0)

> All F4 operations are strictly scoped to the tenant. Cross-tenant foreign key references are structurally blocked at the schema layer.

**Enforcement:**
- All F4 tables enforce composite unique keys `(tenant_id, id)`.
- Foreign keys from child tables (e.g. `finance_vendor_bill_lines` referencing `finance_vendor_bills`) reference `(tenant_id, vendor_bill_id)`, preventing any cross-tenant relationship.
- Row-Level Security (RLS) policies scope all SELECTs and INSERTs to the authenticated tenant.

**Test Evidence:** G7-01 and G7-03 tests in the F4 Proof Runner.

---

### F4-I-5: Lock Ordering & Deadlock Prevention (P1)

> Any transaction that mutates AP states must acquire advisory locks in a deterministic order to prevent concurrent lock-order deadlocks.

**Enforcement:**
- **Cash Path:** Locks `CASH_MOVEMENT` (advisory) ➔ `BILL` (row lock) ➔ `POSITION` (row lock) ➔ `ALLOCATION` (row lock).
- **Prepayment Path:** Locks `VENDOR` (advisory) ➔ `BILL` (row lock) ➔ `PREPAYMENT` (row lock).
- Lock hashing uses namespaced prefix hashing to prevent key overlap across resource types.

**Test Evidence:** G4-01 and G4-02 concurrency tests.

---

### F4-I-6: Decoupled F1/F2 Boundaries (P1)

> F4 has no direct table dependency on F1 accounts/periods or F2 cash tables. All validations and reads occur via contract interfaces.

**Enforcement:**
- Checks expense accounts via F1 public contract `finance_validate_account_code()` and `finance_validate_account_id()`.
- Checks fiscal periods via F1 public contract `finance_validate_period_for_date()`.
- Reads cash movements via F2 contract function `finance_get_cash_movement()`.

**Test Evidence:** G2-02 and G7-03 tests.

---

### F4-I-7: Scoped Idempotency (P0)

> Postings retried with the same `posting_attempt_id` must return the canonical output without creating duplicate database records.

**Enforcement:**
- Unique constraints `uq_finance_vendor_bills_attempt`, `uq_payable_allocations_attempt`, and `uq_vendor_prepayments_attempt` prevent duplicate postings.
- RPC entry points check for unique violation or pre-existing attempt IDs and safely bypass mutations, returning the existing transaction/allocation ID.

**Test Evidence:** G3-01 and G3-02 tests.

---

### F4-I-8: Position Cache Reconstruction (P0)

> Payable position cash balances are non-authoritative derived state and must always be 100% reconstructible from subledger facts.

**Enforcement:**
- `finance_rebuild_payable_position()` computes positions directly from the history of `PAYABLE_ACCRUAL`, `DISBURSEMENT_ALLOCATION`, and `REVERSAL` facts in `finance_payable_ledger`.
- Updates to positions are restricted to administrative contexts and authorized RPC procedures.

**Test Evidence:** G6-01 to G6-03 tests.

---

## Invariants Summary Table

| Invariant | Priority | Mechanism | Verification Test |
|---|---|---|---|
| F4-I-1: Positive facts | P0 | Check constraints on amount fields | Functional / proof |
| F4-I-2: Currency consistency | P0 | RPC validations & check constraints | Currency validation tests |
| F4-I-3: Reversal symmetry | P0 | Unique index & RPC verification | G5-03, G5-04 |
| F4-I-4: Tenant FK consistency | P0 | RLS & composite foreign keys | G7-01, G7-03 |
| F4-I-5: Lock Ordering | P1 | Deterministic advisory and row lock order | G4-01, G4-02 |
| F4-I-6: Decoupled boundaries | P1 | F1 / F2 public contracts | G2-02, G7-03 |
| F4-I-7: Scoped Idempotency | P0 | Attempt ID unique constraints | G3-01, G3-02 |
| F4-I-8: Position Reconstruction | P0 | Facts aggregation in rebuild RPC | G6-01 to G6-03 |
