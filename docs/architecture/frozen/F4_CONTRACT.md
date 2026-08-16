# F4 ACCOUNTS PAYABLE ENGINE — PUBLIC CONTRACT

> **Freeze Status: 🔒 FROZEN**
> This contract defines the stable, versioned API surface of the F4 Accounts Payable (AP) Engine.
> Vertical OS layers (e.g. Healthcare/Education) consume F4 through this contract only.
> Internal RPCs, triggers, and table structures not exposed here are NOT part of this contract.

---

## Contract Version

| Field | Value |
|---|---|
| **Version** | `F4.1.0` |
| **Frozen At** | `2026-08-16T07:55:00+07:00` |
| **Commit** | `1a6b4b4ddab5c7cf97f2b8ec5893b73998016c1` |

---

## 1. Outbound Service RPC Contract

Vertical layers consume the AP engine exclusively through these PostgreSQL RPC contracts. Direct table INSERTs or UPDATEs on subledger tables are prohibited.

### 1.1 Bill Approval: `finance_approve_vendor_bill`
Transition a RECEIVED vendor bill to APPROVED status, posting accruals to the F1 General Ledger.

```sql
CREATE OR REPLACE FUNCTION public.finance_approve_vendor_bill(
    p_tenant_id         UUID,
    p_bill_id           UUID,
    p_approved_by       UUID,
    p_posting_attempt_id UUID
) RETURNS JSONB;
```
* **Returns:** `{"success": boolean, "transaction_id": UUID, "bill_id": UUID, "status": "APPROVED", "is_duplicate": boolean}`
* **Permissions:** Restricted to `service_role` and admin users.

### 1.2 Disbursement Allocation: `finance_disburse_payment`
Allocate an F2 Cash Outflow to an approved vendor bill, updating positions and posting to F1.

```sql
CREATE OR REPLACE FUNCTION public.finance_disburse_payment(
    p_tenant_id              UUID,
    p_bill_id                UUID,
    p_cash_outflow_id        UUID,
    p_allocated_amount_minor BIGINT,
    p_cash_amount_minor      BIGINT,
    p_exchange_rate          NUMERIC,
    p_rate_source            VARCHAR,  -- whitelisted values
    p_rate_timestamp         TIMESTAMPTZ,
    p_posting_attempt_id     UUID
) RETURNS JSONB;
```
* **Returns:** `{"success": boolean, "allocation_id": UUID, "transaction_id": UUID, "is_duplicate": boolean}`
* **Permissions:** Restricted to `service_role` and admin users.

### 1.3 Allocation Reversal: `finance_reverse_disbursement`
Atomically reverses a disbursement allocation using F1 reversal tools and restoring bill outstanding balance.

```sql
CREATE OR REPLACE FUNCTION public.finance_reverse_disbursement(
    p_tenant_id          UUID,
    p_allocation_id      UUID,
    p_posting_attempt_id UUID
) RETURNS JSONB;
```
* **Returns:** `{"success": boolean, "reversal_allocation_id": UUID, "transaction_id": UUID, "is_duplicate": boolean}`
* **Permissions:** Restricted to `service_role` and admin users.

### 1.4 Prepayment Record: `finance_record_prepayment`
Records an unapplied vendor prepayment, posting to F1 prepayment asset accounts.

```sql
CREATE OR REPLACE FUNCTION public.finance_record_prepayment(
    p_tenant_id              UUID,
    p_vendor_id              UUID,
    p_amount_minor           BIGINT,
    p_bank_finance_account_id UUID,
    p_posting_attempt_id     UUID,
    p_source_type            VARCHAR,
    p_source_id              VARCHAR
) RETURNS JSONB;
```
* **Returns:** `{"success": boolean, "prepayment_fact_id": UUID, "transaction_id": UUID, "is_duplicate": boolean}`
* **Permissions:** Restricted to `service_role` and admin users.

### 1.5 Prepayment Application: `finance_apply_prepayment`
Applies a recorded prepayment to a specific vendor bill under strict same-vendor validation rules.

