-- ============================================================================
-- Create Test Sale User for Workforce Portal
-- MANUAL MIGRATION - Run in Supabase SQL Editor
-- ============================================================================

DO $$
DECLARE
  v_tenant_id UUID;
  v_user_id UUID := gen_random_uuid();
  v_email TEXT := 'sale.test@bellaeip.com';
  v_password TEXT := 'BellaSale2026!';
  v_full_name TEXT := 'Nguyễn Văn Sale (Test)';
BEGIN
  -- Get tenant_id (use first active tenant, or specify your tenant_id here)
  SELECT id INTO v_tenant_id
  FROM tenants
  WHERE status = 'active'
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No active tenant found. Please create a tenant first.';
  END IF;

  RAISE NOTICE 'Using tenant: %', v_tenant_id;
  RAISE NOTICE 'Creating sale user: %', v_email;

  -- Check if email already exists in auth.users
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE NOTICE 'Email % already exists in auth.users. Skipping creation.', v_email;
    
    -- Get existing user_id
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_email;
    
    -- Update public.users profile if exists
    UPDATE public.users
    SET role = 'sale',
        status = 'active',
        full_name = v_full_name,
        tenant_id = v_tenant_id,
        updated_at = NOW()
    WHERE email = v_email;
    
    RAISE NOTICE 'Updated existing user profile to role=sale';
  ELSE
    -- Create auth user with Supabase Auth Admin API
    -- Note: This requires service_role key to execute
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change,
      aud,
      role
    ) VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      v_email,
      crypt(v_password, gen_salt('bf')), -- Hash password with bcrypt
      NOW(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', v_full_name),
      NOW(),
      NOW(),
      '',
      '',
      '',
      '',
      'authenticated',
      'authenticated'
    );

    RAISE NOTICE 'Created auth user with id: %', v_user_id;

    -- Create public.users profile
    INSERT INTO public.users (
      id,
      email,
      full_name,
      role,
      status,
      tenant_id,
      created_at,
      updated_at
    ) VALUES (
      v_user_id,
      v_email,
      v_full_name,
      'sale',
      'active',
      v_tenant_id,
      NOW(),
      NOW()
    );

    RAISE NOTICE 'Created public.users profile';
  END IF;

  -- Output login credentials
  RAISE NOTICE '';
  RAISE NOTICE '✅ Sale user ready for testing!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'Email:    %', v_email;
  RAISE NOTICE 'Password: %', v_password;
  RAISE NOTICE 'Role:     sale';
  RAISE NOTICE 'Tenant:   %', v_tenant_id;
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE 'Login URL: http://localhost:3000/login';
  RAISE NOTICE 'Workforce Portal: http://localhost:3000/workforce/dashboard';
  RAISE NOTICE '';

END $$;
