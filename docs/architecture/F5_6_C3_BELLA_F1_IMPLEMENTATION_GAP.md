# F5.6-C.3 Bella F1 Implementation Gap — Vendor Prepayment Account Mapping

**Status:** 🟡 GAP DETECTED — Awaiting Human Architect Decision  
**Date:** 2026-08-16  
**Research Phase:** C.3 Bella F1 Implementation Verification  
**Constitutional Authority:** F5-S0 Vietnamese Accounting Semantic Authority  

---

## Executive Summary

**ARCHITECTURAL GAP DETECTED:** Bella Finance OS F1 Accounting Engine uses **symbolic account code `'PREPAYMENT_ASSET'`** for recording vendor prepayments, instead of posting directly to **TK 331** as specified in TT99/2025/TT-BTC.

This gap requires Human Architect decision on whether:
1. Bella uses **symbolic account mapping** (`'PREPAYMENT_ASSET'` → TK 331 via `finance_accounts` table), OR
2. Bella has **architectural mismatch** with Vietnamese accounting standards

**Evidence Source:** `supabase/migrations/20260818000000_finance_ap_engine_v1.sql`

---

## C.3.1 — Legal Semantic Baseline (From C.1)

Per TT99/2025 Phụ lục II - Hệ thống Tài khoản kế toán doanh nghiệp:

```
TK 331 — Phải trả cho người bán

Nội dung:
TK 331 phản ánh... số tiền đã ứng trước cho người bán...

Kết cấu:
TK 331 có thể có số dư bên Nợ.
Số dư Nợ phản ánh: số tiền đã ứng trước cho người bán...
```

**Constitutional Finding F5.6-SEM-001:** Vendor prepayment = Debit balance of TK 331 (NOT TK 141).

---

## C.3.2 — Bella F1 Implementation Evidence

### Finding 1: `finance_record_prepayment()` Posts to Symbolic Account Code

**File:** `supabase/migrations/20260818000000_finance_ap_engine_v1.sql`  
**Line:** ~925 (estimated, within `finance_record_prepayment()` function)

```sql
-- Record prepayment transaction via F1
INSERT INTO finance_transaction_lines (
    transaction_id,
    line_number,
    account_id,
    debit,
    credit,
    ...
) VALUES (
    v_transaction_id,
    1,
    (SELECT id FROM finance_accounts 
     WHERE tenant_id = p_tenant_id 
       AND account_code = 'PREPAYMENT_ASSET'),  -- ⚠️ SYMBOLIC CODE
    p_amount,
    0,
    ...
);
```

**Gap:** Posts Debit to `'PREPAYMENT_ASSET'` (symbolic code), NOT `'331'` (TK 331).

### Finding 2: `finance_apply_prepayment()` Posts to TK 331

**File:** `supabase/migrations/20260818000000_finance_ap_engine_v1.sql`  
**Line:** ~1060 (estimated, within `finance_apply_prepayment()` function)

```sql
-- Apply prepayment to invoice
INSERT INTO finance_transaction_lines (
    transaction_id,
    line_number,
    account_id,
    debit,
    credit,
    ...
) VALUES (
    v_transaction_id,
    1,
    (SELECT id FROM finance_accounts 
     WHERE tenant_id = p_tenant_id 
       AND account_code = '331'),  -- ✅ EXPLICIT TK 331
    p_amount_to_apply,
    0,
    ...
),
(
    v_transaction_id,
    2,
    (SELECT id FROM finance_accounts 
     WHERE tenant_id = p_tenant_id 
       AND account_code = 'PREPAYMENT_ASSET'),  -- ⚠️ SYMBOLIC CODE
    0,
    p_amount_to_apply,
    ...
);
```

**Observation:** 
- Line 1: Debit TK 331 (explicit)
- Line 2: Credit `'PREPAYMENT_ASSET'` (symbolic)

---

## C.3.3 — Architectural Gap Analysis

### Gap Type A: Symbolic Account Mapping (Hypothesis 1)

Bella F1 may use **indirect mapping**:

