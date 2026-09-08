-- Quick constraint verification
DO $$
DECLARE
  v_tenant_id UUID;
  v_student_id UUID;
  v_customer1_id UUID;
  v_customer2_id UUID;
BEGIN
  -- Use existing tenant
  SELECT id INTO v_tenant_id FROM tenants LIMIT 1;
  
  -- Create test data
  INSERT INTO preschool_students (tenant_id, student_code, first_name, last_name, date_of_birth, status)
  VALUES (v_tenant_id, 'TEST-' || extract(epoch from now())::text, 'Test', 'Student', '2020-01-01', 'active')
  RETURNING id INTO v_student_id;
  
  INSERT INTO customers (tenant_id, name_mother, phone) 
  VALUES (v_tenant_id, 'Guardian One', '+1-555-0001') 
  RETURNING id INTO v_customer1_id;
  
  INSERT INTO customers (tenant_id, name_mother, phone) 
  VALUES (v_tenant_id, 'Guardian Two', '+1-555-0002') 
  RETURNING id INTO v_customer2_id;
  
  -- Add first primary (should succeed)
  INSERT INTO preschool_student_guardians (tenant_id, student_id, guardian_customer_id, relationship_type, is_primary_contact, is_authorized_pickup, is_emergency_contact)
  VALUES (v_tenant_id, v_student_id, v_customer1_id, 'parent', true, true, false);
  
  RAISE NOTICE '✅ First primary guardian added';
  
  -- Try duplicate primary (should FAIL with constraint violation)
  BEGIN
    INSERT INTO preschool_student_guardians (tenant_id, student_id, guardian_customer_id, relationship_type, is_primary_contact, is_authorized_pickup, is_emergency_contact)
    VALUES (v_tenant_id, v_student_id, v_customer2_id, 'parent', true, true, false);
    
    RAISE EXCEPTION '❌ CONSTRAINT FAILED: Duplicate primary was allowed';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE '✅ CONSTRAINT ENFORCED: DB rejected duplicate primary';
  END;
  
  -- Verify only one primary exists
  IF (SELECT COUNT(*) FROM preschool_student_guardians WHERE student_id = v_student_id AND is_primary_contact = true) = 1 THEN
    RAISE NOTICE '✅ VERIFIED: Exactly ONE primary guardian exists';
  ELSE
    RAISE EXCEPTION '❌ INVARIANT VIOLATED: Multiple primaries found';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '✅ PRIMARY GUARDIAN CONSTRAINT VERIFIED';
  RAISE NOTICE '═══════════════════════════════════════';
  
  -- Cleanup
  DELETE FROM preschool_student_guardians WHERE student_id = v_student_id;
  DELETE FROM preschool_students WHERE id = v_student_id;
  DELETE FROM customers WHERE id IN (v_customer1_id, v_customer2_id);
  
  RAISE NOTICE '✅ Test data cleaned up';
END $$;