```sql
CREATE OR REPLACE FUNCTION public.finance_apply_prepayment(
    p_tenant_id           UUID,
    p_bill_id             UUID,
    p_prepayment_fact_id  UUID,
    p_amount_minor        BIGINT,
    p_posting_attempt_id  UUID
) RETURNS JSONB;
```
* **Returns:** `{"success": boolean, "prepayment_fact_id": UUID, "transaction_id": UUID, "is_duplicate": boolean}`
* **Permissions:** Restricted to `service_role` and admin users.

### 1.6 Pure Mathematical Read: `finance_calculate_payable_position`
Calculates gross payable, unapplied prepayment, and net vendor exposure. This is a pure read and does not acquire database locks.

```sql
CREATE OR REPLACE FUNCTION public.finance_calculate_payable_position(
    p_tenant_id UUID,
    p_vendor_id UUID,
    p_bill_id   UUID DEFAULT NULL
) RETURNS JSONB;
```
* **Returns:** `{"gross_payable_minor": bigint, "unapplied_prepayment_minor": bigint, "net_vendor_exposure_minor": bigint}`
* **Permissions:** Executable by `authenticated` and `service_role`.

### 1.7 Positions Reconstruction: `finance_rebuild_payable_position`
Rebuilds a bill's positions projection cache from subledger facts.

```sql
CREATE OR REPLACE FUNCTION public.finance_rebuild_payable_position(
    p_tenant_id UUID,
    p_bill_id   UUID
) RETURNS JSONB;
```
* **Returns:** `{"success": boolean, "bill_id": UUID, "disbursed_amount_minor": bigint, "version": int}`
* **Permissions:** Restricted to `service_role` and admin users.

---

## 2. Dynamic View Contract

### View: `public.finance_vendor_bill_status`
Renders computed `effective_status` (including computed `PAID` state) and outstanding balance fields.

* **Security Model:** Enforces `security_invoker = true` to inherit RLS contexts from the calling session.
* **Fields:**
  * `id` (UUID): Bill ID
  * `tenant_id` (UUID): Tenant ID
  * `vendor_id` (UUID): Vendor ID
  * `bill_number` (VARCHAR): Vendor bill reference number
  * `bill_date` (TIMESTAMPTZ): Issue date
  * `due_date` (TIMESTAMPTZ): Due date
  * `currency` (VARCHAR): Currency code
  * `total_amount_minor` (BIGINT): Total original bill amount
  * `lifecycle_status` (VARCHAR): State machine lifecycle state (`DRAFT`, `RECEIVED`, `APPROVED`, `REVERSED`)
  * `disbursed_amount_minor` (BIGINT): Aggregate standard payments minus reversals
  * `outstanding_amount_minor` (BIGINT): Net unpaid bill balance
  * `effective_status` (VARCHAR): Computed status (`DRAFT`, `RECEIVED`, `APPROVED`, `PAID`, `REVERSED`)

---

## 3. Required Permissions & Grants

| Resource / Function | authenticated | service_role |
|---|---|---|
| `finance_approve_vendor_bill` | EXECUTE | EXECUTE |
| `finance_disburse_payment` | EXECUTE | EXECUTE |
| `finance_reverse_disbursement` | EXECUTE | EXECUTE |
| `finance_record_prepayment` | EXECUTE | EXECUTE |
| `finance_apply_prepayment` | EXECUTE | EXECUTE |
| `finance_calculate_payable_position` | EXECUTE | EXECUTE |
| `finance_rebuild_payable_position` | EXECUTE | EXECUTE |
| `finance_vendor_bill_status` view | SELECT | SELECT |
| `finance_vendor_bills` table | SELECT | SELECT, INSERT, UPDATE, DELETE |
| `finance_vendor_bill_lines` table | SELECT | SELECT, INSERT, UPDATE, DELETE |
| `finance_payable_ledger` table | SELECT | SELECT, INSERT |
| `finance_payable_allocations` table | SELECT | SELECT, INSERT |
| `finance_payable_positions` table | SELECT | SELECT, INSERT, UPDATE |
| `finance_vendor_prepayments` table | SELECT | SELECT, INSERT |
