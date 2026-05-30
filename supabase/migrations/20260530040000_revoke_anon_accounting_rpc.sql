-- =============================================================================
-- Security hardening: remove anonymous execution from accounting/reporting RPCs.
--
-- These functions expose financial reports or mutate accounting periods.
-- Application call sites use authenticated Supabase clients or service_role
-- server actions, so revoking anon does not change normal product flows.
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.get_reconciliation_report(UUID, DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_consolidated_pnl(DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_cash_flow_statement(UUID, DATE, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.preview_closing_entries(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_closing_entries(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.close_accounting_period(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reopen_accounting_period(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.acc_balance_at(UUID, TEXT, DATE) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_open_period(UUID, DATE) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_reconciliation_report(UUID, DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_consolidated_pnl(DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_cash_flow_statement(UUID, DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.preview_closing_entries(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_closing_entries(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.close_accounting_period(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reopen_accounting_period(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.acc_balance_at(UUID, TEXT, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_open_period(UUID, DATE) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