```
'PREPAYMENT_ASSET' (symbolic code)
        ↓
finance_accounts.account_code = 'PREPAYMENT_ASSET'
        ↓
finance_accounts.mapped_code = '331'  (or similar column)
        ↓
TK 331 (Vietnamese COA)
```

**Evidence Needed:**
1. Query `finance_accounts` table schema
2. Check if `account_code = 'PREPAYMENT_ASSET'` maps to TK 331
3. Verify if Bella uses dual-code system (symbolic + actual COA)

### Gap Type B: Architectural Mismatch (Hypothesis 2)

Bella F1 uses **separate prepayment asset account** instead of TK 331:

```
Bella Conceptual Model:
PREPAYMENT_ASSET (Bella's asset account, not TK 331)
        ↓
TK 141? TK 142? Custom account?
        ✗
NOT TK 331 (Vietnamese standard)
```

**Implication:** Architectural mismatch with TT99/2025.

### Evidence Required to Resolve Gap

```sql
-- Query 1: Check if PREPAYMENT_ASSET exists in finance_accounts
SELECT 
    account_code,
    account_name,
    account_type,
    parent_account_id,
    -- Any mapping columns?
FROM finance_accounts
WHERE tenant_id = <tenant_id>
  AND account_code = 'PREPAYMENT_ASSET';

-- Query 2: Check TK 331 definition in Bella
SELECT 
    account_code,
    account_name,
    account_type
FROM finance_accounts
WHERE tenant_id = <tenant_id>
  AND account_code = '331';

-- Query 3: Trace actual transaction lines
SELECT 
    ftl.transaction_id,
    ftl.account_id,
    fa.account_code,
    fa.account_name,
    ftl.debit,
    ftl.credit
FROM finance_transaction_lines ftl
JOIN finance_accounts fa ON ftl.account_id = fa.id
JOIN finance_transactions ft ON ftl.transaction_id = ft.id
WHERE ft.reference_type = 'VENDOR_PREPAYMENT'
  AND ft.reference_id IN (SELECT id FROM finance_vendor_prepayments LIMIT 1);
```

---

## C.3.4 — Gap vs. TT99/2025 Compliance

### Vietnamese Accounting Standard Requirement

**TT99/2025 requires:**
```
Nghiệp vụ: Ứng trước cho người bán
Định khoản: Nợ TK 331 / Có TK 111, 112, 113
```

### Bella F1 Current Behavior

**Recording prepayment:**
```sql
Nợ 'PREPAYMENT_ASSET' / Có TK 111, 112, 113
```

**Applying prepayment:**
```sql
Nợ TK 331 / Có 'PREPAYMENT_ASSET'
```

### Semantic Analysis

**Scenario 1: If `'PREPAYMENT_ASSET'` ≠ TK 331**

Bella introduces **intermediate account** not recognized by TT99/2025:

```
Record:  Nợ PREPAYMENT_ASSET / Có Bank
         ❌ Violates TT99/2025 (should be Nợ 331 / Có Bank)

Apply:   Nợ 331 / Có PREPAYMENT_ASSET
         ❌ Creates non-standard account flow
```

**Scenario 2: If `'PREPAYMENT_ASSET'` IS mapped to TK 331**

Bella uses **symbolic naming** but posts to correct TK 331:

```
Record:  Nợ 331 / Có Bank
         ✅ Complies with TT99/2025

Apply:   Nợ 331 / Có 331 (or Nợ Inventory / Có 331)
         (Needs C.2 verification from TT99 Phần B)
```

---

## C.3.5 — Architectural Decision Required

**BLOCKED:** Cannot proceed with F5.6 semantic specification until:

### Decision Point 1: Account Mapping Strategy

**Question:** Does Bella F1 use symbolic account codes that map to Vietnamese COA?

**If YES:**
- Document mapping mechanism (`'PREPAYMENT_ASSET'` → TK 331)
- Verify mapping table/logic in `finance_accounts`
- Confirm all F4 contracts use symbolic codes
- F5.6 formula remains valid (maps to TK 331 Debit balance)

