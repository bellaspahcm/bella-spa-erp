# FINANCE OS — F3 ACCOUNTS RECEIVABLE & INVOICING CONSTITUTION

**Document ID:** FINANCE-CONSTITUTION-003  
**Status:** 🔒 LOCKED — CONSTITUTION FREEZE  
**Scope:** Accounts Receivable, Invoicing, Billing, and Payment Allocation  
**Authority:** This constitution defines the invariant limits for all F3 components.

---

## ARCHITECTURE STATUS

```
F3.0 ACCOUNTS RECEIVABLE & INVOICING
────────────────────────────────────
17/17 Core Invariants Defined
17/17 Architecturally Accepted

Domain Boundary       PASS
F1 Boundary           PASS
F2 Boundary           PASS
Tenant Isolation      PASS
Immutable Fact Model  PASS
Derived Position      PASS
Allocation Model      PASS
Reconstruction        PASS
Reconciliation        PASS
Concurrency Model     PASS*
Atomicity             PASS*
Idempotency           PASS*

* implementation contract verification required in F3.1 gate
```

---

## PREAMBLE

Phase F3 (Accounts Receivable & Invoicing) is a downstream business layer. It operates on top of the frozen foundation layers:
- **F1 (Accrual Truth):** Authority for double-entry bookkeeping.
- **F2 (Cash & Treasury Truth):** Authority for bank accounts and cash movements.

F3 does not own or modify the core financial truths of F1 or F2. Instead, F3 coordinates invoicing workflows, tracks subledger balances, allocates cash receipt records, and reconciles balances against F1 control accounts.

---

## 1. THE 17 CORE F3 INVARIANTS

