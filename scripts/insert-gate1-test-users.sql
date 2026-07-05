-- ============================================================================
-- Insert Gate 1 Test Users
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Insert 3 test users for Gate 1 (Manager + 2 Employees)
INSERT INTO users (
  id, 
  email, 
  full_name, 
  role, 
  tenant_id, 
  leave_balance,
  created_at, 
  updated_at
)
VALUES 
  -- Manager
  (
    '23a9da64-a8c6-4250-8268-37c965e70fd7',
    'manager-gate1@bellaspa.local',
    'Gate1 Test Manager',
    'manager',
    '26c2d467-7c12-4e77-bb67-0e9e43fd7594', -- Bella Test tenant
    12,
    NOW(),
    NOW()
  ),
  -- Employee with high leave balance
  (
    'a3a4f261-506e-4fb7-bd38-d245a3a1fea7',
    'employee-high-balance@bellaspa.local',
    'Employee High Balance',
    'ktv',
    '26c2d467-7c12-4e77-bb67-0e9e43fd7594', -- Bella Test tenant
    12, -- Sufficient balance for 5-day request
    NOW(),
    NOW()
  ),
  -- Employee with low leave balance
  (
    'f3e5e94b-8683-4832-ad39-383c8804751c',
    'employee-low-balance@bellaspa.local',
    'Employee Low Balance',
    'ktv',
    '26c2d467-7c12-4e77-bb67-0e9e43fd7594', -- Bella Test tenant
    3, -- Insufficient balance for 5-day request (should be rejected)
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role,
  tenant_id = EXCLUDED.tenant_id,
  leave_balance = EXCLUDED.leave_balance,
  updated_at = NOW();

-- Verify
SELECT 
  id,
  email,
  full_name,
  role,
  leave_balance,
  tenant_id
FROM users
WHERE email LIKE '%gate1%' OR email LIKE '%balance%'
ORDER BY full_name;

-- Should return 3 rows:
-- 1. Employee High Balance (12 days)
-- 2. Employee Low Balance (3 days)
-- 3. Gate1 Test Manager (12 days)
