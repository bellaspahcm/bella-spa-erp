-- Migration: finance_cash_engine_grants
-- Description: Enforces least-privilege boundary access controls on F2 Cash Engine tables and RPCs.
--
-- Constitution Reference: FINANCE-CONSTITUTION-001 §6 (Authorization), §3.1 (Core owns Authorization)
-- 
-- Authorization model:
--   - `authenticated` = Bella Core's authenticated user identity (read access to Finance data)
--   - `service_role`  = Bella Core's trusted infrastructure execution identity
--                       Used here as the execution identity for the F2 Projection Worker.
--                       This is NOT a Finance authorization framework — it is Core's execution boundary.
--                       Finance permission semantics (finance.cash.project) belong to Core Authorization.
--
-- Finance permissions defined in Constitution §6:
--   finance.cash.read      → authenticated SELECT on cash tables
--   finance.cash.project   → service_role EXECUTE on finance_internal_record_cash_movement
--   finance.bank.manage    → authenticated INSERT/UPDATE on finance_bank_accounts


-- =========================================================================
-- 1. REVOKE DEFAULT PUBLIC & AUTHENTICATED MUTATION PRIVILEGES
-- =========================================================================

-- Revoke direct table mutations on cash fact log and positions
REVOKE INSERT, UPDATE, DELETE ON public.finance_cash_movements FROM public, authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.finance_cash_positions FROM public, authenticated, anon;

-- Revoke direct table mutations on quarantine log
REVOKE INSERT, UPDATE, DELETE ON public.finance_cash_quarantine FROM public, authenticated, anon;

-- =========================================================================
-- 2. GRANT READ-ONLY (SELECT) PRIVILEGES TO AUTHENTICATED ROLES
-- =========================================================================
GRANT SELECT ON public.finance_cash_movements TO authenticated;
GRANT SELECT ON public.finance_cash_positions TO authenticated;
GRANT SELECT ON public.finance_cash_quarantine TO authenticated;

-- =========================================================================
-- 3. BANK ACCOUNT & TENANT CONFIG ACCESS (Standard authenticated management)
-- =========================================================================
GRANT SELECT, INSERT, UPDATE ON public.finance_bank_accounts TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.finance_tenant_configs TO authenticated;

-- =========================================================================
-- 4. RESTRICT TRUSTED PROJECTION RPC EXECUTION
-- =========================================================================

-- Revoke execution from public, authenticated, and anonymous roles
REVOKE EXECUTE ON FUNCTION public.finance_internal_record_cash_movement(
    UUID, UUID, VARCHAR, VARCHAR, NUMERIC, VARCHAR, NUMERIC, VARCHAR, NUMERIC, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT
) FROM public, authenticated, anon;

-- Grant execution strictly to the service_role (projection worker context)
GRANT EXECUTE ON FUNCTION public.finance_internal_record_cash_movement(
    UUID, UUID, VARCHAR, VARCHAR, NUMERIC, VARCHAR, NUMERIC, VARCHAR, NUMERIC, UUID, VARCHAR, VARCHAR, VARCHAR, TEXT
) TO service_role;

-- =========================================================================
-- 5. SERVICE_ROLE FULL ACCESS ASSURANCE
-- =========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_tenant_configs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_bank_accounts TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_cash_positions TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_cash_movements TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_cash_quarantine TO service_role;
