-- Fix P5.4 T1-T2: Add cross-table tenant authorization to reservations
-- 
-- Root Cause: RLS policy allows cross-tenant product_id/customer_id references
-- Fix: Validate product.tenant_id and customer.tenant_id match reservation.tenant_id

-- Drop existing policy
DROP POLICY IF EXISTS "Reservations: Create own" ON re_reservations;

-- Recreate with cross-table tenant checks
CREATE POLICY "Reservations: Create own"
ON re_reservations
FOR INSERT
WITH CHECK (
  -- User owns the reservation
  (user_id = auth.uid())
  AND
  -- Reservation tenant matches user's tenant
  (tenant_id IN (
    SELECT tenant_id 
    FROM users 
    WHERE id = auth.uid()
  ))
  AND
  -- Product belongs to same tenant
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
  -- Customer belongs to same tenant
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
COMMENT ON POLICY "Reservations: Create own" ON re_reservations IS 
  'P5.4 Security Fix: Validates cross-table tenant ownership for product_id and customer_id to prevent cross-tenant reservations';
