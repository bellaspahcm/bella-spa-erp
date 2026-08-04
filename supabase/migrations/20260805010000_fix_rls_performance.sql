-- ============================================================================
-- Fix: RLS Performance & Statement Timeout
-- Date: 2026-08-05
-- Root cause: get_auth_tenant_id() là VOLATILE → PostgreSQL gọi lại mỗi row
--             → với 1000+ xe = 1000 lần gọi function → timeout 8s
-- ============================================================================

-- Fix 1: Đổi get_auth_tenant_id() từ VOLATILE sang STABLE
-- STABLE = PostgreSQL cache kết quả trong suốt 1 query (gọi 1 lần duy nhất)
-- Điều này an toàn vì hàm chỉ đọc auth.jwt() và public.users — không thay đổi
ALTER FUNCTION get_auth_tenant_id() STABLE;

-- Fix 2: Tăng statement_timeout cho authenticated role
-- Từ 8s mặc định lên 30s để analytics dashboard có đủ thời gian
ALTER ROLE authenticated SET statement_timeout = '30s';