| Invariant | Title | Specification |
|---|---|---|
| **F3-I-1** | Finalized Invoice Immutability | Sau khi hóa đơn hoàn tất và đã ghi nhận vào F1, dữ liệu gốc của hóa đơn không được sửa hoặc xóa. Mọi thay đổi về giá trị phải được thực hiện thông qua chứng từ điều chỉnh (Debit/Credit Memos) có liên kết truy nguyên với hóa đơn gốc. Chỉ các metadata vận hành (updated_at, system metadata, reconciliation/audit metadata, system trace metadata) là có thể thay đổi. Các thông số tài chính cốt lõi (khách hàng, dòng mặt hàng, số lượng, đơn giá, thuế, loại tiền, tổng số tiền, ngày ghi nhận, F1 transaction reference) là bất biến tuyệt đối. Trạng thái hóa đơn mang tính ngữ nghĩa tài chính và chỉ được thay đổi thông qua các transaction boundary được kiểm soát. |
| **F3-I-2** | F1 Double-Entry Parity | Tổng công nợ phải thu còn lại được xác định từ sổ công nợ F3 phải đối chiếu bằng với số dư tài khoản phải thu kiểm soát trên F1 tại cùng thời điểm và cùng phạm vi dữ liệu (cùng tenant, currency, accounting scope, posted-state, cutoff timestamp, và control account). Mọi chênh lệch phải được phát hiện, ghi nhận và đưa vào quy trình đối soát; F3 không được tự động điều chỉnh để làm cho hai số bằng nhau. Số dư kiểm soát Accounts Receivable của F3 được tính bằng tổng phát sinh debits ghi nhận công nợ trừ tổng phát sinh credits phân bổ thanh toán và điều chỉnh memos, cùng phạm vi tiền tệ và kỳ hạch toán với F1. |
| **F3-I-3** | Adjustment-Only Correction | Mismatches or mistakes in finalized invoices must be corrected strictly by issuing Debit or Credit Memos. Direct updates to invoice records are prohibited. Adjustments must generate matching adjusting entries in F1. |
| **F3-I-4** | F1 Posting Boundary | F3 has zero write permissions on F1 tables. All accounting entries (accruals, tax recognition, reversals) must go through the public F1 ledger posting contract. |
| **F3-I-5** | F2 Cash Boundary | F3 has zero write permissions on F2 tables. F3 cannot record cash movements, link accounts, or change bank balances. F3 only allocates matches downstream of cash receipt. |
| **F3-I-6** | Payment Allocation Integrity | Chỉ cash movement hợp lệ cho thu tiền (incoming cash receipt) mới được sử dụng làm nguồn phân bổ công nợ. Tổng phân bổ không được vượt quá giá trị tiền vào có thể phân bổ (allocatable_cash_amount) của movement đó. Phân loại cash movement được kế thừa trực tiếp từ F2 Cash Reporting API. Các loại `COLLECTION` là eligible, trong khi `TRANSFER`, `FEE`, `WITHDRAWAL`, và các loại khác là not eligible. |
| **F3-I-7** | Tenant & Customer Isolation | All F3 tables must enforce Row Level Security (RLS) using `get_auth_tenant_id()`. Customer accounts and references must belong to the active tenant. |
| **F3-I-8** | No Self-Balancing | Automated journal adjustments or subledger balance rewrites to force balance matching between F1 and F3 are strictly prohibited. Deltas must raise audit and reconciliation warnings. |
| **F3-I-9** | Timing of Recognition | Invoices only create receivables when specific recognition conditions (status transition to finalized) are met. Draft invoices have zero subledger or F1 ledger impact. |
| **F3-I-10** | Immutability of Allocation | Một phân bổ đã xác nhận không được sửa hoặc xóa trực tiếp. Việc thay đổi phải tạo bản đảo phân bổ (reversal allocation) và bản phân bổ mới nếu cần, đồng thời giữ nguyên toàn bộ lịch sử liên kết (số tiền luôn dương, xác định bằng loại phân bổ `REVERSAL`). Một bản phân bổ chỉ được phép đảo tối đa một lần trong cùng lineage state (ngăn chặn trùng lặp đảo phân bổ). |
| **F3-I-11** | Allocations $\le$ Cash Received | Tổng các phân bổ của hóa đơn ánh xạ tới một dòng tiền F2 không được vượt quá số tiền có thể phân bổ của dòng tiền đó: `effective_allocation = Σ(positive ALLOCATION) - Σ(positive REVERSAL) <= allocatable_cash_amount` (trong đó `allocatable_cash_amount` được xác nhận bởi thẩm quyền F2). |
| **F3-I-12** | Bidirectional Traceability | Systems must enable querying allocated payments from an invoice, and allocated invoices (plus unallocated remaining balance) from a cash movement. |
| **F3-I-13** | Khả năng tái dựng công nợ | Số dư công nợ phái sinh phải có khả năng được tái dựng từ lịch sử hóa đơn, điều chỉnh và phân bổ thanh toán hợp lệ. Cơ chế tái dựng chỉ được phục hồi dữ liệu phái sinh (`finance_receivable_positions`) và tuyệt đối không sửa hóa đơn đã hoàn tất, giao dịch F1 hoặc lịch sử tiền F2. |
| **F3-I-14** | Accrual Atomicity | F3 phải sử dụng cơ chế posting chính thức của F1 có khả năng đảm bảo atomicity giữa F1 posting và F3 receivable accrual. F3 không được tự tạo transaction boundary giả bằng application-level sequencing hoặc try/catch. Nếu public F1 contract không hỗ trợ atomic cross-domain transaction, F3 phải sử dụng một integration protocol được F1 authority phê duyệt để đảm bảo không tồn tại trạng thái commit một phía. |
| **F3-I-15** | Allocation Concurrency Safety | Mọi allocation phải được kiểm tra và ghi nhận atomically tại database boundary (sử dụng row-level lock `SELECT FOR UPDATE` trên cả cash movement nguồn và target invoice/position); concurrent allocations không được phép làm tổng active allocation vượt quá allocatable cash. F3 không tự ý tạo số dư tiền mặt ảo (shadow balance) mà phải tham chiếu trực tiếp F2. |
| **F3-I-16** | Posting Boundary Atomicity | Invoice finalization, F1 accrual posting và F3 receivable accrual phải được thực hiện thông qua một transactional posting boundary có khả năng rollback toàn bộ. F3 không được tự đánh dấu FINALIZED trước khi transaction boundary xác nhận thành công. |
| **F3-I-17** | Accrual Idempotency | Một invoice chỉ được tạo duy nhất một accrual posting canonical trong F1 và một receivable accrual tương ứng trong F3. Retry cùng operation identity phải trả về kết quả canonical thay vì tạo thêm financial facts. Token idempotency phải được lưu trữ và kiểm soát tại authoritative financial boundary (persistent storage), không lưu tạm trên application memory. |

