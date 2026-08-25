-- =============================================================================
-- Finance OS Test Data Cleanup RPC
-- Created: 2026-08-24
-- Purpose: Phase 4.4 Test Data Cleanup (274 records)
-- 
-- SAFETY CONTROLS:
-- 1. Only callable by service_role (NOT authenticated/anon)
-- 2. Only deletes specific transaction IDs (NO wildcard deletes)
-- 3. Tenant-scoped validation
-- 4. Uses session_replication_role = replica to bypass immutability triggers
--    (same pattern as f5_admin_cleanup_test_data and Phase 2.5 cleanup)
-- 
-- USAGE:
--   SELECT finance_admin_cleanup_test_transactions(
--     ARRAY['uuid1', 'uuid2', ...],  -- exact transaction IDs
--     'tenant-id'                     -- tenant validation
--   );
-- =============================================================================

-- Drop existing version if exists
DROP FUNCTION IF EXISTS public.finance_admin_cleanup_test_transactions(UUID[], UUID);

CREATE OR REPLACE FUNCTION public.finance_admin_cleanup_test_transactions(
    p_transaction_ids UUID[],
    p_tenant_id       UUID
)
RETURNS TABLE (
    deleted_count     INTEGER,
    status            TEXT,
    message           TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_target_count  INTEGER := 0;
    v_tenant_check  INTEGER := 0;
BEGIN
    -- =========================================================================
    -- GATE 0: Authorization Check
    -- =========================================================================
    -- Only callable by service_role (test harness / admin scripts)
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'FINANCE_UNAUTHORIZED: finance_admin_cleanup_test_transactions is test-only'
            USING ERRCODE = 'F0001';
    END IF;

    -- =========================================================================
    -- GATE 1: Empty ID List Check
    -- =========================================================================
    IF p_transaction_ids IS NULL OR array_length(p_transaction_ids, 1) IS NULL THEN
        RETURN QUERY SELECT 0, 'ERROR'::TEXT, 'Empty transaction ID list'::TEXT;
        RETURN;
    END IF;

    v_target_count := array_length(p_transaction_ids, 1);

    -- =========================================================================
    -- GATE 2: Tenant Validation
    -- =========================================================================
    -- Verify all target transactions belong to specified tenant
    SELECT COUNT(*)
    INTO v_tenant_check
    FROM finance_transactions
    WHERE id = ANY(p_transaction_ids)
      AND tenant_id = p_tenant_id;

    IF v_tenant_check != v_target_count THEN
        RETURN QUERY SELECT 
            0, 
            'ERROR'::TEXT, 
            format('Tenant mismatch: %s/%s transactions belong to tenant %s', 
                   v_tenant_check, v_target_count, p_tenant_id)::TEXT;
        RETURN;
    END IF;

    -- =========================================================================
    -- GATE 3: Status Validation (POSTED only)
    -- =========================================================================
    -- Ensure we're only deleting POSTED transactions (test artifacts)
    -- DRAFT transactions should be canceled via normal API
    SELECT COUNT(*)
    INTO v_tenant_check
    FROM finance_transactions
    WHERE id = ANY(p_transaction_ids)
      AND status = 'POSTED';

    IF v_tenant_check != v_target_count THEN
        RETURN QUERY SELECT 
            0, 
            'ERROR'::TEXT, 
            format('Status validation failed: %s/%s are POSTED', 
                   v_tenant_check, v_target_count)::TEXT;
        RETURN;
    END IF;

    -- =========================================================================
    -- EXECUTION: Delete Test Transactions
    -- =========================================================================
    -- Use session_replication_role = replica to bypass immutability triggers
    -- This is the standard pattern for test cleanup (same as f5_admin_cleanup_test_data)
    SET session_replication_role = replica;

    BEGIN
        -- Delete finance_transactions (exact IDs only)
        DELETE FROM finance_transactions
        WHERE id = ANY(p_transaction_ids)
          AND tenant_id = p_tenant_id
          AND status = 'POSTED';

        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

        -- Reset replication role immediately after operation
        SET session_replication_role = DEFAULT;

        -- Verify deletion count matches target
        IF v_deleted_count != v_target_count THEN
            RETURN QUERY SELECT 
                v_deleted_count, 
                'WARNING'::TEXT, 
                format('Deleted %s/%s transactions (some may not exist)', 
                       v_deleted_count, v_target_count)::TEXT;
        ELSE
            RETURN QUERY SELECT 
                v_deleted_count, 
                'SUCCESS'::TEXT, 
                format('Successfully deleted %s test transactions', v_deleted_count)::TEXT;
        END IF;

    EXCEPTION
        WHEN OTHERS THEN
            -- Reset replication role on error
            SET session_replication_role = DEFAULT;
            
            RETURN QUERY SELECT 
                0, 
                'ERROR'::TEXT, 
                format('Deletion failed: %s', SQLERRM)::TEXT;
    END;

    RETURN;
END;
$$;

-- =============================================================================
-- Security: Only service_role can execute
-- =============================================================================
REVOKE ALL ON FUNCTION public.finance_admin_cleanup_test_transactions(UUID[], UUID) 
FROM PUBLIC, authenticated, anon;

GRANT EXECUTE ON FUNCTION public.finance_admin_cleanup_test_transactions(UUID[], UUID) 
TO service_role;

-- =============================================================================
-- Documentation
-- =============================================================================
COMMENT ON FUNCTION public.finance_admin_cleanup_test_transactions(UUID[], UUID) IS
    'Finance OS Test Infrastructure ONLY. Bypasses immutability triggers via session_replication_role = replica. '
    'SAFETY: Only accepts exact transaction IDs + tenant validation. '
    'USAGE: Phase 4.4 test data cleanup (274 test artifacts). '
    'MUST NOT be called in production workflows.';
