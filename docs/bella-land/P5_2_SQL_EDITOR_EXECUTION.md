# P5.2 Schema Correction — SQL Editor Execution Plan

**Date:** 2026-09-11  
**Classification:** Schema correction (runtime DB → canonical contract)  
**Pre-flight:** ✅ COMPLETE (no orphans, delete protection missing)

---

## Execution Sequence

### Step 1: Catalog Inspection (Required First)

**Purpose:** Verify actual FK constraint names and properties before DROP/ADD

**SQL:**
```sql
-- Query actual FK constraints on re_reservations
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 're_reservations'
  AND c.contype = 'f'
ORDER BY conname;
```

**Expected Scenarios:**

**A. No FK constraints exist**
```
(empty result)
```
→ Proceed to Step 2A (add new)

**B. FK exists with wrong delete rule**
```
re_reservations_product_id_fkey  | FOREIGN KEY (product_id) ... ON DELETE CASCADE
re_reservations_customer_id_fkey | FOREIGN KEY (customer_id) ... ON DELETE SET NULL
```
→ Proceed to Step 2B (replace existing)

**C. FK already correct**
```
re_reservations_product_id_fkey  | FOREIGN KEY (product_id) ... ON DELETE RESTRICT
re_reservations_customer_id_fkey | FOREIGN KEY (customer_id) ... ON DELETE RESTRICT
```
→ **STOP**: FK already correct, I4/I5 failures need different RCA

**D. FK exists with different names**
```
fk_reservation_product | FOREIGN KEY (product_id) ...
fk_reservation_customer | FOREIGN KEY (customer_id) ...
```
→ Use actual names in Step 2B

---

### Step 2A: Add New FK Constraints (If Scenario A)

```sql
-- Add FK RESTRICT for product_id
ALTER TABLE re_reservations
  ADD CONSTRAINT re_reservations_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES real_estate_products(id)
  ON DELETE RESTRICT;

-- Add FK RESTRICT for customer_id
ALTER TABLE re_reservations
  ADD CONSTRAINT re_reservations_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES re_customers(id)
  ON DELETE RESTRICT;
```

**Note:** No DEFERRABLE clause (not proven canonical requirement)

---

### Step 2B: Replace Existing FK (If Scenario B or D)

**Use actual constraint names from Step 1:**

```sql
-- Drop existing constraints (use actual names from catalog query)
ALTER TABLE re_reservations
  DROP CONSTRAINT IF EXISTS re_reservations_product_id_fkey;

ALTER TABLE re_reservations
  DROP CONSTRAINT IF EXISTS re_reservations_customer_id_fkey;

-- If different names found, drop those instead:
-- ALTER TABLE re_reservations DROP CONSTRAINT IF EXISTS <actual_name>;

-- Add corrected constraints
ALTER TABLE re_reservations
  ADD CONSTRAINT re_reservations_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES real_estate_products(id)
  ON DELETE RESTRICT;

ALTER TABLE re_reservations
  ADD CONSTRAINT re_reservations_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES re_customers(id)
  ON DELETE RESTRICT;
```

---

### Step 3: Verify Constraint Applied

**SQL:**
```sql
-- Verify constraints now exist with RESTRICT
SELECT
  conname AS constraint_name,
  CASE confdeltype
    WHEN 'a' THEN 'NO ACTION'
    WHEN 'r' THEN 'RESTRICT'
    WHEN 'c' THEN 'CASCADE'
    WHEN 'n' THEN 'SET NULL'
    WHEN 'd' THEN 'SET DEFAULT'
  END AS on_delete_action
FROM pg_constraint
WHERE conrelid = 're_reservations'::regclass
  AND contype = 'f'
  AND (conname LIKE '%product_id%' OR conname LIKE '%customer_id%')
ORDER BY conname;
```

**Expected Output:**
```
re_reservations_customer_id_fkey | RESTRICT
re_reservations_product_id_fkey  | RESTRICT
```

**If output doesn't match:** STOP, investigate why constraints not applied.

---

### Step 4: Direct Delete Verification

**Purpose:** Confirm FK protection working before full test suite

**Run Script:**
```bash
npx tsx scripts/bella-land/verify-actual-fk-constraints.ts
```

**Expected Output:**
```
TEST 1: DELETE Product with active Reservation
✅ DELETE BLOCKED by FK constraint

TEST 2: DELETE Customer with active Reservation
✅ DELETE BLOCKED by FK constraint

VERDICT: FK RESTRICT constraints ARE enforced
```

**If ANY delete succeeds:** STOP, FK not enforced despite constraint existence.

---

## Decision Tree

```
Run Step 1 (catalog inspect)
        ↓
    Scenario?
        ↓
   ┌────┴────┬────────────┬────────────┐
   A         B            C            D
  (none)  (wrong rule) (already OK) (diff names)
   ↓         ↓            ↓            ↓
Step 2A   Step 2B      STOP RCA     Step 2B
   ↓         ↓                        ↓
Step 3    Step 3                   Step 3
   ↓         ↓                        ↓
Step 4    Step 4                   Step 4
   ↓         ↓                        ↓
PASS      PASS                     PASS
   ↓         ↓                        ↓
───┴─────────┴────────────────────────┴───
               ↓
      Schema Correction ✅
               ↓
      Continue P5.2 Remediation
```

---

## Rollback Plan

**If Step 3 verification fails:**
```sql
-- Remove newly added constraints
ALTER TABLE re_reservations
  DROP CONSTRAINT IF EXISTS re_reservations_product_id_fkey;

ALTER TABLE re_reservations
  DROP CONSTRAINT IF EXISTS re_reservations_customer_id_fkey;
```

**If Step 4 delete test still passes after constraints added:**
- Constraint exists but not enforced → deeper DB/Supabase issue
- Escalate: This blocks P5.2 remediation

---

## Post-Correction Actions

**After Step 4 PASS:**

1. ✅ Schema correction complete
2. ⏸️ Refactor I3 test to use `ReservationService.reserveProduct()`
3. ⏸️ Full P5.2 rerun (10 gates)
4. ⏸️ Document results
5. ⏸️ If 10/10 PASS → P5.3

---

## Status Tracking

```
Pre-flight              ✅ COMPLETE
Catalog inspect         ⏸️ PENDING (Step 1)
FK correction           ⏸️ PENDING (Step 2)
Direct verification     ⏸️ PENDING (Step 4)
I3 refactor             ⏸️ BLOCKED
P5.2 full rerun         ⏸️ BLOCKED
P5.2 verdict            🔴 NOT VERIFIED
Final RC                ⏸️ BLOCKED
```

**Current Gate:** Step 1 — Catalog inspection in SQL Editor

---

## Governance Notes

- **Classification:** Schema correction (not new feature)
- **Evidence:** Pre-flight confirmed orphan-free, no FK protection
- **Canonical:** ON DELETE RESTRICT required by spec
- **DEFERRABLE:** Omitted (not proven canonical requirement)
- **Audit:** Full catalog inspection before any ALTER TABLE

**Next Action:** Execute Step 1 in Supabase SQL Editor