---

## 2. CANONICAL ARCHITECTURE FLOW

```
                    F3 — CÔNG NỢ & HÓA ĐƠN
                              │
             ┌────────────────┼────────────────┐
             ↓                ↓                ↓
        Hóa đơn          Sổ công nợ         Phân bổ tiền
             │                │                │
             │                │                ↓
             │                │            F2 Cash
             │                │
             ↓                ↓
               ───────→ F1 Ledger
                         │
                         ↓
                      Đối soát
```

---

## 3. PROPOSED DATA MODEL SCAFFOLDING

F3 organizes data across 6 distinct schema tables:

### 3.1 Invoice Header (`finance_invoices`)
Represents the business invoice document.
- `id` (UUID, PK)
- `tenant_id` (UUID, FK to tenant)
- `customer_id` (UUID, customer reference)
- `invoice_number` (VARCHAR, unique per tenant)
- `status` (`DRAFT`, `FINALIZED`, `VOIDED`, `ADJUSTED`) - Note: operational lifecycle states only. Payment states (`PARTIALLY_PAID`, `PAID`) are dynamically derived.
- `issue_date` (DATE)
- `due_date` (DATE)
- `currency` (VARCHAR)
- `total_pretax_amount_minor` (BIGINT) - Sum of lines before tax
- `tax_amount_minor` (BIGINT) - Calculated tax amount
- `total_invoice_amount_minor` (BIGINT) - Total amount including tax (`total_pretax_amount_minor` + `tax_amount_minor`)
- `f1_transaction_id` (UUID, FK to F1 transaction - nullable, set on finalization, UNIQUE)
- `posting_status` (`PENDING`, `SUCCESS`, `FAILED`)
- `posting_attempt_id` (UUID, idempotency token, UNIQUE)
- `metadata` (JSONB)
- `created_at` / `updated_at`

### 3.2 Invoice Lines (`finance_invoice_lines`)
Represents individual items billed.
- `id` (UUID, PK)
- `tenant_id` (UUID)
- `invoice_id` (UUID, FK to `finance_invoices`)
- `service_id` (UUID, service reference)
- `description` (TEXT)
- `quantity` (NUMERIC)
- `unit_price_minor` (BIGINT)
- `tax_rate` (NUMERIC) - E.g. 0.10 for 10%
- `amount_minor` (BIGINT) - `quantity` * `unit_price_minor`
- `revenue_account_code` (VARCHAR, revenue account mapped in F1)

### 3.3 Receivable Adjustments (`finance_receivable_adjustments`)
Formally records credit/debit adjustments memos.
- `id` (UUID, PK)
- `tenant_id` (UUID)
- `invoice_id` (UUID, FK to `finance_invoices`)
- `adjustment_type` (`CREDIT_MEMO`, `DEBIT_MEMO`)
- `amount_minor` (BIGINT) - Positive adjustment value
- `reason` (TEXT)
- `f1_transaction_id` (UUID, FK to F1 transaction)
- `status` (`DRAFT`, `FINALIZED`, `CANCELLED`)
- `created_by` / `created_at`
- `metadata` (JSONB)

