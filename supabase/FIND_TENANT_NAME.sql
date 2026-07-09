-- Tìm tên chính xác của tenant
SELECT id, name, created_at 
FROM public.tenants 
ORDER BY created_at;
