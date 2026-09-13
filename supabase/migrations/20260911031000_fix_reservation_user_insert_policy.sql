-- Fix P5.4 T1-T2: Update second RLS policy with same cross-table checks
-- 
-- Root Cause: reservations_user_insert policy bypasses tenant checks
-- Both PERMISSIVE policies must enforce same security constraints

-- Drop existing policy
DROP POLICY IF EXISTS "reservations_user_insert" ON re_reservations;

-- Recreate with same cross-table tenant checks as "Reservations: Create own"
CREATE POLICY "reservations_user_insert"
ON re_reservations
FOR INSERT
WITH CHECK (
  -- User owns the reservation
  (user_id = auth.uid())
  AND
  -- Product belongs to same tenant as user
  (product_id IN (
    SELECT id 
    FROM real_estate_products 
    WHERE tenant_id = (
      SELECT tenant_id 
      FROM users 
      WHERE id = auth.uid()
    )
  ))
  AND
  -- Customer belongs to same tenant as user
  (customer_id IN (
    SELECT id 
    FROM re_customers 
    WHERE tenant_id = (
      SELECT tenant_id 
      FROM users 
      WHERE id = auth.uid()
    )
  ))
);

-- Add comment documenting the fix
COMMENT ON POLICY "reservations_user_insert" ON re_reservations IS 
  'P5.4 Security Fix: Added cross-table tenant validation to match primary INSERT policy';