### 3.4 Receivable Subledger Log (`finance_receivable_ledger`)
The immutable historical fact log of all AR movements. UPDATE and DELETE operations are strictly blocked by database triggers.
- `id` (UUID, PK)
- `tenant_id` (UUID)
- `invoice_id` (UUID, FK to `finance_invoices`)
- `entry_type` (`DEBIT_ACCRUAL`, `CREDIT_ALLOCATION`, `DEBIT_ADJUSTMENT`, `CREDIT_ADJUSTMENT`)
- `amount_minor` (BIGINT) - Positive value
- `source_type` (`INVOICE`, `ALLOCATION`, `RECEIVABLE_ADJUSTMENT`)
- `source_id` (UUID, reference to the originating record)
- `created_at` (TIMESTAMP)

### 3.5 Receivable Derived Positions (`finance_receivable_positions`)
The derived cache storing outstanding balances. Fully reconstructible from facts.
- `id` (UUID, PK)
- `tenant_id` (UUID)
- `invoice_id` (UUID, FK to `finance_invoices`, UNIQUE)
- `customer_id` (UUID)
- `currency` (VARCHAR)
- `original_amount_minor` (BIGINT) - Original total invoice amount
- `allocated_amount_minor` (BIGINT) - Total cash allocated
- `adjusted_amount_minor` (BIGINT) - Total adjustments applied
- `outstanding_amount_minor` (BIGINT) - `original_amount_minor - allocated_amount_minor - adjusted_amount_minor`
- `last_reconstructed_at` (TIMESTAMP)
- `version` (INT)
- `metadata` (JSONB)

### 3.6 Allocation Ledger (`finance_receivable_allocations`)
Tracks allocations between F2 cash movements and F3 invoices.
- `id` (UUID, PK)
- `tenant_id` (UUID)
- `invoice_id` (UUID, FK to `finance_invoices`)
- `cash_movement_id` (UUID, FK to F2 `finance_cash_movements`)
- `allocated_amount_minor` (BIGINT) - Positive value representing allocated amount
- `allocation_type` (`STANDARD`, `REVERSAL`)
- `reversal_ref_id` (UUID, FK to `finance_receivable_allocations` - link to reversed standard allocation)
- `invoice_currency` (VARCHAR)
- `cash_currency` (VARCHAR)
- `allocation_currency` (VARCHAR)
- `invoice_amount` (BIGINT)
- `cash_amount` (BIGINT)
- `functional_amount` (BIGINT)
- `valuation_rate` (NUMERIC) - Conversion rate applied
- `rate_source` (VARCHAR) - Source of exchange rate
- `rate_timestamp` (TIMESTAMP)
- `allocation_date` (TIMESTAMP)
- `created_by` / `created_at`

---

## 4. INTEGRATION BOUNDARY WORKFLOWS

### 4.1 Invoice Accrual (F3 $\rightarrow$ F1 Transactional Posting Contract)
Invoice accrual must be performed through an official transactional posting boundary contract:
- **Inputs:** `operation_id` (Idempotency token), `tenant_id`, `invoice_id`, `posting_payload` (matching the tax formula), `ar_control_account_code`, `revenue_accounts`, `subledger_intent`.
- **Outputs:** `canonical_transaction_id`, `posting_status`, `operation_id`.

The accrual steps executed inside the authoritative boundary are:
1. Transition invoice status from `DRAFT` to `FINALIZED`. F3 cannot write this finalized status to disk before the transaction boundary confirms success.
2. Assemble the double-entry journal payload using the tax formula:
   - **Debit:** Accounts Receivable (Control Account code e.g. `'1311'`) $\rightarrow$ `total_invoice_amount_minor`
   - **Credit:** Revenue Account (code from lines e.g. `'5111'`) $\rightarrow$ `total_pretax_amount_minor`
   - **Credit:** Tax Payable Account (code e.g. `'3331'`) $\rightarrow$ `tax_amount_minor`
