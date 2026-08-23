-- Migration: Fix is_in_care flag for completed bookings
-- Date: 2026-08-23
-- Bug: Bookings with status='completed' still have is_in_care=true
-- Impact: Customer cards show "Đang có gói liệu trình" badge incorrectly
-- Fix: Set is_in_care=false for all completed bookings

-- Preview affected records
SELECT 
  id,
  tenant_id,
  customer_id,
  package_name,
  status,
  completed_sessions,
  total_sessions,
  is_in_care,
  created_at
FROM bookings
WHERE status = 'completed'
  AND is_in_care = true;

-- Update completed bookings to clear is_in_care flag
UPDATE bookings
SET 
  is_in_care = false,
  updated_at = NOW()
WHERE status = 'completed'
  AND is_in_care = true;

-- Verify fix
SELECT 
  COUNT(*) as total_fixed,
  tenant_id
FROM bookings
WHERE status = 'completed'
  AND is_in_care = false
GROUP BY tenant_id;

-- Also fix bookings where completed_sessions >= total_sessions but status not updated
UPDATE bookings
SET 
  status = 'completed',
  is_in_care = false,
  updated_at = NOW()
WHERE completed_sessions >= total_sessions
  AND total_sessions > 0
  AND status != 'completed'
  AND status != 'cancelled';

-- Final verification
SELECT 
  status,
  is_in_care,
  COUNT(*) as count
FROM bookings
WHERE status IN ('completed', 'in_progress')
GROUP BY status, is_in_care
ORDER BY status, is_in_care;
