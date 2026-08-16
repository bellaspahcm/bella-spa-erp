-- =========================================================================
-- Migration: 20260822000000_f5_test_cleanup_rpc
-- Component: F5 Test Infrastructure — Admin Cleanup RPC
-- Constitution: F5 v1.2-Final (read-only reference — this is test infra only)
-- =========================================================================
--
-- PURPOSE:
--   Provides a test-only RPC that bypasses immutability triggers to clean up
--   test data created during integration tests. Uses session_replication_role
--   = replica to bypass triggers (the standard Supabase test teardown pattern).
--
-- SECURITY:
--   - SECURITY DEFINER running as service_role
--   - Only callable by service_role (not authenticated/anon)
--   - Must NEVER be called in production workflows
--   - Tenants are identified by name prefix to prevent accidental production use
--
-- PARAMETERS:
--   p_tenant_ids  UUID[]   — Array of test tenant IDs to clean up
--   p_delete_master BOOL   — If true, delete the tenant rows themselves
-- =========================================================================

-- Drop existing version first to allow return type change if needed
DROP FUNCTION IF EXISTS public.f5_admin_cleanup_test_data(UUID[], BOOLEAN);

CREATE OR REPLACE FUNCTION public.f5_admin_cleanup_test_data(
    p_tenant_ids    UUID[],
    p_delete_master BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
    v_tenant_id UUID;
    v_deleted_results  INT := 0;
    v_deleted_cases    INT := 0;
    v_deleted_health   INT := 0;
    v_deleted_txlines  INT := 0;
    v_deleted_tx       INT := 0;
    v_deleted_facts    INT := 0;
    v_deleted_bills    INT := 0;
    v_deleted_tenants  INT := 0;
BEGIN
    -- Only callable by service_role (test harness)
    IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
        RAISE EXCEPTION 'F5_UNAUTHORIZED: f5_admin_cleanup_test_data is test-only'
            USING ERRCODE = 'F5001';
    END IF;

    IF p_tenant_ids IS NULL OR array_length(p_tenant_ids, 1) IS NULL THEN
        RETURN jsonb_build_object('success', TRUE, 'message', 'No tenant_ids provided, nothing to clean');
    END IF;

    -- Safety guard: only clean tenants whose names start with 'Test Tenant F5'
    -- This prevents accidental cleanup of non-test tenants
    FOREACH v_tenant_id IN ARRAY p_tenant_ids LOOP
        IF NOT EXISTS (
            SELECT 1 FROM public.tenants
            WHERE id = v_tenant_id
              AND name LIKE 'Test Tenant F5%'
        ) THEN
            RAISE EXCEPTION 'F5_SAFETY_GUARD: Tenant % is not a test tenant (name must start with "Test Tenant F5")',
                v_tenant_id USING ERRCODE = 'F5090';
        END IF;
    END LOOP;

    -- Use session_replication_role = replica to bypass immutability triggers
    -- This is the standard pattern for test teardown in Supabase
    SET session_replication_role = replica;

    BEGIN
        -- 1. Unlink cases from results first (FK constraint)
        UPDATE public.f5_control_results
        SET case_id = NULL
        WHERE tenant_id = ANY(p_tenant_ids);

        -- 2. Delete f5_control_cases
        DELETE FROM public.f5_control_cases
        WHERE tenant_id = ANY(p_tenant_ids);
        GET DIAGNOSTICS v_deleted_cases = ROW_COUNT;

        -- 3. Delete f5_control_results (bypasses immutability trigger via replica role)
        DELETE FROM public.f5_control_results
        WHERE tenant_id = ANY(p_tenant_ids);
        GET DIAGNOSTICS v_deleted_results = ROW_COUNT;

        -- 4. Delete f5_projection_health
        DELETE FROM public.f5_projection_health
        WHERE tenant_id = ANY(p_tenant_ids);
        GET DIAGNOSTICS v_deleted_health = ROW_COUNT;

        IF p_delete_master THEN
            -- 5. Delete F4 AP facts (finance_payable_ledger)
            DELETE FROM public.finance_payable_ledger
            WHERE tenant_id = ANY(p_tenant_ids);
            GET DIAGNOSTICS v_deleted_facts = ROW_COUNT;

            -- 6. Delete vendor bills
            DELETE FROM public.finance_vendor_bills
            WHERE tenant_id = ANY(p_tenant_ids);
            GET DIAGNOSTICS v_deleted_bills = ROW_COUNT;

            -- 7. Delete transaction lines
            DELETE FROM public.finance_transaction_lines
            WHERE tenant_id = ANY(p_tenant_ids);
            GET DIAGNOSTICS v_deleted_txlines = ROW_COUNT;

            -- 8. Delete transactions
            DELETE FROM public.finance_transactions
            WHERE tenant_id = ANY(p_tenant_ids);
            GET DIAGNOSTICS v_deleted_tx = ROW_COUNT;

            -- 9. Delete accounting periods, accounts
            DELETE FROM public.finance_accounting_periods WHERE tenant_id = ANY(p_tenant_ids);
            DELETE FROM public.finance_accounts           WHERE tenant_id = ANY(p_tenant_ids);

            -- 10. Delete tenant rows themselves
            DELETE FROM public.tenants
            WHERE id = ANY(p_tenant_ids)
              AND name LIKE 'Test Tenant F5%';
            GET DIAGNOSTICS v_deleted_tenants = ROW_COUNT;
        END IF;

    EXCEPTION WHEN OTHERS THEN
        -- Always reset replication role even on error
        SET session_replication_role = DEFAULT;
        RAISE;
    END;

    -- Always reset replication role
    SET session_replication_role = DEFAULT;

    RETURN jsonb_build_object(
        'success',          TRUE,
        'deleted_results',  v_deleted_results,
        'deleted_cases',    v_deleted_cases,
        'deleted_health',   v_deleted_health,
        'deleted_facts',    v_deleted_facts,
        'deleted_bills',    v_deleted_bills,
        'deleted_txlines',  v_deleted_txlines,
        'deleted_tx',       v_deleted_tx,
        'deleted_tenants',  v_deleted_tenants
    );
END;
$$;

-- Only service_role can call this — never authenticated/anon
REVOKE ALL ON FUNCTION public.f5_admin_cleanup_test_data(UUID[], BOOLEAN) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.f5_admin_cleanup_test_data(UUID[], BOOLEAN) TO service_role;

COMMENT ON FUNCTION public.f5_admin_cleanup_test_data(UUID[], BOOLEAN) IS
    'F5 Test Infrastructure ONLY. Bypasses immutability triggers via session_replication_role = replica. '
    'Safety guard: only cleans tenants named "Test Tenant F5*". '
    'MUST NOT be called in production workflows.';
