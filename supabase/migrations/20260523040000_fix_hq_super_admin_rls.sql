-- Migration: Upgrade get_auth_tenant_id to support Super Admin (HQ Admin) bypass
-- When a user is an admin belonging to 'Bella Spa Headquarter', they bypass tenant isolation (returns NULL)

CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
DECLARE
    t_id UUID;
    t_name VARCHAR;
    u_role VARCHAR;
BEGIN
    -- Lấy tenant_id và role của user hiện tại từ public.users
    SELECT tenant_id, role INTO t_id, u_role FROM public.users WHERE id = auth.uid();
    
    -- Nếu user là admin thuộc chi nhánh 'Bella Spa Headquarter' (Trụ sở), cho phép họ quản lý hệ thống (bằng cách trả về NULL)
    IF t_id IS NOT NULL AND u_role = 'admin' THEN
        SELECT name INTO t_name FROM public.tenants WHERE id = t_id;
        IF t_name = 'Bella Spa Headquarter' THEN
            RETURN NULL;
        END IF;
    END IF;
    
    RETURN t_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
