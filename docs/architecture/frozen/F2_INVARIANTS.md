# F2 CASH & TREASURY ENGINE — ARCHITECTURAL INVARIANTS

> **Freeze Status: 🔒 FROZEN**
> This document is the authoritative invariant ledger for F2.
> Every invariant listed here is enforced at the database layer and verified by integration tests.
> Any proposed change that weakens an invariant requires Human Architect review and a new ADR.

---

## Invariant Classification

- **P0** — Must never be violated under any circumstances. System is corrupt if broken.
- **P1** — Must hold in production. Breaking requires incident response.
- **P2** — Architectural guidance. Violations are tracked and remediated.

---

## F2 Core Invariants

### F2-I-1: F1-First (P0)

> Cash projection can only begin after a valid, POSTED F1 transaction exists.

**Enforcement:**
- `finance_internal_project_cash_transaction`: pre-flight check on `finance_transactions WHERE status = 'POSTED' AND tenant_id = p_tenant_id`
- `finance_internal_record_cash_movement`: secondary check on F1 existence and status

**Test Evidence:** T01–T05 (F2.2 projection worker suite)

---

### F2-I-2: Movement Absolute Immutability (P0)

> `finance_cash_movements` is a permanent historical record. No row may ever be updated or deleted after insertion.

**Enforcement:**
- `finance_cash_mutation_guard` trigger blocks `UPDATE` and `DELETE` on `finance_cash_movements` unconditionally, regardless of role or session variables.
- Only `INSERT` is permitted, and only when `finance.allow_cash_mutation = 'true'` is set in the current transaction (which only occurs inside `finance_internal_record_cash_movement`).

**Test Evidence:** T12 (F2.4), T25 (F2.5)

---

### F2-I-3: Position is Derived State (P0)

> `finance_cash_positions.balance_minor` equals the deterministic sum of all `finance_cash_movements` for that `(tenant_id, bank_account_id)`.

```
cash_positions.balance_minor
  = Σ (CASE WHEN direction = 'INFLOW' THEN amount_minor ELSE -amount_minor END)
    FROM finance_cash_movements
    WHERE tenant_id = ? AND bank_account_id = ?
```

**Implication:** If `cash_positions` is destroyed, it can always be reconstructed exactly from `cash_movements`. `cash_movements` is the authoritative history. `cash_positions` is the cache.

**Test Evidence:** T27 (F2.5) — state reconstruction equality

---

### F2-I-4: Tenant Isolation (P0)

> All F2 operations are strictly scoped to `tenant_id`. No cross-tenant read or write is possible.

**Enforcement:**
- RLS policies on all F2 tables: `tenant_id = get_auth_tenant_id()`
- Composite foreign keys: `FOREIGN KEY (tenant_id, bank_account_id) REFERENCES finance_bank_accounts(tenant_id, id)`
- All RPCs validate `p_tenant_id` matches the target resource's `tenant_id`

**Test Evidence:** T07 (F2.2), T05 (F2.4), T13 (F2.4), T17 (F2.4)

---

### F2-I-5: Idempotent Projection (P0)

> The same F1 transaction leg, delivered multiple times with the same idempotency key, produces exactly one cash movement.

**Enforcement:**
- Unique constraint: `uq_finance_cash_movements_idem (tenant_id, idempotency_key)`
- `finance_internal_record_cash_movement`: pre-INSERT check on `idempotency_key`; on `unique_violation`, re-queries by `idempotency_key` and returns `is_duplicate: true` if found

**Test Evidence:** T19 (F2.5)

---

### F2-I-6: Unique Leg Reference (P0)

> A single F1 transaction leg (`cash_leg_reference`) can only be projected once per `(tenant_id, f1_transaction_id)`, regardless of idempotency key.

**Enforcement:**
- Unique constraint: `uq_finance_cash_movements_leg (tenant_id, f1_transaction_id, cash_leg_reference)`
- On `unique_violation` where `idempotency_key` re-query returns NULL: raises `DUPLICATE_CASH_LEG_REFERENCE` (errcode `F2030`)
- `CashProjectionWorker.isPgTerminalError`: `F2030` → quarantine

**Test Evidence:** T06 (F2.1 RLS suite), T06 (F2.2 projection worker suite)

---

### F2-I-7: No Independent Cash Creation (P0)

> F2 cannot create cash positions from outside F1. There is no F2 RPC that accepts arbitrary cash amounts without a valid F1 transaction reference.

**Enforcement:**
- `finance_internal_record_cash_movement` requires a valid `p_f1_transaction_id` with `status = 'POSTED'`
- No public-facing RPC exists for arbitrary cash injection

