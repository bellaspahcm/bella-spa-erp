-- Auto-fix: Assign first admin user to bella_auto_stress tenant
-- Run this in Supabase SQL Editor

DO $$
DECLARE
  v_bella_auto_tenant_id UUID;
  v_first_user_id UUID;
  v_user_email TEXT;
BEGIN
  -- Find bella_auto_stress tenant
  SELECT id INTO v_bella_auto_tenant_id
  FROM public.tenants
  WHERE name = 'bella_auto_stress';

  IF v_bella_auto_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Tenant bella_auto_stress not found. Run seed script first.';
  END IF;

  -- Find first user (assume it's the admin)
  SELECT u.id, u.email 
  INTO v_first_user_id, v_user_email
  FROM auth.users u
  ORDER BY u.created_at
  LIMIT 1;

  IF v_first_user_id IS NULL THEN
    RAISE EXCEPTION 'No users found in system.';
  END IF;

  -- Update or insert user profile
  INSERT INTO public.users (id, tenant_id, full_name, role, status)
  VALUES (
    v_first_user_id,
    v_bella_auto_tenant_id,
    COALESCE((SELECT full_name FROM public.users WHERE id = v_first_user_id), 'Admin'),
    'admin',
    'active'
  )
  ON CONFLICT (id) DO UPDATE
  SET tenant_id = EXCLUDED.tenant_id;

  RAISE NOTICE 'SUCCESS: User % assigned to bella_auto_stress', v_user_email;
  RAISE NOTICE 'Please logout and login again to see changes.';
END $$;

-- Verify
SELECT 
  u.email,
  t.name as tenant_name,
  (SELECT COUNT(*) FROM auto_vehicles WHERE tenant_id = p.tenant_id) as vehicle_count
FROM auth.users u
JOIN public.users p ON p.id = u.id
JOIN public.tenants t ON t.id = p.tenant_id
ORDER BY u.created_at
LIMIT 1;
