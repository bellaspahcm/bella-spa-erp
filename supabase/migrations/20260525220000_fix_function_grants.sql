-- =============================================================================
-- Hotfix: GRANT EXECUTE cho mọi accounting functions
-- Ngày: 2026-05-25
-- Lỗi gốc: PostgREST trả 42883 "function does not exist" khi role authenticated
--   không có EXECUTE permission. Supabase REVOKE default EXECUTE FROM PUBLIC
--   nên mọi function mới cần GRANT explicit.
-- Fix: GRANT EXECUTE cho authenticated + service_role + anon trên tất cả
--   accounting functions tạo từ Phase 26-29.
-- =============================================================================

GRANT EXECUTE ON FUNCTION public.get_reconciliation_report(UUID, DATE, DATE) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.get_consolidated_pnl(DATE, DATE) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.get_cash_flow_statement(UUID, DATE, DATE) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.preview_closing_entries(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.generate_closing_entries(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.close_accounting_period(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.reopen_accounting_period(UUID) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.acc_balance_at(UUID, TEXT, DATE) TO authenticated, service_role, anon;
GRANT EXECUTE ON FUNCTION public.ensure_open_period(UUID, DATE) TO authenticated, service_role, anon;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
