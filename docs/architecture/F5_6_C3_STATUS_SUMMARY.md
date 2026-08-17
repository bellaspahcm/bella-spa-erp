# F5.6-C.3 Status Summary — Bella F1 Implementation Gap

**Date:** 2026-08-16  
**Status:** 🟡 GAP DETECTED — Awaiting Human Architect Decision  
**Research Phase:** Part C — Vendor Prepayment Domain  
**Item:** C.3 Bella F1 Implementation Verification  

---

## Quick Summary

**C.1 Legal Semantic:** ✅ **VERIFIED** — Vendor prepayment → TK 331 Debit balance (TT99/2025)  
**C.3 Implementation:** 🟡 **GAP DETECTED** — Bella uses `'PREPAYMENT_ASSET'` symbolic code, NOT direct TK 331

---

## What Was Discovered

### Evidence from Code Review

**File:** `supabase/migrations/20260818000000_finance_ap_engine_v1.sql`

**Function 1: `finance_record_prepayment()` (line ~925)**
```sql
-- When vendor prepayment is recorded:
Debit:  'PREPAYMENT_ASSET' (symbolic account code)
Credit: Bank account (111/112/113)
```

**Function 2: `finance_apply_prepayment()` (line ~1060)**
```sql
-- When prepayment is applied to invoice:
Debit:  '331' (explicit TK 331)
Credit: 'PREPAYMENT_ASSET' (symbolic account code)
```

### The Gap

**TT99/2025 requires:**
```
Recording prepayment: Nợ TK 331 / Có TK 111,112,113
```

**Bella F1 actually does:**
```
Recording prepayment: Nợ 'PREPAYMENT_ASSET' / Có TK 111,112,113
```

**The question:** Is `'PREPAYMENT_ASSET'` mapped to TK 331, or is it a separate account?

---

## Two Possible Interpretations

### Hypothesis A: Symbolic Account Mapping (Good Case)

Bella uses **symbolic codes** for cross-country flexibility:

```
'PREPAYMENT_ASSET' (internal symbolic code)
        ↓
finance_accounts table mapping
        ↓
TK 331 (Vietnamese COA)
```

**If this is true:**
- Bella semantically complies with TT99/2025
- F4 contracts use symbolic codes (e.g., `'PREPAYMENT_ASSET'`)
- F1 accounts table maps to actual Vietnamese COA
- F5.6 reconciliation can proceed with mapping layer

**Evidence needed:**
```sql
SELECT account_code, account_name, mapped_code
FROM finance_accounts
WHERE account_code = 'PREPAYMENT_ASSET';

-- Expected result if Hypothesis A is correct:
-- account_code: 'PREPAYMENT_ASSET'
-- account_name: 'Vendor Prepayment Asset'
-- mapped_code (or similar): '331'
```

### Hypothesis B: Architectural Mismatch (Problem Case)

Bella uses **separate prepayment asset account** not recognized by TT99/2025:

```
'PREPAYMENT_ASSET' (Bella's custom account)
        ↓
NOT mapped to TK 331
        ↓
Violates Vietnamese accounting standard
```

**If this is true:**
- Bella creates intermediate account flow not in TT99/2025
- Recording: `Nợ PREPAYMENT_ASSET / Có Bank` ❌ (should be `Nợ 331 / Có Bank`)
- Applying: `Nợ 331 / Có PREPAYMENT_ASSET` ❌ (non-standard transfer)
- Architectural fix required before F5.6 can proceed

**Evidence needed:**
```sql
SELECT account_code, account_name, account_type
FROM finance_accounts
WHERE account_code = 'PREPAYMENT_ASSET';

-- If returns a separate account NOT linked to 331:
-- Problem confirmed
```

---

## What This Means for F5.6

### If Hypothesis A (Symbolic Mapping):

**F5.6 can proceed** with explicit mapping:

```sql
-- F5.6 Vendor Prepayment Reconciliation
WITH vendor_prepayment_gl AS (
  SELECT
    vendor_id,
    SUM(CASE 
      WHEN fa.account_code IN ('PREPAYMENT_ASSET', '331')
           AND ftl.debit > 0 THEN ftl.debit
      WHEN fa.account_code IN ('PREPAYMENT_ASSET', '331')
           AND ftl.credit > 0 THEN -ftl.credit
      ELSE 0
    END) AS gl_balance
  FROM finance_transaction_lines ftl
  JOIN finance_accounts fa ON ftl.account_id = fa.id
  WHERE fa.account_code IN ('PREPAYMENT_ASSET', '331')
  GROUP BY vendor_id
)
```

**Requires:**
- Document symbolic → actual COA mapping
- F5 reconciliation includes both codes
- Verify `'PREPAYMENT_ASSET'` semantically equals TK 331

### If Hypothesis B (Architectural Mismatch):

