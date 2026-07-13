-- Migration: Optimize RLS evaluation speed using Custom Claims inside JWT (app_metadata)
-- Date: 2026-07-13

-- 1. Create a trigger function to sync role and tenant_id from public.users to auth.users.raw_app_meta_data
CREATE OR REPLACE FUNCTION public.sync_user_claims_to_auth()
RETURNS trigger AS $$
BEGIN
  UPDATE auth.users
  SET raw_app_meta_data =
    coalesce(raw_app_meta_data, '{}'::jsonb) ||
    jsonb_build_object(
      'role', NEW.role,
      'tenant_id', NEW.tenant_id
    )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind the trigger to public.users table
DROP TRIGGER IF EXISTS tr_sync_user_claims ON public.users;
CREATE TRIGGER tr_sync_user_claims
AFTER INSERT OR UPDATE OF role, tenant_id ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_claims_to_auth();

-- 3. Backfill existing claims for all current users
UPDATE auth.users u
SET raw_app_meta_data =
  coalesce(u.raw_app_meta_data, '{}'::jsonb) ||
  jsonb_build_object(
    'role', p.role,
    'tenant_id', p.tenant_id
  )
FROM public.users p
WHERE u.id = p.id;

-- 4. Optimize public.get_auth_tenant_id() to read from JWT app_metadata first
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
DECLARE
    t_id UUID;
    t_name VARCHAR;
    u_role VARCHAR;
    jwt_tenant_id TEXT;
    jwt_role TEXT;
BEGIN
    -- Thử lấy tenant_id và role từ JWT app_metadata (0ms)
    jwt_tenant_id := auth.jwt() -> 'app_metadata' ->> 'tenant_id';
    jwt_role := auth.jwt() -> 'app_metadata' ->> 'role';

    IF jwt_tenant_id IS NOT NULL AND jwt_role IS NOT NULL THEN
        t_id := jwt_tenant_id::UUID;
        u_role := jwt_role;
    ELSE
        -- Dự phòng nếu JWT chưa được cập nhật claims
        SELECT tenant_id, role INTO t_id, u_role FROM public.users WHERE id = auth.uid();
    END IF;

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

-- 5. Optimize public.is_admin() to read from JWT app_metadata first
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
DECLARE
    jwt_role TEXT;
    user_role VARCHAR;
BEGIN
    jwt_role := auth.jwt() -> 'app_metadata' ->> 'role';
    IF jwt_role IS NOT NULL THEN
        RETURN jwt_role = 'admin';
    END IF;

    SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
    RETURN COALESCE(user_role = 'admin', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Optimize public.is_hr() to read from JWT app_metadata first
CREATE OR REPLACE FUNCTION public.is_hr()
RETURNS BOOLEAN AS $$
DECLARE
    jwt_role TEXT;
    user_role VARCHAR;
BEGIN
    jwt_role := auth.jwt() -> 'app_metadata' ->> 'role';
    IF jwt_role IS NOT NULL THEN
        RETURN jwt_role = 'hr';
    END IF;

    SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
    RETURN COALESCE(user_role = 'hr', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Optimize public.is_accountant() to read from JWT app_metadata first
CREATE OR REPLACE FUNCTION public.is_accountant()
RETURNS BOOLEAN AS $$
DECLARE
    jwt_role TEXT;
    user_role VARCHAR;
BEGIN
    jwt_role := auth.jwt() -> 'app_metadata' ->> 'role';
    IF jwt_role IS NOT NULL THEN
        RETURN jwt_role = 'accountant';
    END IF;

    SELECT role INTO user_role FROM public.users WHERE id = auth.uid();
    RETURN COALESCE(user_role = 'accountant', false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notify schema reload
NOTIFY pgrst, 'reload schema';
