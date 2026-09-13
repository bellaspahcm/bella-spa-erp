-- ============================================================================
-- P5.2 SCHEMA CORRECTION — Full Execution Script
-- ============================================================================
-- Purpose: Add FK RESTRICT constraints to re_reservations
-- Classification: Schema correction (runtime → canonical contract)
-- Pre-flight: ✅ COMPLETE (no orphans, protection missing)
-- Evidence: docs/bella-land/P5_2_RCA_CANONICAL_VERIFICATION.md
-- ============================================================================

-- ============================================================================
-- STEP 1: CATALOG INSPECTION (Run this first, review output)
-- ============================================================================

SELECT
  conname AS constraint_name,
  pg_get_constraintdef(c.oid) AS constraint_definition
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
WHERE t.relname = 're_reservations'
  AND c.contype = 'f'
ORDER BY conname;

-- Expected scenarios:
-- A. Empty result → No FK exists → Proceed to STEP 2A
-- B. FK exists with wrong delete rule → Proceed to STEP 2B
-- C. FK already RESTRICT → STOP, different RCA needed
-- D. FK with different names → Note names, use in STEP 2B

-- ============================================================================
-- STEP 2A: ADD NEW CONSTRAINTS (if Step 1 returned empty)
-- ============================================================================

-- Uncomment and run if no FK constraints exist:

-- ALTER TABLE re_reservations
--   ADD CONSTRAINT re_reservations_product_id_fkey
--   FOREIGN KEY (product_id)
--   REFERENCES real_estate_products(id)
--   ON DELETE RESTRICT;

-- ALTER TABLE re_reservations
--   ADD CONSTRAINT re_reservations_customer_id_fkey
--   FOREIGN KEY (customer_id)
--   REFERENCES re_customers(id)
--   ON DELETE RESTRICT;

-- ============================================================================
-- STEP 2B: REPLACE EXISTING CONSTRAINTS (if Step 1 found wrong constraints)
-- ============================================================================

-- Uncomment and run if FK exists with wrong delete rule:

-- -- Drop existing constraints (use actual names from Step 1 if different)
-- ALTER TABLE re_reservations
--   DROP CONSTRAINT IF EXISTS re_reservations_product_id_fkey;

-- ALTER TABLE re_reservations
--   DROP CONSTRAINT IF EXISTS re_reservations_customer_id_fkey;

-- -- Add corrected constraints
-- ALTER TABLE re_reservations
--   ADD CONSTRAINT re_reservations_product_id_fkey
--   FOREIGN KEY (product_id)
--   REFERENCES real_estate_products(id)
--   ON DELETE RESTRICT;

-- ALTER TABLE re_reservations
--   ADD CONSTRAINT re_reservations_customer_id_fkey
--   FOREIGN KEY (customer_id)
--   REFERENCES re_customers(id)
--   ON DELETE RESTRICT;

-- ============================================================================
-- STEP 3: VERIFY CONSTRAINTS APPLIED
-- ============================================================================

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

-- Expected output:
-- re_reservations_customer_id_fkey | RESTRICT
-- re_reservations_product_id_fkey  | RESTRICT

-- ============================================================================
-- STEP 4: EMPIRICAL VERIFICATION (run in separate terminal)
-- ============================================================================

-- After SQL steps complete, verify FK protection:
-- npx tsx scripts/bella-land/verify-actual-fk-constraints.ts
--
-- Expected:
-- ✅ DELETE Product → BLOCKED
-- ✅ DELETE Customer → BLOCKED

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================

-- Uncomment to remove constraints if verification fails:

-- ALTER TABLE re_reservations
--   DROP CONSTRAINT IF EXISTS re_reservations_product_id_fkey;

-- ALTER TABLE re_reservations
--   DROP CONSTRAINT IF EXISTS re_reservations_customer_id_fkey;

-- ============================================================================
-- COMPLETION CHECKLIST
-- ============================================================================

-- [ ] Step 1: Catalog inspection → Document findings
-- [ ] Step 2A or 2B: Apply correction → Constraints added
-- [ ] Step 3: Verify in catalog → Both show RESTRICT
-- [ ] Step 4: Run verify script → Both deletes BLOCKED
-- [ ] Continue: Refactor I3 → Full P5.2 rerun

-- ============================================================================
-- GOVERNANCE NOTES
-- ============================================================================

-- Classification: Schema correction (not new feature)
-- Evidence: Pre-flight confirmed no orphans, no protection
-- Canonical: ON DELETE RESTRICT required by spec
-- DEFERRABLE: Omitted (not proven canonical requirement)
-- Audit: Full catalog inspection before ALTER TABLE
