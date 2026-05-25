-- =============================================================================
-- CLEANUP SCRIPT — Xoá toàn bộ accounting objects để chạy lại migrations sạch
-- ⚠️ CHỈ chạy nếu accounting core đang ở partial state (đã chạy migration cũ một phần)
-- ⚠️ AN TOÀN: chưa có dữ liệu thật trong các bảng này
-- =============================================================================

-- Drop views trước
DROP VIEW IF EXISTS public.outbox_health CASCADE;

-- Drop tables (CASCADE sẽ drop triggers + policies + indexes liên quan)
DROP TABLE IF EXISTS public.accounting_outbox CASCADE;
DROP TABLE IF EXISTS public.journal_lines CASCADE;
DROP TABLE IF EXISTS public.journal_entries CASCADE;
DROP TABLE IF EXISTS public.accounting_periods CASCADE;
DROP TABLE IF EXISTS public.accounting_accounts CASCADE;

-- Drop functions (CASCADE đề phòng còn dependencies)
DROP FUNCTION IF EXISTS public.check_journal_entry_modification() CASCADE;
DROP FUNCTION IF EXISTS public.validate_journal_entry_balance() CASCADE;
DROP FUNCTION IF EXISTS public.set_journal_entry_period() CASCADE;
DROP FUNCTION IF EXISTS public.ensure_open_period(UUID, DATE) CASCADE;
DROP FUNCTION IF EXISTS public.close_accounting_period(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.reopen_accounting_period(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.seed_default_coa(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.enqueue_accounting_event(UUID, TEXT, TEXT, UUID, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.claim_outbox_batch(INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.mark_outbox_completed(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.mark_outbox_failed(UUID, TEXT) CASCADE;

-- Verify
SELECT 'Cleanup done. Còn lại:' as status;
SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE '%accounting%' OR tablename LIKE 'journal_%';
SELECT proname FROM pg_proc WHERE proname IN (
    'check_journal_entry_modification','validate_journal_entry_balance','set_journal_entry_period',
    'ensure_open_period','close_accounting_period','reopen_accounting_period','seed_default_coa',
    'enqueue_accounting_event','claim_outbox_batch','mark_outbox_completed','mark_outbox_failed'
);
