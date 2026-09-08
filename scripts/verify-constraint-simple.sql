-- Simple SQL-based verification for primary guardian constraint
-- Run with: psql or Supabase SQL Editor

-- Setup: Create test data
DO $$
DECLARE
  v_tenant_id UUID;
  v_student_id UUID;
  v_customer1_id UUID;
  v_customer2_id UUID;
  v_guardian1_id UUID;
  v_error_caught BOOLEAN := FALSE;
BEGIN
  RAISE NOTICE '🔍 Verifying Primary Guardian Constraint...';
  RAISE NOTICE '';
  
  -- 1. Create test tenant
  RAISE NOTICE '1️⃣ Creating test tenant...';
  INSERT INTO tenants (name, status)
  VALUES ('Constraint Test ' || extract(epoch from now())::text, 'active')
  RETURNING id INTO v_tenant_id;
  RAISE NOTICE '✅ Tenant: %', v_tenant_id;
  RAISE NOTICE '';
  
  -- 2. Create test student
  RAISE NOTICE '2️⃣ Creating test student...';
  INSERT INTO preschool_students (tenant_id, student_code, first_name, last_name, date_of_birth, status)
  VALUES (v_tenant_id, 'TEST-' || extract(epoch from now())::text, 'Test', 'Student', '2020-01-01', 'active')
  RETURNING id INTO v_student_id;
  RAISE NOTICE '✅ Student: %', v_student_id;
  RAISE NOTICE '';
  
  -- 3. Create test customers
  RAISE NOTICE '3️⃣ Creating test customers...';
  INSERT INTO customers (tenant_id, name_mother, phone)
  VALUES (v_tenant_id, 'Guardian One', '+1-555-0001')
  RETURNING id INTO v_customer1_id;
  
  INSERT INTO customers (tenant_id, name_mother, phone)
  VALUES (v_tenant_id, 'Guardian Two', '+1-555-0002')
  RETURNING id INTO v_customer2_id;
  RAISE NOTICE '✅ Customer 1: %', v_customer1_id;
  RAISE NOTICE '✅ Customer 2: %', v_customer2_id;
  RAISE NOTICE '';
  
  -- 4. Add first primary guardian (should succeed)
  RAISE NOTICE '4️⃣ Adding first primary guardian...';
  INSERT INTO preschool_student_guardians (
    tenant_id, student_id, guardian_customer_id, 
    relationship_type, is_primary_contact, is_authorized_pickup, is_emergency_contact
  )
  VALUES (v_tenant_id, v_student_id, v_customer1_id, 'parent', true, true, false)
  RETURNING id INTO v_guardian1_id;
  RAISE NOTICE '✅ Guardian 1: %', v_guardian1_id;
  RAISE NOTICE '';
  
  -- 5. Try to add second primary (should FAIL)
  RAISE NOTICE '5️⃣ Attempting to add second primary guardian (should fail)...';
  BEGIN
    INSERT INTO preschool_student_guardians (
      tenant_id, student_id, guardian_customer_id, 
      relationship_type, is_primary_contact, is_authorized_pickup, is_emergency_contact
    )
    VALUES (v_tenant_id, v_student_id, v_customer2_id, 'parent', true, true, false);
    
    -- If we reach here, constraint FAILED to prevent duplicate
    RAISE EXCEPTION '❌ CONSTRAINT FAILED: Second primary guardian was allowed!';
  EXCEPTION
    WHEN unique_violation THEN
      v_error_caught := TRUE;
      RAISE NOTICE '✅ CONSTRAINT ENFORCED: Duplicate primary rejected';
      RAISE NOTICE '   Error: %', SQLERRM;
  END;
  RAISE NOTICE '';
  
  -- 6. Verify only one primary exists
  RAISE NOTICE '6️⃣ Verifying only one primary guardian exists...';
  IF (SELECT COUNT(*) FROM preschool_student_guardians 
      WHERE student_id = v_student_id AND is_primary_contact = true) = 1 THEN
    RAISE NOTICE '✅ VERIFIED: Exactly ONE primary guardian exists';
  ELSE
    RAISE EXCEPTION '❌ INVARIANT VIOLATED: Multiple primary guardians found';
  END IF;
  RAISE NOTICE '';
  
  -- 7. Unset first, add second (should succeed)
  RAISE NOTICE '7️⃣ Unsetting first primary, adding second...';
  UPDATE preschool_student_guardians
  SET is_primary_contact = false
  WHERE id = v_guardian1_id;
  
  INSERT INTO preschool_student_guardians (
    tenant_id, student_id, guardian_customer_id, 
    relationship_type, is_primary_contact, is_authorized_pickup, is_emergency_contact
  )
  VALUES (v_tenant_id, v_student_id, v_customer2_id, 'parent', true, true, false);
  RAISE NOTICE '✅ Second primary added successfully';
  RAISE NOTICE '';
  
  -- 8. Final verification
  RAISE NOTICE '8️⃣ Final verification...';
  IF (SELECT COUNT(*) FROM preschool_student_guardians 
      WHERE student_id = v_student_id AND is_primary_contact = true) = 1 THEN
    RAISE NOTICE '✅ FINAL VERIFICATION PASSED: Still only ONE primary';
  ELSE
    RAISE EXCEPTION '❌ FINAL VERIFICATION FAILED';
  END IF;
  RAISE NOTICE '';
  
  -- 9. Cleanup
  RAISE NOTICE '9️⃣ Cleaning up...';
  DELETE FROM preschool_student_guardians WHERE student_id = v_student_id;
  DELETE FROM preschool_students WHERE id = v_student_id;
  DELETE FROM customers WHERE tenant_id = v_tenant_id;
  DELETE FROM tenants WHERE id = v_tenant_id;
  RAISE NOTICE '✅ Cleanup complete';
  RAISE NOTICE '';
  
  -- Success summary
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '✅ PRIMARY GUARDIAN CONSTRAINT VERIFIED';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '';
  RAISE NOTICE '✅ Constraint prevents duplicate primary guardians';
  RAISE NOTICE '✅ Invariant enforced at DB level';
  RAISE NOTICE '✅ Application can safely rely on ONE primary per student';
  
END $$;
