# F5.6 Domain Boundary Verification — Vendor Prepayment vs Employee Advance

> **Date:** 2026-08-23  
> **Type:** Domain Semantic Verification  
> **Critical Finding:** F4 PREPAYMENT = Vendor prepayment (NOT employee advance)  
> **Impact:** Confirms TK 331 semantic (NOT TK 141)

---

## Verification Purpose

**Critical Question:**
> Does F4 `PREPAYMENT_RECORDED` / `PREPAYMENT_APPLIED` / `PREPAYMENT_REFUNDED`
> represent **vendor prepayment** or **employee advance**?

**Why This Matters:**
- Employee advance → TK 141 Tạm ứng (Asset account)
- Vendor prepayment → TK 331 Phải trả cho người bán (Liability account, Debit balance)
- **Cannot proceed with F5.6 without confirming domain boundary**

---

## F4 Contract Evidence

### 1. F4 Public Contract Analysis

**Source:** `docs/architecture/frozen/F4_CONTRACT.md` (F4.1.0, FROZEN)

**F4.1.4: Prepayment Record RPC**
```sql
CREATE OR REPLACE FUNCTION public.finance_record_prepayment(
    p_tenant_id              UUID,
    p_vendor_id              UUID,          -- ✅ VENDOR, not employee
    p_amount_minor           BIGINT,
    p_bank_finance_account_id UUID,
    p_posting_attempt_id     UUID,
    p_source_type            VARCHAR,
    p_source_id              VARCHAR
) RETURNS JSONB;
```

**Key Evidence:**
- Parameter name: **`p_vendor_id`** (explicitly vendor)
- Comment: "Records an unapplied **vendor prepayment**"
- NOT `p_employee_id` or `p_staff_id`

**F4.1.5: Prepayment Application RPC**
```sql
CREATE OR REPLACE FUNCTION public.finance_apply_prepayment(
    p_tenant_id           UUID,
    p_bill_id             UUID,             -- ✅ Vendor bill
    p_prepayment_fact_id  UUID,
    p_amount_minor        BIGINT,
    p_posting_attempt_id  UUID
) RETURNS JSONB;
```

**Key Evidence:**
- Parameter name: **`p_bill_id`** (applies to vendor bill)
- Comment: "Applies a recorded prepayment to a specific **vendor bill**"
- Validation rule: "strict same-vendor validation rules"

**F4.1.6: Position Calculation RPC**
```sql
CREATE OR REPLACE FUNCTION public.finance_calculate_payable_position(
    p_tenant_id UUID,
    p_vendor_id UUID,                      -- ✅ VENDOR scoped
    p_bill_id   UUID DEFAULT NULL
) RETURNS JSONB;
```

**Key Evidence:**
- Scope: **`p_vendor_id`** (vendor-scoped calculation)
- Returns: `{"gross_payable_minor", "unapplied_prepayment_minor", "net_vendor_exposure_minor"}`
- Semantic: "net **vendor exposure**" (vendor relationship)

---

### 2. F4 Schema Evidence

**Source:** `supabase/migrations/20260818000000_finance_ap_engine_v1.sql`

**Table: `finance_vendor_prepayments`**
```sql
CREATE TABLE public.finance_vendor_prepayments (
    id                    UUID        PRIMARY KEY,
    tenant_id             UUID        NOT NULL,
    vendor_id             UUID        NOT NULL,  -- ✅ VENDOR, not employee
    fact_type             VARCHAR(30) NOT NULL
                              CHECK (fact_type IN (
                                  'PREPAYMENT_RECORDED',
                                  'PREPAYMENT_APPLIED',
                                  'PREPAYMENT_REFUNDED'
                              )),
    amount_minor          BIGINT      NOT NULL,
    posting_attempt_id    UUID        NOT NULL,
    f1_transaction_id     UUID        NOT NULL,
    matched_vendor_bill_id UUID       NULL,     -- ✅ Links to vendor bill
    source_type           VARCHAR(100),
    source_id             VARCHAR(255),
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK to vendor bills
ALTER TABLE public.finance_vendor_prepayments
    ADD CONSTRAINT fk_vendor_prepayments_bill
        FOREIGN KEY (tenant_id, matched_vendor_bill_id)
        REFERENCES public.finance_vendor_bills(tenant_id, id)  -- ✅ Vendor bills
        ON DELETE RESTRICT;
```

