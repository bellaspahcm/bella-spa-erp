-- ============================================================================
-- Gate 1 Test Data Seeding
-- Decision Engine Sprint 1 - Functional Validation
-- 
-- Creates test data for 6 Gate 1 scenarios:
-- 1.1: Leave Approval - Success Path
-- 1.2: Leave Rejection - Business Rule
-- 1.3: Audit Record Persisted
-- 1.4: Replay Works
-- 1.5: Trace Viewer Accessible
-- 1.6: Health Endpoint Operational
-- ============================================================================

-- Get staging tenant ID (assuming first tenant or create one)
DO $$
DECLARE
  v_tenant_id UUID;
  v_manager_id UUID;
  v_employee_high_balance_id UUID;
  v_employee_low_balance_id UUID;
  v_leave_req_success_id UUID;
  v_leave_req_reject_id UUID;
BEGIN
  -- 1. Get or create staging tenant
  SELECT id INTO v_tenant_id FROM tenants WHERE name = 'Bella Spa Staging' LIMIT 1;
  
  IF v_tenant_id IS NULL THEN
    INSERT INTO tenants (id, name, industry, status, created_at)
    VALUES (
      gen_random_uuid(),
      'Bella Spa Staging',
      'spa',
      'active',
      NOW()
    )
    RETURNING id INTO v_tenant_id;
    
    RAISE NOTICE 'Created staging tenant: %', v_tenant_id;
  ELSE
    RAISE NOTICE 'Using existing tenant: %', v_tenant_id;
  END IF;

  -- 2. Create test manager user
  INSERT INTO users (
    id,
    email,
    full_name,
    role,
    tenant_id,
    leave_balance,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    'manager-gate1@bellaspa.local',
    'Gate1 Test Manager',
    'manager',
    v_tenant_id,
    20,
    NOW()
  )
  ON CONFLICT (email) DO UPDATE
  SET full_name = EXCLUDED.full_name
  RETURNING id INTO v_manager_id;
  
  RAISE NOTICE 'Manager ID: %', v_manager_id;

  -- 3. Create employee with HIGH leave balance (for success scenario)
  INSERT INTO users (
    id,
    email,
    full_name,
    role,
    tenant_id,
    leave_balance,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    'employee-high-balance@bellaspa.local',
    'Employee High Balance',
    'employee',
    v_tenant_id,
    12, -- 12 days balance, will request 5 days
    NOW()
  )
  ON CONFLICT (email) DO UPDATE
  SET leave_balance = 12
  RETURNING id INTO v_employee_high_balance_id;
  
  RAISE NOTICE 'Employee (high balance) ID: %', v_employee_high_balance_id;

  -- 4. Create employee with LOW leave balance (for rejection scenario)
  INSERT INTO users (
    id,
    email,
    full_name,
    role,
    tenant_id,
    leave_balance,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    'employee-low-balance@bellaspa.local',
    'Employee Low Balance',
    'employee',
    v_tenant_id,
    3, -- Only 3 days balance, will request 5 days
    NOW()
  )
  ON CONFLICT (email) DO UPDATE
  SET leave_balance = 3
  RETURNING id INTO v_employee_low_balance_id;
  
  RAISE NOTICE 'Employee (low balance) ID: %', v_employee_low_balance_id;

  -- 5. Create leave request #1 - SUCCESS SCENARIO
  INSERT INTO leave_requests (
    id,
    employee_id,
    leave_type,
    start_date,
    end_date,
    days,
    reason,
    status,
    tenant_id,
    created_at
  )
  VALUES (
    'req-gate1-success',
    v_employee_high_balance_id,
    'annual',
    CURRENT_DATE + INTERVAL '7 days',
    CURRENT_DATE + INTERVAL '11 days',
    5, -- 5 days (within 12 days balance)
    'Family vacation - Gate 1 test',
    'pending',
    v_tenant_id,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET status = 'pending', days = 5
  RETURNING id INTO v_leave_req_success_id;
  
  RAISE NOTICE 'Leave request (success): %', v_leave_req_success_id;

  -- 6. Create leave request #2 - REJECTION SCENARIO
  INSERT INTO leave_requests (
    id,
    employee_id,
    leave_type,
    start_date,
    end_date,
    days,
    reason,
    status,
    tenant_id,
    created_at
  )
  VALUES (
    'req-gate1-reject',
    v_employee_low_balance_id,
    'annual',
    CURRENT_DATE + INTERVAL '14 days',
    CURRENT_DATE + INTERVAL '18 days',
    5, -- 5 days (exceeds 3 days balance)
    'Personal matter - Gate 1 test',
    'pending',
    v_tenant_id,
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
  SET status = 'pending', days = 5
  RETURNING id INTO v_leave_req_reject_id;
  
  RAISE NOTICE 'Leave request (reject): %', v_leave_req_reject_id;

  -- 7. Summary
  RAISE NOTICE '';
  RAISE NOTICE '✅ Gate 1 test data seeded successfully!';
  RAISE NOTICE '';
  RAISE NOTICE '📋 Test Entities:';
  RAISE NOTICE '   Tenant ID: %', v_tenant_id;
  RAISE NOTICE '   Manager: % (manager-gate1@bellaspa.local)', v_manager_id;
  RAISE NOTICE '   Employee (high): % (12 days balance)', v_employee_high_balance_id;
  RAISE NOTICE '   Employee (low): % (3 days balance)', v_employee_low_balance_id;
  RAISE NOTICE '   Leave Request (success): req-gate1-success';
  RAISE NOTICE '   Leave Request (reject): req-gate1-reject';
  RAISE NOTICE '';
  RAISE NOTICE '🧪 Ready for Gate 1 validation tests!';

END $$;
