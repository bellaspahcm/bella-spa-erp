-- Migration to fix table privileges on staff_leaves for authenticated, anonymous, and service_role API roles
-- Resolves "permission denied for table staff_leaves" error on client-side requests
GRANT ALL ON TABLE public.staff_leaves TO anon, authenticated, service_role;