**Key Evidence:**
1. Table name: **`finance_vendor_prepayments`** (explicitly vendor)
2. Column: **`vendor_id`** (NOT `employee_id`, NOT `staff_id`)
3. FK: **`matched_vendor_bill_id`** → `finance_vendor_bills` (vendor bills)
4. NOT linked to employee table
5. NOT linked to TK 141 domain

---

### 3. F5 Read Contract Evidence

**Source:** `supabase/migrations/20260819010000_f5_read_contracts.sql`

**Function: `finance_ap_facts_as_of`**
```sql
-- Prepayment facts from finance_vendor_prepayments
-- F4 Prepayment effective date basis: finance_vendor_prepayments.created_at
-- vendor_bill_id is NULL for prepayments not yet matched to a bill
SELECT
    ...
FROM public.finance_vendor_prepayments fvp  -- ✅ Vendor prepayments
WHERE fvp.tenant_id = p_tenant_id
  AND fvp.created_at <= p_as_of
```

**Comment:**
```sql
COMMENT ON FUNCTION ... IS
    'F5 Read Contract F4_PREPAYMENT:v1. Returns prepayment facts ...'
    'Effective-date basis: finance_vendor_prepayments.created_at'
```

**Key Evidence:**
- Contract explicitly references **`finance_vendor_prepayments`**
- NOT `finance_employee_advances` or similar
- Comment confirms "prepayment facts" from vendor prepayment table

---

## Domain Boundary Conclusion

### ✅ VERIFIED: F4 PREPAYMENT = Vendor Prepayment

**Evidence Summary:**
1. ✅ F4 RPC parameters use `p_vendor_id` (NOT `p_employee_id`)
2. ✅ F4 table named `finance_vendor_prepayments` (explicit vendor domain)
3. ✅ F4 table has FK to `finance_vendor_bills` (vendor relationships)
4. ✅ F4 position calculation returns "net_vendor_exposure" (vendor semantic)
5. ✅ F5 read contract reads from `finance_vendor_prepayments` table

**Conclusion:**
```
F4 PREPAYMENT domain models:
  ✅ Vendor prepayment (ứng trước cho nhà cung cấp)
  ❌ NOT employee advance (tạm ứng cho nhân viên)
```

---

## Vietnamese Accounting Semantic Alignment

### Domain → Accounting Relationship → GL Account

| Domain | Counterparty | Vietnamese Term | GL Account | Type |
|--------|--------------|-----------------|------------|------|
| **F4 Prepayment** | **Vendor** | **Ứng trước cho nhà cung cấp** | **331** | Liability (Debit balance) |
| (NOT in scope) | Employee | Tạm ứng cho nhân viên | 141 | Asset |

**F4 Vendor Prepayment Accounting Treatment:**

```
Enterprise pays advance to vendor:
Nợ  331 Phải trả cho người bán    100,000,000
    Có  112 Tiền gửi ngân hàng                100,000,000

Result: TK 331 shows Debit balance 100M (vendor advance)

Vendor delivers, invoice received:
Nợ  631 Giá vốn hàng bán          100,000,000
    Có  331 Phải trả cho người bán            100,000,000

Result: TK 331 Debit balance cleared (advance applied)
```

**F5.6 Reconciliation Semantic:**
- GL Account: **331 Phải trả cho người bán**
- Semantic: Reconstructs **Debit balance** (vendor advance) on TK 331
- **NOT** TK 141 (employee advance domain)

---

## Rejected Alternative: TK 141 Employee Advance

**Why TK 141 is NOT applicable to F4 Prepayment:**

**TK 141 Semantic (Employee Advance):**
```
Enterprise gives cash advance to employee for business travel:
Nợ  141 Tạm ứng                   10,000,000
    Có  111 Tiền mặt                          10,000,000

Result: TK 141 shows Debit balance 10M (employee has advance)

Employee returns with receipts, settlement:
Nợ  152 Nguyên liệu, vật liệu     10,000,000
    Có  141 Tạm ứng                           10,000,000

Result: TK 141 cleared (advance settled)
```

**Key Differences:**

| Aspect | TK 141 (Employee Advance) | TK 331 (Vendor Prepayment) |
|--------|---------------------------|---------------------------|
| Counterparty | **Internal employee** | **External vendor** |
| Relationship | Employment | Commercial/supplier |
| Settlement | Employee returns receipts | Vendor delivers goods/invoice |
| F4 Domain | ❌ NOT in F4 | ✅ F4 Prepayment |
| Table | (not in Bella yet) | `finance_vendor_prepayments` |
| Accounting | Asset (Debit-normal) | Liability (Debit balance) |