**F5.6 is BLOCKED** until architectural fix:

**Option 1:** Add account mapping layer
```sql
-- Create mapping table/column
ALTER TABLE finance_accounts
ADD COLUMN vietnamese_coa_code TEXT;

UPDATE finance_accounts
SET vietnamese_coa_code = '331'
WHERE account_code = 'PREPAYMENT_ASSET';
```

**Option 2:** Modify F1 to post directly to TK 331
```sql
-- Change finance_record_prepayment() to:
INSERT INTO finance_transaction_lines (...)
VALUES (
    ...,
    (SELECT id FROM finance_accounts WHERE account_code = '331'),  -- Direct TK 331
    ...
);
```

**Option 3:** Accept gap and document compliance exception
- Document that Bella uses non-standard prepayment flow
- May affect audit compliance for Vietnamese companies
- Requires Human Architect approval

---

## Evidence Required to Resolve Gap

### Step 1: Query Account Definitions

```sql
-- Check if PREPAYMENT_ASSET exists
SELECT 
    account_code,
    account_name,
    account_type,
    parent_account_id,
    normal_balance
FROM finance_accounts
WHERE tenant_id = :tenant_id
  AND account_code = 'PREPAYMENT_ASSET';

-- Check if TK 331 exists
SELECT 
    account_code,
    account_name,
    account_type,
    parent_account_id,
    normal_balance
FROM finance_accounts
WHERE tenant_id = :tenant_id
  AND account_code = '331';
```

### Step 2: Trace Actual Transaction (If Test Data Exists)

```sql
-- Find a vendor prepayment transaction
SELECT 
    fvp.id,
    fvp.vendor_id,
    fvp.fact_type,
    fvp.amount_minor,
    fvp.f1_transaction_id
FROM finance_vendor_prepayments fvp
WHERE fvp.tenant_id = :tenant_id
LIMIT 1;

-- Trace its GL posting
SELECT 
    ftl.line_number,
    fa.account_code,
    fa.account_name,
    ftl.debit,
    ftl.credit
FROM finance_transaction_lines ftl
JOIN finance_accounts fa ON ftl.account_id = fa.id
WHERE ftl.transaction_id = :f1_transaction_id
ORDER BY ftl.line_number;
```

### Step 3: Verify Account Mapping Logic

```sql
-- Check if there's a mapping table or column
-- (Schema may vary, examples:)

-- Option A: Mapping table
SELECT * FROM finance_account_mappings
WHERE symbolic_code = 'PREPAYMENT_ASSET';

-- Option B: Mapping column
SELECT account_code, vietnamese_coa_code
FROM finance_accounts
WHERE account_code = 'PREPAYMENT_ASSET';

-- Option C: Configuration table
SELECT * FROM finance_coa_configurations
WHERE symbolic_code = 'PREPAYMENT_ASSET';
```

---

## Architectural Decision Required

**Human Architect must decide:**

### Decision 1: Account Mapping Strategy

**Question:** Does Bella F1 use symbolic account codes that map to country-specific COA?

**If YES (Hypothesis A):**
- ✅ Document mapping mechanism
- ✅ Verify `'PREPAYMENT_ASSET'` → TK 331 mapping
- ✅ F5.6 includes both codes in reconciliation
- ✅ F4 contracts continue using symbolic codes

**If NO (Hypothesis B):**
- ⚠️ Architectural mismatch confirmed
- ⚠️ Choose fix: mapping layer, F1 modification, or compliance exception
- ⚠️ F5.6 blocked until fix implemented

### Decision 2: F4 Contract Design

**Question:** Should F4 Accounts Payable contract use symbolic or explicit TK codes?

**Option A: Symbolic Codes (Current)**
```typescript
type AccountCode = 'PREPAYMENT_ASSET' | 'ACCOUNTS_PAYABLE' | 'CASH';
```

**Pros:**
- Multi-country flexibility (Thailand, Vietnam, Indonesia)
- Business logic abstracted from COA specifics
- Easier to maintain cross-country consistency

**Cons:**
- Requires mapping layer to Vietnamese COA
- Less transparent for Vietnamese-specific auditing
- F5 reconciliation needs to know both codes

**Option B: Explicit TK Codes**
```typescript
type VietnameseAccountCode = '331' | '111' | '112' | '113' | ...;
```

**Pros:**
- Direct compliance with TT99/2025
- Transparent for Vietnamese auditing
- F5 reconciliation simpler (direct TK codes)

**Cons:**
- Not suitable for multi-country deployment
- Each country needs separate F4 contract variant
- More complex to maintain

### Decision 3: Multi-Country COA Strategy

**Question:** Does Bella support multiple countries with different COAs?

**If YES:**
- Symbolic codes make sense
- F1 `finance_accounts` table has country-specific mappings
- F5 reconciliation becomes country-aware

