-- ============================================================================
-- P5.2 FIX: Apply FK RESTRICT Constraints to re_reservations
-- ============================================================================
-- Context: Integration tests revealed FK constraints not enforced
-- Root Cause: Original migration (20260802150000) not applied to production
-- Fix: Apply ON DELETE RESTRICT for data integrity
-- Evidence: docs/bella-land/P5_2_RCA_CANONICAL_VERIFICATION.md
-- ============================================================================

-- Drop existing FK constraints if they exist (may have CASCADE or NO ACTION)
ALTER TABLE IF EXISTS re_reservations 
  DROP CONSTRAINT IF EXISTS re_reservations_product_id_fkey;

ALTER TABLE IF EXISTS re_reservations 
  DROP CONSTRAINT IF EXISTS re_reservations_customer_id_fkey;

-- Apply canonical FK constraints with RESTRICT
ALTER TABLE re_reservations
  ADD CONSTRAINT re_reservations_product_id_fkey
  FOREIGN KEY (product_id)
  REFERENCES real_estate_products(id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE re_reservations
  ADD CONSTRAINT re_reservations_customer_id_fkey
  FOREIGN KEY (customer_id)
  REFERENCES re_customers(id)
  ON DELETE RESTRICT
  DEFERRABLE INITIALLY DEFERRED;

-- Verification query (run after migration):
-- SELECT 
--   conname AS constraint_name,
--   CASE confdeltype
--     WHEN 'a' THEN 'NO ACTION'
--     WHEN 'r' THEN 'RESTRICT'
--     WHEN 'c' THEN 'CASCADE'
--     WHEN 'n' THEN 'SET NULL'
--     WHEN 'd' THEN 'SET DEFAULT'
--   END AS on_delete_action
-- FROM pg_constraint
-- WHERE conrelid = 're_reservations'::regclass
--   AND contype = 'f'
--   AND (conname LIKE '%product_id%' OR conname LIKE '%customer_id%')
-- ORDER BY conname;
--
-- Expected output:
--   re_reservations_customer_id_fkey | RESTRICT
--   re_reservations_product_id_fkey  | RESTRICT

COMMENT ON CONSTRAINT re_reservations_product_id_fkey ON re_reservations 
  IS 'P5.2 Fix: Prevents Product deletion when active Reservations exist';

COMMENT ON CONSTRAINT re_reservations_customer_id_fkey ON re_reservations 
  IS 'P5.2 Fix: Prevents Customer deletion when active Reservations exist';
