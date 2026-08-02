-- ============================================================================
-- Create Sale Test User - SIMPLE VERSION (No people_directory)
-- Copy this entire file and run in Supabase SQL Editor
-- ============================================================================

-- ⚠️ STEP 1: Update YOUR_TENANT_ID below
-- Run this first to get your tenant_id:
--   SELECT id, name FROM tenants WHERE status = 'active';

DO $$
DECLARE
  v_tenant_id UUID := 'YOUR_TENANT_ID'; -- ⚠️ PASTE YOUR TENANT ID HERE
  v_email TEXT := 'sale.test@bellaeip.com';
  v_password TEXT := 'BellaSale2026!';
  v_full_name TEXT := 'Nguyễn Văn Sale (Test)';
  v_auth_user_id UUID;
BEGIN
  -- Validate tenant
  IF v_tenant_id = 'YOUR_TENANT_ID' THEN
    RAISE EXCEPTION 'Please update v_tenant_id variable first!';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = v_tenant_id) THEN
    RAISE EXCEPTION 'Tenant % not found', v_tenant_id;
  END IF;

  -- Check existing user
  SELECT id INTO v_auth_user_id FROM auth.users WHERE email = v_email;

  IF v_auth_user_id IS NOT NULL THEN
    RAISE NOTICE 'User already exists, updating...';
    
    -- Update password
    UPDATE auth.users
    SET encrypted_password = crypt(v_password, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE id = v_auth_user_id;
    
    -- Update profile
    UPDATE public.users
    SET role = 'sale', status = 'active', tenant_id = v_tenant_id
    WHERE id = v_auth_user_id;
  ELSE
    -- Create new user
    v_auth_user_id := gen_random_uuid();
    
    -- Insert auth.users
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000', v_auth_user_id,
      'authenticated', 'authenticated', v_email,
      crypt(v_password, gen_salt('bf')), NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', v_full_name),
      NOW(), NOW(), '', '', '', ''
    );
    
    -- Insert auth.identities
    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      v_auth_user_id, v_auth_user_id, v_auth_user_id,
      jsonb_build_object('sub', v_auth_user_id::text, 'email', v_email, 'email_verified', true),
      'email', NOW(), NOW(), NOW()
    );
    
    -- Insert public.users (NO people_directory)
    INSERT INTO public.users (
      id, email, full_name, role, status, tenant_id, created_at, updated_at
    ) VALUES (
      v_auth_user_id, v_email, v_full_name, 'sale', 'active',
      v_tenant_id, NOW(), NOW()
    );
  END IF;

  -- Success message
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ SALE USER CREATED!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📧 Email:    %', v_email;
  RAISE NOTICE '🔑 Password: %', v_password;
  RAISE NOTICE '👤 Role:     sale';
  RAISE NOTICE '';
  RAISE NOTICE '🌐 Login: http://localhost:3000/login';
  RAISE NOTICE '🚀 Portal: http://localhost:3000/workforce/dashboard';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
END $$;
