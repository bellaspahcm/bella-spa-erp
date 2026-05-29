-- =============================================================================
-- Migration: Add Checkout GPS to Session Logs
-- Ngày: 2026-05-30
-- Mục đích:
--   Thêm các cột checkout_lat và checkout_lon vào bảng session_logs để lưu tọa độ lúc KTV kết thúc ca.
-- =============================================================================

ALTER TABLE public.session_logs
  ADD COLUMN IF NOT EXISTS checkout_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS checkout_lon NUMERIC;

COMMENT ON COLUMN public.session_logs.checkout_lat IS 'Vĩ độ KTV check-out buổi chăm sóc.';
COMMENT ON COLUMN public.session_logs.checkout_lon IS 'Kinh độ KTV check-out buổi chăm sóc.';

NOTIFY pgrst, 'reload schema';