3. Call the **F1 Ledger Posting Contract** (`ICoreLedgerEngine.postTransaction`).
4. Record the debit entry in `finance_receivable_ledger` (`entry_type = 'DEBIT_ACCRUAL'`).
5. If F1 posting fails or subledger insert fails, the entire transaction rolls back (F3-I-14). F3 does not create fake transactional boundaries.

### 4.2 Cash Matching & Payment Allocation (F3 $\rightarrow$ F2 Query)
Only cash movements classified as **incoming cash receipt** (inflows) by F2 are eligible for allocation.
To prevent concurrency conflicts (F3-I-15):
1. Lock both the candidate F2 cash movement row and target invoice position row using database-level locks (`SELECT FOR UPDATE` on both) inside the allocation transaction block. To prevent deadlocks, locks must follow a strict, deterministic ordering (lock cash movement first, then lock invoice position).
2. Calculate available cash: `allocatable_cash_amount` (retrieved from F2) minus sum of active standard allocations (excluding reversals).
3. Validate allocation: ensure `allocated_amount_minor` $\le$ available cash, and `allocated_amount_minor` $\le$ invoice's remaining outstanding amount.
4. Insert allocation row into `finance_receivable_allocations` (`allocation_type = 'STANDARD'`).
5. Record credit entry in `finance_receivable_ledger` (`entry_type = 'CREDIT_ALLOCATION'`).
6. Update derived position in `finance_receivable_positions`. If outstanding amount is 0, the invoice's derived status becomes `PAID`.
7. Commit transaction, releasing row locks.

#### Allocation Reversal Workflow (F3-I-10)
To change a confirmed allocation:
1. Lock the F2 cash movement row and the target invoice position row.
2. Insert a reversing allocation record with type `REVERSAL`, carrying a positive `allocated_amount_minor` and pointing its `reversal_ref_id` to the original allocation. The original allocation must not already be reversed (enforced via database uniqueness or transaction constraints). Total reversals for an allocation must be $\le$ original allocation value.
3. Insert a debit entry in `finance_receivable_ledger` with `entry_type = 'DEBIT_ADJUSTMENT'` pointing to this reversal allocation.
4. Insert the new standard allocation record and record the corresponding subledger log entry.
5. Update `finance_receivable_positions` for all involved accounts.

### 4.3 Adjustment Memo & Void Workflow
To correct a finalized invoice:
1. Create a `Credit Memo` in `finance_receivable_adjustments` and transition it to `FINALIZED`.
2. Post adjusting journal lines to F1 via `ICoreLedgerEngine.postTransaction`.
3. Record the adjustment entry in `finance_receivable_ledger` (`entry_type = 'CREDIT_ADJUSTMENT'`).
4. Update `finance_receivable_positions`. Transition invoice status to `ADJUSTED` or `VOIDED` based on final remaining balance. Any transition to `VOIDED` requires corresponding F1 reversing transaction.

---

## 5. STATE MACHINE TRANSITIONS

```
   From            To              Allowed?        F1 Impact       F3 Impact
   DRAFT           FINALIZED       ✅              Post Accrual    Create AR Fact
   DRAFT           VOIDED          ✅              None            None
   FINALIZED       ADJUSTED        ⚠️ credit memo  Post Adjust     Adjust Fact
   FINALIZED       VOIDED          ⚠️ policy       Post Reversal   Reversal Fact
   FINALIZED       DRAFT           ❌              —               —
   VOIDED          FINALIZED       ❌              —               —
   ADJUSTED        DRAFT           ❌              —               —
```

### Derived Financial States (Determined Dynamically from Positions):
- **OPEN:** `outstanding_amount_minor = original_amount_minor`
- **PARTIALLY_PAID:** `0 < outstanding_amount_minor < original_amount_minor`
- **PAID:** `outstanding_amount_minor = 0`