**Test Evidence:** All projection RPCs require F1 pre-flight (structural enforcement, not a single test)

---

### F2-I-8: Bank Account Lock Before Position Mutation (P1)

> Any operation that writes to `finance_cash_positions` must first acquire a lock on the corresponding `finance_bank_accounts` row.

**Enforcement:**
- Projection: `SELECT ... FROM finance_bank_accounts WHERE id = p_bank_account_id FOR SHARE`
- Reconstruction: `SELECT ... FROM finance_bank_accounts ... FOR UPDATE ORDER BY id ASC`
- This serializes concurrent projections and prevents lost updates on position balances.

**Invariant name:** `F2.5-I-1`

**Test Evidence:** T18 (concurrent projection), T26 (lock coverage validation), T23 (true multi-connection)

---

### F2-I-9: Deterministic Lock Ordering for Multi-Account Operations (P1)

> Any operation that locks multiple `finance_bank_accounts` rows simultaneously must do so in ascending `id` order.

**Enforcement:**
- `finance_reconstruct_cash_positions`: `FOR UPDATE ORDER BY id ASC`
- This is an architectural invariant — any future RPC that locks multiple accounts must implement the same ordering.

**Test Evidence:** T24 (multi-account deadlock prevention)

---

### F2-I-10: Reconstruction Privilege Isolation (P1)

> The `finance.allow_position_reconstruction` GUC flag is transaction-local and can only be set from within `finance_reconstruct_cash_positions`. Application code cannot enable it.

**Enforcement:**
- `SET LOCAL` (not `SET`) ensures the flag disappears on transaction commit or rollback
- `finance_cash_mutation_guard` checks `current_user IN ('service_role', 'postgres', 'supabase_admin')` before checking the GUC — so unauthorised roles cannot manipulate it even if they SET it

**Test Evidence:** T14-A, T14-B, T15, T16, T22

---

### F2-I-11: Quarantine for Terminal Failures (P1)

> Any event that cannot be projected due to a terminal error (security integrity violation, missing F1 transaction, inactive bank account) must be written to `finance_cash_quarantine`. It must not be silently discarded.

**Enforcement:**
- `CashProjectionWorker.handleEventSafe`: catches terminal errors and calls `quarantineEvent()`
- `isPgTerminalError()` classifies errcode prefixes `F2*`, `22*`, `23*` as terminal

**Test Evidence:** T03 (inactive account), T04 (missing F1), T06 (duplicate leg)

---

### F2-I-12: Multi-Leg Atomicity (P0)

> All legs of a single F1 transaction must be projected atomically. Either all succeed or all roll back. No partial projection is possible.

**Enforcement:**
- `finance_internal_project_cash_transaction` executes within a single PostgreSQL transaction. Any `RAISE EXCEPTION` from any leg rolls back all prior leg inserts automatically.
- No explicit `EXCEPTION` handler at the outer level — errors propagate to the caller.

**Test Evidence:** Structural (single transaction boundary, verified by F2.2.12 design invariant)

---

## Summary Table

| Invariant | Priority | Mechanism | Test Evidence |
|---|---|---|---|
| F2-I-1: F1-First | P0 | Pre-flight F1 existence check in RPCs | T01–T05 |
| F2-I-2: Movement Immutability | P0 | `finance_cash_mutation_guard` trigger | T12, T25 |
| F2-I-3: Position = Σ Movements | P0 | Upsert atomic accumulation + reconstruction | T27 |
| F2-I-4: Tenant Isolation | P0 | RLS + composite FKs + RPC validation | T07, T05, T13, T17 |
| F2-I-5: Idempotent Projection | P0 | `uq_finance_cash_movements_idem` + pre-check | T19 |
| F2-I-6: Unique Leg Reference | P0 | `uq_finance_cash_movements_leg` + F2030 raise | T06 (×2 suites) |
| F2-I-7: No Independent Cash | P0 | F1 pre-flight mandatory in all write RPCs | Structural |
| F2-I-8: Bank Account Lock | P1 | `FOR SHARE` / `FOR UPDATE` before position write | T18, T23, T26 |
| F2-I-9: Deterministic Lock Order | P1 | `ORDER BY id ASC` on multi-account operations | T24 |
| F2-I-10: Reconstruction Privilege | P1 | `SET LOCAL` + role check before GUC | T14-A, T14-B, T15, T16, T22 |
| F2-I-11: Quarantine Terminal | P1 | `handleEventSafe` + `quarantineEvent()` | T03, T04, T06 |
| F2-I-12: Multi-Leg Atomicity | P0 | Single PG transaction per F1 transaction | Structural / F2.2.12 |
