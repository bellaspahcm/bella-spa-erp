-- ==========================================
-- BELLA SPA: SỬA LỖI TẠO LỊCH HẸN (BOOKINGS)
-- Ngày: 15/05/2026
-- Lý do: Bảng bookings thiếu cột ktv_commission, last_updated_date, is_in_care
--        gây lỗi PGRST204 "column not found in schema cache" khi tạo lịch hẹn mới.
-- ==========================================

-- 1. Thêm các cột còn thiếu vào bảng bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS ktv_commission BIGINT DEFAULT 150000,
  ADD COLUMN IF NOT EXISTS last_updated_date DATE,
  ADD COLUMN IF NOT EXISTS is_in_care BOOLEAN DEFAULT false;

-- 2. Cấp quyền đầy đủ cho bảng bookings
GRANT ALL ON public.bookings TO anon, authenticated;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;

-- 3. Cấp quyền cho session_logs (tạo session logs khi booking mới)
GRANT ALL ON public.session_logs TO anon, authenticated;
ALTER TABLE public.session_logs DISABLE ROW LEVEL SECURITY;

-- 4. Cấp quyền cho revenue (ghi nhận cọc khi tạo booking)
GRANT ALL ON public.revenue TO anon, authenticated;
ALTER TABLE public.revenue DISABLE ROW LEVEL SECURITY;