---

## 6. RECONCILIATION & RECONSTRUCTION ENGINE DESIGN

### 6.1 Reconciliation Delta Calculation (F3-I-8)
A background reconciliation service will execute a comparison check per tenant at defined cutoff intervals:

$$\text{Delta} = \sum (\text{finance\_receivable\_positions.outstanding\_amount\_minor}) - \text{Balance}(\text{F1 Accounts Receivable Control Account})$$

- Checks are restricted to the same **Reconciliation Scope**:
  - `tenant_id`
  - `currency`
  - `accounting_scope`
  - `control_account_id`
  - `posted_state`
  - `cutoff_at`
- Deltas raise `AR_RECONCILIATION_MISMATCH_ALERT` containing the delta details. Programmatic auto-balancing is strictly prohibited.

### 6.2 Receivables Reconstruction (F3-I-13)
The subledger derived position cache (`finance_receivable_positions`) can be fully reconstructed by replaying the history of the immutable facts.
The reconstruction RPC:
1. Checks for application-tier permissions and requires execution strictly via `service_role`.
2. Sets a transient transaction-scoped privilege switch: `SET LOCAL finance.allow_receivable_position_reconstruction = 'true'`.
3. Deletes `finance_receivable_positions` rows for the scope and rebuilds them by aggregating `finance_receivable_ledger` and `finance_receivable_allocations` history.
4. Mutation of finalized invoices, F1 general ledger tables, or F2 cash logs remains strictly blocked.
5. Privilege disappears immediately upon transaction commit or rollback.

#### Reconstruction Verification Targets
Verification tests must cover:
- **R01:** single customer recovery
- **R02:** multiple customers recovery
- **R03:** multiple invoices recovery
- **R04:** partial payments recovery
- **R05:** multi-payment recovery
- **R06:** multi-invoice allocation recovery
- **R07:** reversal allocation recovery
- **R08:** corrupted position recovery
- **R09:** deterministic rebuild checks
- **R10:** idempotency checks
- **R11:** tenant isolation checks
- **R12:** F1 immutability checks
- **R13:** F2 immutability checks
- **R14:** privilege scope checks
- **R15:** failure rollback checks

---

## 7. PHASE F3.1 PRE-CODING GATES

Before database schema and RLS coding begins in Phase F3.1, the technical implementation must explicitly pass the following 5 pre-coding gates:

### G1 — Atomic Posting Protocol
The implementation must verify and resolve the F1 transactional posting API or coordinate via an approved integration protocol. F3 cannot assume try/catch blocks provide atomicity. The accrual workflow must guarantee that the invoice status transition, F1 ledger entry, and F3 subledger entry are atomic.

### G2 — Dual-Side Allocation Lock
Concurrency safety must be enforced at the database transaction boundary. Allocation requests must lock both the F2 source cash movement and the F3 target invoice position (`finance_receivable_positions`) using `SELECT FOR UPDATE` in a deterministic lock order (always locking source cash first, target position second) to prevent deadlocks.

### G3 — Reversal Constraint
All allocation reversals must carry positive amounts with the type marker `REVERSAL`. The implementation must enforce that the total reversed value for a specific allocation is $\le$ the original standard allocation value. Reversal allocation records must reference their original allocation ID.

### G4 — Currency/FX Contract
All payment allocations must support multi-currency fields (`invoice_currency`, `cash_currency`, `functional_currency`, `fx_rate`, `valuation_amount`). Any realized exchange gains/losses during settlement must be recorded by posting journal lines to F1 via the F1 ledger posting contract.

### G5 — Derived State & Void Semantics
The application is prohibited from writing `PAID` or `PARTIALLY_PAID` directly to the invoice status column. These states must be computed dynamically based on position caches. Voiding a finalized invoice must be implemented as a reversing operation that posts reversing journal lines to F1 and reversing subledger entries to F3, preserving the original invoice records intact.