**If NO (Vietnam-only):**
- Direct TK codes are simpler
- Remove symbolic abstraction layer
- F1 uses Vietnamese COA directly

---

## Impact on F5.6 Timeline

### If Hypothesis A (Symbolic Mapping):

**Timeline:** No significant delay
- Document mapping mechanism (1 day)
- Update F5.6 reconciliation to include both codes (1 day)
- Continue with C.4-C.6 (3-4 days)

**Total C.3 impact:** +2 days

### If Hypothesis B (Architectural Mismatch):

**Timeline:** Significant delay depending on fix choice

**Option 1: Add mapping layer**
- Design mapping schema (1 day)
- Implement migration (1 day)
- Update F1 functions (1 day)
- Test (1 day)
- **Total:** +4 days

**Option 2: Modify F1 to use TK 331 directly**
- Update `finance_record_prepayment()` (1 day)
- Update F4 contract (1 day)
- Migration for existing data (1 day)
- Test (1 day)
- **Total:** +4 days

**Option 3: Accept gap (compliance exception)**
- Document exception (0.5 day)
- Human Architect approval (wait time)
- Adjust F5.6 to work with current structure (2 days)
- **Total:** +2.5 days + approval wait time

---

## Next Steps (Immediate)

### 1. Human Architect Review 🔴 REQUIRED

**Review Document:** `F5_6_C3_BELLA_F1_IMPLEMENTATION_GAP.md`

**Decision Points:**
- [ ] Confirm Hypothesis A (symbolic mapping) or Hypothesis B (mismatch)
- [ ] If Hypothesis B: Choose fix option (mapping layer, F1 modification, or exception)
- [ ] Approve F4 contract design (symbolic vs explicit codes)
- [ ] Confirm multi-country COA strategy

### 2. Database Query Execution 🔴 REQUIRED

**If test database exists:**
```sql
-- Execute queries from "Evidence Required" section above
-- Provide results to Human Architect
```

**If test database does NOT exist:**
- Review `finance_accounts` table schema
- Review F1 account setup seed data
- Trace code logic for account resolution

### 3. C.2 Legal Verification ⏳ PENDING

**Still waiting for:** TT99/2025 Phụ lục II Phần B (Nội dung và phương pháp kế toán TK 331)

**C.2 will verify:**
- PREPAYMENT_RECORDED → Nợ 331 / Có 111,112?
- PREPAYMENT_APPLIED → Nợ ? / Có 331?
- PREPAYMENT_REFUNDED → Nợ 111,112 / Có 331?

**C.3 and C.2 are independent** — can proceed in parallel.

### 4. C.4-C.6 Blocked Until C.3 Resolved

- C.4 (F4 alignment): Depends on C.3 decision (symbolic vs explicit codes)
- C.5 (Formula): Depends on C.3 account mapping
- C.6 (Temporal): Can proceed independently once C.2 available

---

## F5-S0 Constitutional Compliance ✅

**Boundary Maintained:**

```
C.1 Legal Semantic
    TK 331 = Vendor prepayment (Debit balance)
    ✅ VERIFIED from TT99/2025
            ↓
    (F5-S0 BOUNDARY)
            ↓
C.3 Implementation
    Bella uses 'PREPAYMENT_ASSET' (symbolic code?)
    🟡 GAP DETECTED, verification incomplete
```

**Key Principle:**
> "Legal framework ≠ Implementation. Gap detected, NOT assumed to comply."

**Rejected Approaches:**
1. ❌ Assume `'PREPAYMENT_ASSET'` = TK 331 without evidence
2. ❌ Modify legal semantic to match implementation
3. ❌ Proceed to C.4-C.6 without resolving gap

---

## Research Status After C.3

```
C.1 Vendor Prepayment Semantic    🟢 GREEN     (TT99/2025 verified)
C.2 VAS Treatment                  🔴 BLOCKED   (awaiting TT99 Phần B)
C.3 Bella F1 Implementation        🟡 GAP       (gap detected, decision pending)
C.4 F4 Alignment                   🔴 BLOCKED   (depends on C.3)
C.5 Formula                        🟡 DERIVED   (depends on C.2+C.3)
C.6 Temporal                       🔴 BLOCKED   (depends on C.2+C.3)
```

**Part C Progress:** 1/6 GREEN, 1/6 GAP, 1/6 DERIVED, 3/6 BLOCKED

---

**Status:** 🟡 **C.3 GAP DOCUMENTED** — Awaiting Human Architect decision on account mapping strategy

**Blocking:** C.4, C.5 (partial), C.6 (partial)

**Next:** Human Architect reviews `F5_6_C3_BELLA_F1_IMPLEMENTATION_GAP.md` and decides on Hypothesis A vs B