**If NO:**
- **ARCHITECTURAL GAP CONFIRMED**
- Bella F1 violates TT99/2025 semantic
- Options:
  1. Add account mapping layer (symbolic → actual COA)
  2. Modify F1 to post directly to TK 331
  3. Accept gap and document compliance exception

### Decision Point 2: F4 Contract Alignment

**Question:** Should F4 Accounts Payable use symbolic codes or explicit TK codes?

**Option A: Symbolic Codes (Current)**
```typescript
// F4 Contract
type AccountCode = 'PREPAYMENT_ASSET' | 'ACCOUNTS_PAYABLE' | ...;
```

**Option B: Explicit TK Codes**
```typescript
// F4 Contract
type VietnameseAccountCode = '331' | '111' | '112' | ...;
```

### Decision Point 3: Cross-Tenant COA Variance

**Question:** Does Bella support multi-country COA?

- If YES: Symbolic codes make sense (`'PREPAYMENT_ASSET'` → TK 331 in Vietnam, → different code in Thailand)
- If NO: Direct TK codes are simpler and more transparent

---

## C.3.6 — Impact on F5.6 Reconciliation

### If Gap Type A (Symbolic Mapping):

F5.6 formula **remains valid** but needs explicit mapping:

```sql
-- F5.6 Vendor Prepayment Balance
WITH vendor_prepayment_balance AS (
  SELECT
    vendor_id,
    SUM(CASE 
      WHEN account_code IN ('PREPAYMENT_ASSET', '331') 
           AND debit > 0 THEN debit
      WHEN account_code IN ('PREPAYMENT_ASSET', '331') 
           AND credit > 0 THEN -credit
      ELSE 0
    END) AS balance
  FROM finance_transaction_lines ftl
  JOIN finance_accounts fa ON ftl.account_id = fa.id
  WHERE fa.account_code IN ('PREPAYMENT_ASSET', '331')
  GROUP BY vendor_id
)
```

### If Gap Type B (Architectural Mismatch):

F5.6 **cannot be completed** until:
1. F1 modified to post to TK 331, OR
2. Human Architect approves compliance exception, OR
3. Mapping layer added to bridge symbolic → actual COA

---

## C.3.7 — Next Steps (BLOCKED)

### Immediate Actions Required:

1. **Query `finance_accounts` table** to verify:
   - Does `account_code = 'PREPAYMENT_ASSET'` exist?
   - Does `account_code = '331'` exist?
   - Is there a mapping column or mechanism?

2. **Query actual transaction data** (if test data exists):
   - Find a vendor prepayment transaction
   - Trace `finance_vendor_prepayments` → `f1_transaction_id` → `finance_transaction_lines` → `finance_accounts.account_code`
   - Confirm actual account code used

3. **Human Architect Decision:**
   - Review Gap Type A vs. Gap Type B analysis
   - Decide on account mapping strategy
   - Approve F5.6 semantic specification direction

### Pending C.2 Legal Verification:

- Await TT99/2025 Phụ lục II Phần B (Nội dung và phương pháp kế toán TK 331)
- Extract accounting entries for:
  - PREPAYMENT_RECORDED → Nợ 331 / Có 111,112?
  - PREPAYMENT_APPLIED → Nợ ? / Có 331?
  - PREPAYMENT_REFUNDED → Nợ 111,112 / Có 331?

---

## C.3.8 — F5-S0 Constitutional Compliance

### Boundary Maintained ✅

- **Legal Semantic (C.1):** TK 331 VERIFIED from TT99/2025
- **Implementation (C.3):** Gap detected, NOT assumed to comply
- **Clear Separation:** Vietnamese law ≠ Bella implementation

### Rejected Approaches ❌

1. **Assume `'PREPAYMENT_ASSET'` = TK 331** without evidence
2. **Modify semantic to match implementation** (violates F5-S0: Law → Implementation)
3. **Proceed to C.4-C.6** without resolving Gap C.3

### Constitutional Principle

> "Vietnamese Law → VAS → TT99/2025 → Enterprise Policy → Bella F1 COA → F2/F4 Contracts → F5 Logic"