**F4 Does NOT Model Employee Advances:**
- No `finance_employee_advances` table
- No RPC with `p_employee_id` parameter
- No link to HR/employee domain
- **F4 is Accounts Payable engine** (vendor relationships only)

---

## Impact on F5.6 Research

### Research Document Corrections Required

**BEFORE (Incorrect Framing):**
```
❌ "Prepayment → Choose 141 (employee advance) or 331 (vendor prepayment)"
```

**AFTER (Correct Framing):**
```
✅ "F4 Vendor Prepayment → TK 331 (Phải trả cho người bán)"
✅ "Debit balance on TK 331 represents vendor advance"
✅ "TK 141 is different domain (employee advance, NOT in F5.6 scope)"
```

### F5.6 Semantic Specification Updates

**GL Account Mapping:**
- ✅ Confirmed: **331 Phải trả cho người bán**
- ✅ Semantic: Vendor advance = Debit balance on TK 331
- ❌ NOT 141 (wrong domain)

**Reconstruction Formula:**
```sql
-- Reconstructs Debit balance (vendor advance) on TK 331
unapplied_vendor_advance_per_vendor = SUM(
  CASE fact_type
    WHEN 'PREPAYMENT_RECORDED' THEN amount_minor   -- Debit 331
    WHEN 'PREPAYMENT_APPLIED'  THEN -amount_minor  -- Credit 331
    WHEN 'PREPAYMENT_REFUNDED' THEN -amount_minor  -- Credit 331
  END
)
```

**Temporal Boundary:**
- Source: `finance_vendor_prepayments.created_at`
- F5 contract: `finance_ap_facts_as_of` filters by `created_at <= p_as_of`

---

## Verification Checklist

**Domain Boundary Verification:**
- [x] ✅ F4 prepayment is vendor-scoped (NOT employee-scoped)
- [x] ✅ F4 table is `finance_vendor_prepayments` (NOT `finance_employee_advances`)
- [x] ✅ F4 RPC parameters use `p_vendor_id` (NOT `p_employee_id`)
- [x] ✅ F4 FK links to `finance_vendor_bills` (vendor domain)
- [x] ✅ F5 reads from `finance_vendor_prepayments` (vendor semantic confirmed)

**Accounting Semantic Alignment:**
- [x] ✅ Vendor prepayment belongs to TK 331 (liability account)
- [x] ✅ Vendor advance creates Debit balance on TK 331
- [x] ✅ TK 141 is for employee advances (different domain, NOT applicable)
- [x] ✅ F5.6 reconciles Debit balance on TK 331 (NOT asset on TK 141)

**Still Requires TT99/2025 Verification:**
- [ ] ⚠️ TT99/2025 Phần B confirms "Nợ 331" for vendor advance
- [ ] ⚠️ VAS guidance on vendor prepayment treatment
- [ ] ⚠️ Bella F1 COA uses TK 331 for vendor prepayments

---

## Conclusion

**F5.6 Prepayment Domain is CLEARLY DEFINED:**

```
F4 Vendor Prepayment
        │
        ▼
    Vendor Relationship
        │
        ▼
   TK 331 (Phải trả cho người bán)
        │
        ├── Credit side: Vendor invoices (payable)
        └── Debit side:  Vendor advances (prepayment)
                │
                ▼
        F5.6 PREPAYMENT_GL_BALANCE
        (Reconciles Debit balance on TK 331)
```

**NOT:**
```
❌ Employee advance
❌ TK 141 (Tạm ứng)
❌ Separate prepayment asset account
```

**This verification eliminates the false "141 vs 331 choice" and confirms:**
- ✅ F5.6 reconciles vendor prepayment (F4 domain)
- ✅ GL Account is 331 (vendor relationship)
- ✅ Semantic is Debit balance on liability account (NOT asset)
- ✅ TK 141 is irrelevant to F5.6 (different domain)

**Next Step:** Verify TT99/2025 Phần B confirms "Nợ 331" accounting treatment for vendor advances.

---

**Verification Completed By:** AI (F4 contract + schema analysis)  
**Approval Required:** Human Architect (TT99/2025 Phần B verification)

