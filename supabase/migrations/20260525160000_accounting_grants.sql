-- =============================================================================
-- Migration: Accounting Core — Table Privileges Grant
-- Ngày: 2026-05-25
-- Mục đích:
--   Cấp quyền truy cập SELECT, INSERT, UPDATE, DELETE trên các bảng phân hệ kế toán mới
--   cho các vai trò người dùng đã xác thực (authenticated) để cho phép client-side 
--   SELECT hoạt động bình thường dưới cơ chế bảo mật Row-Level Security (RLS).
-- =============================================================================

-- 1. Cấp quyền truy cập bảng Kế toán Sổ cái
GRANT ALL ON public.accounting_accounts TO authenticated, service_role, postgres;
GRANT ALL ON public.journal_entries TO authenticated, service_role, postgres;
GRANT ALL ON public.journal_lines TO authenticated, service_role, postgres;
GRANT ALL ON public.accounting_periods TO authenticated, service_role, postgres;
GRANT ALL ON public.accounting_outbox TO authenticated, service_role, postgres;

-- 2. Cấp quyền trên các Sequences của schema public để tự động tăng ID khi INSERT
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role, postgres;
