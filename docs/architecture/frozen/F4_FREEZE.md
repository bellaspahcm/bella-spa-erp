# F4 ACCOUNTS PAYABLE ENGINE — FREEZE RECORD

> **STATUS: 🔒 FINAL FREEZE**
> This document is the authoritative freeze declaration for the F4 Accounts Payable (AP) Engine.
> Once signed, no modification to F4 schema, RPCs, triggers, or invariants is permitted
> except through the Change Control process defined below.

---

## Freeze Metadata

| Field | Value |
|---|---|
| **Phase** | F4 Accounts Payable Engine |
| **Freeze Date** | 2026-08-16T07:55:00+07:00 |
| **Commit SHA** | `1a6b4b4ddab5c7cf97f2b8ec5893b73998016c1` |
| **Migration Range** | `20260818000000` |
| **Test Gate** | 20/20 PASS (Proof), 175/175 PASS (Finance), 504/504 PASS (Healthcare) |
| **Architect Approval** | APPROVED — Final Freeze |
| **Prerequisites** | F0 FROZEN ✅, F1 FROZEN ✅, F2 FROZEN ✅, F3 FROZEN ✅ |

---

## Migration Inventory (F4 Exclusive)

| Migration | Description | Status |
|---|---|---|
| `20260818000000_finance_ap_engine_v1.sql` | Core AP tables, F1 public contract extensions, lock unification, state triggers, and SECURITY DEFINER RPCs | FROZEN |

---

## Architecture Boundary

```
                     FINANCE OS
                         │
       ┌─────────────────┼─────────────────┐
       ↓                 ↓                 ↓
      F1                F2                F3
    LEDGER             CASH            RECEIVABLES (AR)
       │                 │                 │
       │                 ▼                 │
       │           finance_get_cash_       │
       │           movement() (Contract)   │
       │                 │                 │
       └────────┬────────┴─────────────────┘
                │
                ▼
               F4
         PAYABLES (AP)
                │
         finance_vendor_bills (lifecycle)
         finance_payable_ledger (immutable facts)
                │
                ▼
         finance_payable_positions (derived cache projection)
```

### Invariant: F4 is downstream of F1/F2 and isolated from F3

* **F1 Decoupling:** F4 validates accounts and open periods exclusively via public validation contracts: `finance_validate_account_code()`, `finance_validate_account_id()`, `finance_validate_period_for_date()`. No direct queries to F1 tables (`finance_accounts`, `finance_periods`) are permitted.
* **F2 Decoupling:** F4 consumes bank cash outflows via the public contract `finance_get_cash_movement()`, keeping F2 table structures isolated.
* **F3 Compatibility:** Shares the unified `finance_financial_lock_key()` hashing strategy. For cash movements, F4 lock outputs match F3 lock keys byte-for-byte to avoid concurrent deadlock issues.

---

## Frozen Components

### Tables (FROZEN — no schema changes permitted)

| Table | Purpose |
|---|---|
| `finance_vendor_bills` | Vendor invoice records, due dates, currencies, and lifecycle status |
| `finance_vendor_bill_lines` | Itemized bill expense lines |
| `finance_payable_ledger` | Immutable fact log of accruals, disbursements, and reversals |
| `finance_payable_allocations` | Dual-sided matches between outflows and vendor bills with FX details |
| `finance_payable_positions` | Rebuildable projection cache (Gross, Disbursed, Net outstanding) |
| `finance_vendor_prepayments` | Immutable event facts for recorded, applied, or refunded prepayments |

### RPCs (FROZEN — no signature or logic changes permitted)

| RPC | Purpose |
|---|---|
| `finance_approve_vendor_bill` | Validates lines, posts F1 GL entry, inserts subledger accrual fact, and caches position |
| `finance_disburse_payment` | Locks cash & bill, validates ceilings, posts GL disbursement, and allocates outflow |
| `finance_reverse_disbursement` | Performs compensation reversal, posts GL reversing entry, and updates cash/bill position |
| `finance_record_prepayment` | Locks vendor, posts prepayment asset transaction, and records fact |
| `finance_apply_prepayment` | Locks vendor & bill, validates balance, posts GL application, and matches fact |
| `finance_calculate_payable_position` | Pure read projection math for gross and net vendor exposure |
| `finance_rebuild_payable_position` | Administrative rebuild of position cache from immutable facts |

### Triggers (FROZEN)

| Trigger | Table | Protection |
|---|---|---|
| `trg_finance_vendor_bill_lines_guard` | `finance_vendor_bill_lines` | Blocks mutations on line items once bill is APPROVED or REVERSED |
| `trg_finance_vendor_bill_header_guard` | `finance_vendor_bills` | Restricts mutations on financial fields of approved bills and guards forward-only transitions |

---

## Change Control Policy

### PROHIBITED post-freeze (without Human Architect review + ADR)

* Any `ALTER TABLE` on F4 tables that changes column types, adds/removes constraints, or drops columns.
* Any change to RPC signatures (`finance_approve_*`, `finance_disburse_*`, `finance_reverse_*`, `finance_record_*`, `finance_apply_*`, `finance_rebuild_*`).
* Any change to trigger logic that weakens the mutation guards.
* Any direct bypass of the F1/F2 validation and read contracts.
* Any relaxation of RLS policies on F4 tables.

### PERMITTED without Human Architect review

* New **read-only** views or indexes on F4 tables.
* New **additive** columns that are nullable with no enforcement logic.
* Performance tuning (VACUUM settings, indexes) that does not change functional behavior.
* Bug fixes for security/concurrency defects — must be documented in an ADR within 48 hours.

---

## Downstream Integration Rules

```
Vertical OS Layers (Healthcare/Education Products) → MUST:
  ✓ Post Vendor Bills and apply Prepayments/Payments strictly via F4 Capability Contract APIs.
  ✓ Respect the deterministic lock ordering to prevent deadlock scenarios.
  ✗ NEVER select or insert into finance_payable_ledger or finance_vendor_prepayments directly.
  ✗ NEVER bypass RLS isolation policies.
```