C.3 gap must be resolved at **"Bella F1 COA"** layer before F5 logic can be finalized.

---

## C.3.9 — Research Status Update

```
C.1 Vendor Prepayment Semantic    🟢 GREEN   (TT99/2025 verified)
C.2 VAS Treatment                  🔴 BLOCKED (awaiting TT99 Phần B)
C.3 Bella F1 Implementation        🟡 YELLOW  (gap detected, pending resolution)
C.4 F4 Alignment                   🔴 BLOCKED (depends on C.3)
C.5 Formula                        🟡 YELLOW  (logic sound, needs C.3+C.2)
C.6 Temporal                       🔴 BLOCKED (depends on C.2+C.3)
```

---

## Appendix: Code References

### finance_record_prepayment() Fragment

```sql
-- Line ~925 in supabase/migrations/20260818000000_finance_ap_engine_v1.sql
CREATE OR REPLACE FUNCTION finance_record_prepayment(
    p_tenant_id UUID,
    p_vendor_id UUID,
    p_amount NUMERIC,
    p_payment_method_id UUID,
    p_reference_number TEXT,
    ...
) RETURNS UUID AS $$
DECLARE
    v_prepayment_id UUID;
    v_transaction_id UUID;
BEGIN
    -- Insert vendor prepayment record
    INSERT INTO finance_vendor_prepayments (...)
    VALUES (...) RETURNING id INTO v_prepayment_id;

    -- Create F1 accounting transaction
    INSERT INTO finance_transactions (...)
    VALUES (...) RETURNING id INTO v_transaction_id;

    -- Debit: PREPAYMENT_ASSET (symbolic)
    INSERT INTO finance_transaction_lines (
        transaction_id, line_number, account_id, debit, credit, ...
    ) VALUES (
        v_transaction_id,
        1,
        (SELECT id FROM finance_accounts 
         WHERE tenant_id = p_tenant_id 
           AND account_code = 'PREPAYMENT_ASSET'),  -- ⚠️
        p_amount,
        0,
        ...
    );

    -- Credit: Bank account
    INSERT INTO finance_transaction_lines (...)
    VALUES (...);

    RETURN v_prepayment_id;
END;
$$ LANGUAGE plpgsql;
```

### finance_apply_prepayment() Fragment

```sql
-- Line ~1060 in supabase/migrations/20260818000000_finance_ap_engine_v1.sql
CREATE OR REPLACE FUNCTION finance_apply_prepayment(
    p_tenant_id UUID,
    p_prepayment_id UUID,
    p_invoice_id UUID,
    p_amount_to_apply NUMERIC
) RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
BEGIN
    -- Create F1 accounting transaction
    INSERT INTO finance_transactions (...)
    VALUES (...) RETURNING id INTO v_transaction_id;

    -- Debit: TK 331 (explicit)
    INSERT INTO finance_transaction_lines (
        transaction_id, line_number, account_id, debit, credit, ...
    ) VALUES (
        v_transaction_id,
        1,
        (SELECT id FROM finance_accounts 
         WHERE tenant_id = p_tenant_id 
           AND account_code = '331'),  -- ✅
        p_amount_to_apply,
        0,
        ...
    );

    -- Credit: PREPAYMENT_ASSET (symbolic)
    INSERT INTO finance_transaction_lines (
        transaction_id, line_number, account_id, debit, credit, ...
    ) VALUES (
        v_transaction_id,
        2,
        (SELECT id FROM finance_accounts 
         WHERE tenant_id = p_tenant_id 
           AND account_code = 'PREPAYMENT_ASSET'),  -- ⚠️
        0,
        p_amount_to_apply,
        ...
    );

    -- Update vendor prepayment and invoice application records
    ...
END;
$$ LANGUAGE plpgsql;
```

---

**END OF C.3 GAP DOCUMENTATION**

**Awaiting:**
1. Human Architect decision on symbolic account mapping strategy
2. Query results from `finance_accounts` table
3. TT99/2025 Phụ lục II Phần B for C.2 legal verification
