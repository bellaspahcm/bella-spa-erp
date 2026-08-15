-- Migration: finance_service_role_grants
-- Description: Grants service_role access to Finance OS Kernel tables.
--   Required for:
--   - OutboxDispatcher (background worker running under service_role)
--   - LedgerEngineService integration tests
--   - Internal Finance RPC functions
-- 
-- NOTE: service_role bypasses RLS by default in Supabase, but explicit GRANTS
--       are required to read/write tables from service_role in some configurations.

-- =========================================================================
-- 1. TABLE GRANTS
-- =========================================================================

-- Finance Accounting Periods
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_accounting_periods TO service_role;

-- Chart of Accounts
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_accounts TO service_role;

-- Financial Transactions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_transactions TO service_role;

-- Transaction Lines
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_transaction_lines TO service_role;

-- Outbox Events
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_outbox_events TO service_role;

-- Audit Trail
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_audit_trail TO service_role;

-- =========================================================================
-- 2. RPC FUNCTION GRANTS
-- =========================================================================

-- Allow service_role to call the Finance Ledger RPCs
GRANT EXECUTE ON FUNCTION public.finance_post_transaction(
  UUID, VARCHAR, VARCHAR, VARCHAR, VARCHAR, VARCHAR, TIMESTAMPTZ,
  VARCHAR, VARCHAR, NUMERIC, VARCHAR, VARCHAR, TIMESTAMPTZ,
  TEXT, VARCHAR, VARCHAR, JSONB
) TO service_role;

GRANT EXECUTE ON FUNCTION public.finance_reverse_transaction(
  UUID, UUID, VARCHAR, TEXT, TIMESTAMPTZ
) TO service_role;

-- =========================================================================
-- 3. SEQUENCE GRANTS (for UUID generation if needed)
-- =========================================================================
-- Note: gen_random_uuid() is a built-in PG function, no sequence needed.
-- Included as documentation that we rely on gen_random_uuid() not serial.
