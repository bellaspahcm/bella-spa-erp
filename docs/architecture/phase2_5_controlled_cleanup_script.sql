-- =============================================================================
-- PHASE 2.5: CONTROLLED TEST DATA CLEANUP
-- Purpose: Delete 18 orphan F2 cash movements (test artifacts only)
-- Date: 2026-08-24
-- Status: APPROVED BY HUMAN ARCHITECT
-- 
-- SAFETY GATES PASSED:
-- ✅ No production/pilot tenants
-- ✅ No Spa bookings
-- ✅ No Spa revenue  
-- ✅ No other Finance transactions
-- ✅ Pattern matches test code exactly
-- ✅ NO business domain records exist
--
-- SCOPE: 18 orphan F2 movements only
-- 
-- NOTE: Uses session_replication_role = replica to bypass immutability trigger
-- (Same approach as f5_admin_cleanup_test_data RPC)
-- =============================================================================

-- Step 1: Record orphan details for audit trail BEFORE deletion
CREATE TEMP TABLE deleted_orphan_movements_audit AS
SELECT 
    fcm.id,
    fcm.tenant_id,
    fcm.bank_account_id,
    fcm.f1_transaction_id,
    fcm.source_type,
    fcm.source_id,
    fcm.amount_minor,
    fcm.currency,
    fcm.direction,
    fcm.recorded_at,
    fcm.effective_date,
    fcm.description,
    fcm.idempotency_key,
    NOW() as deleted_at,
    'PHASE_2.5_TEST_CLEANUP' as deletion_reason
FROM finance_cash_movements fcm
LEFT JOIN finance_transactions ft 
    ON fcm.f1_transaction_id = ft.id 
    AND fcm.tenant_id = ft.tenant_id
WHERE ft.id IS NULL;

-- Step 2: Verify exactly 18 records will be deleted
DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count FROM deleted_orphan_movements_audit;
    
    IF v_count != 18 THEN
        RAISE EXCEPTION 'SAFETY_CHECK_FAILED: Expected 18 orphans, found %', v_count;
    END IF;
    
    RAISE NOTICE 'Safety check passed: 18 orphan movements identified for deletion';
END $$;

-- Step 3: Bypass immutability trigger and DELETE 18 orphan F2 movements
DO $$
BEGIN
    -- Use session_replication_role = replica to bypass immutability triggers
    -- (Standard pattern for test cleanup in Supabase/Finance OS)
    SET session_replication_role = replica;
    
    -- Delete 18 orphan movements
    DELETE FROM finance_cash_movements fcm
    USING deleted_orphan_movements_audit audit
    WHERE fcm.id = audit.id;
    
    -- Reset replication role
    SET session_replication_role = DEFAULT;
    
    RAISE NOTICE 'Deleted 18 orphan F2 movements';
EXCEPTION WHEN OTHERS THEN
    -- Always reset replication role even on error
    SET session_replication_role = DEFAULT;
    RAISE;
END $$;

-- Step 4: Verify deletion
SELECT 
    'CLEANUP_COMPLETE' as status,
    (SELECT COUNT(*) FROM deleted_orphan_movements_audit) as records_deleted,
    (SELECT COUNT(*) FROM finance_cash_movements fcm
     LEFT JOIN finance_transactions ft 
        ON fcm.f1_transaction_id = ft.id 
        AND fcm.tenant_id = ft.tenant_id
     WHERE ft.id IS NULL) as remaining_orphans;

-- Step 5: Display deleted records for verification (first 10)
SELECT 
    'DELETED_RECORDS' as record_type,
    id,
    tenant_id,
    f1_transaction_id,
    source_id,
    amount_minor,
    deletion_reason
FROM deleted_orphan_movements_audit
ORDER BY recorded_at
LIMIT 10;

-- Note: Temp table deleted_orphan_movements_audit will persist for this session
-- and can be queried for audit purposes
