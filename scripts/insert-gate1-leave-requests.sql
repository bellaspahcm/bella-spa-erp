-- ============================================================================
-- Insert Gate 1 Test Leave Requests
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Insert success scenario request
INSERT INTO leave_requests (
  id, 
  employee_id, 
  leave_type, 
  start_date, 
  end_date, 
  days, 
  reason, 
  status, 
  tenant_id
)
VALUES (
  'req-gate1-success',
  'a3a4f261-506e-4fb7-bd38-d245a3a1fea7', -- Employee high balance
  'annual',
  CURRENT_DATE + INTERVAL '7 days',
  CURRENT_DATE + INTERVAL '11 days',
  5,
  'Family vacation - Gate 1 test',
  'pending',
  '26c2d467-7c12-4e77-bb67-0e9e43fd7594' -- Bella Test tenant
)
ON CONFLICT (id) DO UPDATE SET 
  status = 'pending',
  updated_at = NOW();

-- Insert rejection scenario request
INSERT INTO leave_requests (
  id, 
  employee_id, 
  leave_type, 
  start_date, 
  end_date, 
  days, 
  reason, 
  status, 
  tenant_id
)
VALUES (
  'req-gate1-reject',
  'f3e5e94b-8683-4832-ad39-383c8804751c', -- Employee low balance
  'annual',
  CURRENT_DATE + INTERVAL '14 days',
  CURRENT_DATE + INTERVAL '18 days',
  5,
  'Personal matter - Gate 1 test',
  'pending',
  '26c2d467-7c12-4e77-bb67-0e9e43fd7594' -- Bella Test tenant
)
ON CONFLICT (id) DO UPDATE SET 
  status = 'pending',
  updated_at = NOW();

-- Verify
SELECT 
  id,
  employee_id,
  leave_type,
  start_date,
  end_date,
  days,
  status
FROM leave_requests
WHERE id IN ('req-gate1-success', 'req-gate1-reject');
