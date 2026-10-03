-- Migration: 20261001000001_restore_finance_f2_cash_positions_privilege_boundary
-- Component: Finance F2 Cash Engine privilege boundary restore
-- Purpose:
--   Restore the canonical F2 cash position direct-mutation boundary after broad
--   schema grants reintroduced table privileges for anon/authenticated.
--
-- Canonical contract:
--   - anon has no direct table access to finance_cash_positions.
--   - authenticated has read-only SELECT access.
--   - trusted write paths remain service_role / Finance RPC controlled.

REVOKE ALL ON public.finance_cash_positions FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.finance_cash_positions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_cash_positions TO service_role;

