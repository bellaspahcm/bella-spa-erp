# F2 CASH & TREASURY ENGINE — PUBLIC CONTRACT

> **Freeze Status: 🔒 FROZEN**
> This contract defines the stable, versioned API surface of the F2 Cash & Treasury Engine.
> F3+ phases consume F2 through this contract only.
> Internal RPCs and triggers are NOT part of this contract.

---

## Contract Version

| Field | Value |
|---|---|
| **Version** | `F2.5.0` |
| **Frozen At** | `2026-08-15T22:24:46+07:00` |
| **Commit** | `7d0b2b3aab3a9c7cf97f2b8ec5893b73998015b2` |

---

## 1. Event Contract (Inbound — F2 consumes from F1)

F2 subscribes to the following versioned F1 domain events. These events are the **only authorised input** for cash projection.

### `finance.transaction.posted.v2`

```typescript
interface FinanceTransactionPostedV2Payload {
  event_id: string;           // UUID — unique per emission
  event_type: 'finance.transaction.posted.v2';
  event_version: '2.0';
  tenant_id: string;          // UUID
  transaction_id: string;     // UUID — F1 finance_transactions.id
  transaction_type: string;
  posted_at: string;          // ISO 8601
  source_type: string;
  source_id: string;
  candidate_cash_legs: CandidateCashLeg[];
}

interface CandidateCashLeg {
  cash_leg_id: string;        // UUID — immutable stable leg identity
  account_id: string;         // UUID — finance_accounts.id
  account_code: string;       // e.g. '1111'
  direction: 'INFLOW' | 'OUTFLOW';
  amount_minor: number;
  currency: string;           // ISO 4217
  functional_amount_minor: number;
  functional_currency: string;
  exchange_rate: number;
}
```

### `finance.transaction.reversed.v2`

```typescript
interface FinanceTransactionReversedV2Payload {
  event_id: string;
  event_type: 'finance.transaction.reversed.v2';
  event_version: '2.0';
  tenant_id: string;
  transaction_id: string;           // UUID — reversal F1 transaction id
  reversal_of_transaction_id: string; // UUID — original F1 transaction id
  reversed_at: string;
  source_type: string;
  source_id: string;
  candidate_cash_legs: CandidateCashLeg[];
}
```

> [!IMPORTANT]
> `cash_leg_id` in `CandidateCashLeg` is the **stable leg identity**. It is generated at F1 posting time and is immutable. F2 uses it as `cash_leg_reference` to enforce the unique constraint `uq_finance_cash_movements_leg`. This prevents the same F1 leg from being projected twice regardless of event replay.

---

## 2. Read API Contract (Outbound — F3+ reads from F2)

F2 exposes its state exclusively through `CashEngineService`. F3+ must depend on this TypeScript interface, not on direct SQL queries.

### Service Interface

```typescript
interface ICashReportingEngine {
  getBankAccount(tenantId: string, bankAccountId: string): Promise<FinanceEngineResponse<BankAccount>>;
  listBankAccounts(tenantId: string): Promise<FinanceEngineResponse<BankAccount[]>>;
  getCashPosition(tenantId: string, bankAccountId: string): Promise<FinanceEngineResponse<CashPosition>>;
  listCashPositions(tenantId: string): Promise<FinanceEngineResponse<CashPosition[]>>;
  getCashMovements(req: QueryMovementsRequest): Promise<FinanceEngineResponse<CashMovement[]>>;
  getConsolidatedRunway(tenantId: string): Promise<FinanceEngineResponse<CashRunway>>;
  getQuarantineEvents(tenantId: string, status?: 'PENDING' | 'RESOLVED'): Promise<FinanceEngineResponse<CashQuarantineEvent[]>>;
}

interface ICashReconstructionEngine {
  reconstructCashPositions(
    tenantId: string,
    bankAccountId?: string
  ): Promise<FinanceEngineResponse<{ reconstructed_accounts_count: number }>>;
}
```

### Key Types

```typescript
interface BankAccount {
  id: string;
  tenant_id: string;
  name: string;
  currency: string;
  is_active: boolean;
  linked_finance_account_id: string | null;
}

interface CashPosition {
  id: string;
  tenant_id: string;
  bank_account_id: string;
  balance_minor: string;          // Stored as string — BigInt safe
  currency: string;
  functional_balance_minor: string;
  functional_currency: string;
  valuation_rate: string;
  valuation_as_of: Date;
  version: number;
}

interface CashMovement {
  id: string;
  tenant_id: string;
  bank_account_id: string;
  idempotency_key: string;
  direction: 'INFLOW' | 'OUTFLOW';
  amount_minor: string;
  currency: string;
  functional_amount_minor: string;
  functional_currency: string;
  valuation_rate: string;
  f1_transaction_id: string;
  cash_leg_reference: string;
  source_type: 'F1_POSTING' | 'REVERSAL';
  source_id: string;
  description?: string;
  recorded_at: Date;
}

interface CashRunway {
  runway_days: number | null;
  consolidated_cash: Money;
  status: 'CALCULATED' | 'NO_BURN_RATE' | 'ZERO_BURN' | 'UNAVAILABLE';
}
```

---

## 3. Required Permissions

| Operation | Required Permission |
|---|---|
| Read bank accounts, positions, movements | `finance.cash.read` |
| Trigger reconstruction | `finance.cash.reconstruct` |
| Any write to F2 tables | **NOT AVAILABLE** — internal only |

---

## 4. What Is NOT Part of This Contract

The following are **internal F2 implementation details** and must not be called from F3+ code:

| Internal Item | Reason |
|---|---|
| `finance_internal_record_cash_movement` RPC | Single-leg internal recorder. Called only by `finance_internal_project_cash_transaction`. |
| `finance_internal_project_cash_transaction` RPC | Called only by `CashProjectionWorker`. |
| `finance_internal_quarantine_cash_event` RPC | Called only by `CashProjectionWorker` on terminal failure. |
| `finance_reconstruct_cash_positions` RPC | Called only by `CashEngineService.reconstructCashPositions` with `finance.cash.reconstruct` permission. |
| `finance_cash_mutation_guard` trigger | Internal DB guard. Not callable. |

---

## 5. SLO Commitments (Informational)

| Metric | Target |
|---|---|
| Projection latency (p95) | < 500ms per event |
| Position read latency (p95) | < 100ms |
| Reconstruction time (single account) | < 5s |
| Quarantine resolution SLA | Manual — within 1 business day |
