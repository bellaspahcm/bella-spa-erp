-- ==========================================
-- BELLA SPA: SỬA LỖI BẢNG PACKAGES VÀ BOOKINGS
-- Ngày: 15/05/2026
-- Lý do: Bảng packages tồn tại nhưng thiếu cột và thiếu quyền truy cập,
--        gây ra lỗi "permission denied" + "column does not exist" khi
--        thêm/sửa dịch vụ từ Dashboard.
-- ==========================================

-- 1. Thêm các cột còn thiếu vào bảng packages (đã tồn tại từ seed data)
ALTER TABLE public.packages 
  ADD COLUMN IF NOT EXISTS price BIGINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration TEXT DEFAULT '90 phút/buổi',
  ADD COLUMN IF NOT EXISTS details TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS ktv_commission BIGINT DEFAULT 150000,
  ADD COLUMN IF NOT EXISTS offer TEXT DEFAULT '';

-- Đồng bộ price từ full_price (cột cũ)
UPDATE public.packages SET price = full_price::BIGINT WHERE price = 0 OR price IS NULL;

-- Fix duration encoding
UPDATE public.packages SET duration = '90 phút/buổi' WHERE duration LIKE '90 ph%' OR duration = '90 min/session';

-- 2. Cấp quyền truy cập cho bảng packages
GRANT ALL ON public.packages TO anon, authenticated;
ALTER TABLE public.packages DISABLE ROW LEVEL SECURITY;

-- 3. Thêm cột còn thiếu vào bảng bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS package_name TEXT,
  ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC DEFAULT 0;

-- 4. Cấp quyền truy cập cho bảng bookings
GRANT ALL ON public.bookings TO anon, authenticated;
ALTER TABLE public.bookings DISABLE ROW LEVEL SECURITY;
