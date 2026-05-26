-- Migration: Thêm cột accounting_mode vào bảng tenants để hỗ trợ chế độ kế toán song song
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS accounting_mode TEXT DEFAULT 'SIMPLE' 
CHECK (accounting_mode IN ('SIMPLE', 'PROFESSIONAL'));

-- Cập nhật tất cả các tenant hiện tại về chế độ mặc định SIMPLE
UPDATE public.tenants 
SET accounting_mode = 'SIMPLE' 
WHERE accounting_mode IS NULL;

-- Cập nhật schema cache của PostgREST
NOTIFY pgrst, 'reload schema';
