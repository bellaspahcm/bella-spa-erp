# F2 CASH & TREASURY ENGINE — FREEZE RECORD

> **STATUS: 🔒 FINAL FREEZE**
> This document is the authoritative freeze declaration for the F2 Cash & Treasury Engine.
> Once signed, no modification to F2 schema, RPCs, triggers, or invariants is permitted
> except through the Change Control process defined below.

---

## Freeze Metadata

| Field | Value |
|---|---|
| **Phase** | F2 Cash & Treasury Engine |
| **Freeze Date** | 2026-08-15T22:24:46+07:00 |
| **Commit SHA** | `7d0b2b3aab3a9c7cf97f2b8ec5893b73998015b2` |
| **Migration Range** | `20260816000000` → `20260816040000` |
| **Test Gate** | 79/79 PASS |
| **Architect Approval** | APPROVED — Final Freeze |
| **Prerequisites** | F0 FROZEN ✅, F1 FROZEN ✅ |

---

## Migration Inventory (F2 Exclusive)

| Migration | Description | Status |
|---|---|---|
| `20260816000000_finance_cash_engine_v1.sql` | Core tables: bank_accounts, cash_positions, cash_movements, quarantine | FROZEN |
| `20260816005000_finance_cash_projection_rpc.sql` | `finance_internal_record_cash_movement` initial version | FROZEN |
| `20260816010000_finance_cash_engine_grants.sql` | GRANT/REVOKE for F2 RPCs | FROZEN |
| `20260816020000_finance_ledger_emit_v2_events.sql` | F1 event contract extension: `posted.v2` with `cash_leg_id` | FROZEN |
| `20260816021000_finance_quarantine_rpc.sql` | `finance_internal_quarantine_cash_event` RPC | FROZEN |
| `20260816022000_finance_project_transaction_rpc.sql` | `finance_internal_project_cash_transaction` multi-leg atomic RPC | FROZEN |
| `20260816030000_finance_cash_reconstruction_rpc.sql` | `finance_reconstruct_cash_positions` RPC | FROZEN |
| `20260816040000_finance_cash_concurrency_locks.sql` | Bank Account Lock Protocol, deterministic ordering, immutability hardening | FROZEN |

---

## Architecture Boundary

```
                    FINANCE OS
                        │
              ┌─────────┴─────────┐
              │                   │
             F1                  F2
          LEDGER              CASH/TREASURY
             │                   │
       Financial Truth       Derived Cash Truth
             │                   │
       transactions         cash_movements (immutable)
       journal entries            │
             │                    ▼
             │             cash_positions (derived)
             │                    │
             └────── EVENT ───────┘
              finance.transaction.posted.v2
              finance.transaction.reversed.v2
```

### Invariant: F2 is downstream of F1

- F2 **reads** F1 events. F2 **never writes** to F1.
- `cash_movements` is an immutable ledger of cash facts derived from F1 postings.
- `cash_positions` is a materialised derived state of `cash_movements`. It can be destroyed and rebuilt — `cash_movements` is the source of truth for reconstruction.
- F1 `finance_transactions` remain the **single source of accounting truth**.

---

## Frozen Components

### Tables (FROZEN — no schema changes permitted)

| Table | Purpose |
|---|---|
| `finance_bank_accounts` | Registry of external bank/cash accounts |
| `finance_cash_positions` | Materialised cash balance per bank account |
| `finance_cash_movements` | Immutable cash movement history |
| `finance_cash_quarantine` | Failed projection events awaiting resolution |
| `finance_cash_staged_lines` | Bank statement staging for reconciliation |

### RPCs (FROZEN — no signature or logic changes permitted)

| RPC | Purpose |
|---|---|
| `finance_internal_record_cash_movement` | Single-leg trusted cash recorder |
| `finance_internal_project_cash_transaction` | Multi-leg atomic projection entry point |
| `finance_internal_quarantine_cash_event` | Terminal failure quarantine recorder |
| `finance_reconstruct_cash_positions` | Privileged position rebuilder |

### Triggers (FROZEN)

| Trigger | Table | Protection |
|---|---|---|
| `trg_finance_cash_mutation_guard` | `finance_cash_movements`, `finance_cash_positions` | Blocks direct UPDATE/DELETE on movements; blocks INSERT without trusted RPC context |

---

## Change Control Policy

### PROHIBITED post-freeze (without Human Architect review + ADR)

- Any `ALTER TABLE` on F2 tables that changes column types, adds/removes constraints, or drops columns
- Any change to RPC signatures (`finance_internal_*`, `finance_reconstruct_*`)
- Any change to trigger logic that weakens the mutation guard
- Any new write path into `finance_cash_movements` that bypasses `finance_internal_record_cash_movement`
- Any relaxation of RLS policies on F2 tables

### PERMITTED without Human Architect review

- New **read-only** views or indexes on F2 tables
- New **additive** columns that are nullable with no enforcement logic
- Performance tuning (VACUUM settings, index creation/drop) that does not change behaviour
- Bug fixes for security defects — must be documented in an ADR within 48 hours

---

## Downstream Consumption Rules (for F3+)

```
F3 AR/Invoicing → MUST:
  ✓ Consume finance_bank_accounts, finance_cash_positions, finance_cash_movements
    via CashEngineService read APIs (contract)
  ✓ Trigger payment flow via F1 POST → finance.transaction.posted.v2 → F2
  ✗ NEVER write to finance_cash_movements directly
  ✗ NEVER write to finance_cash_positions directly
  ✗ NEVER call finance_internal_record_cash_movement from F3 code
```

The correct F3 payment flow:

```
Invoice (F3)
    ↓
Payment recorded (F3)
    ↓
finance_post_transaction (F1 RPC)
    ↓
finance.transaction.posted.v2 (event)
    ↓
CashProjectionWorker (F2)
    ↓
finance_cash_movements + finance_cash_positions
```
