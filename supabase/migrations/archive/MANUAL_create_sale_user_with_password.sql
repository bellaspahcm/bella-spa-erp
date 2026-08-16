-- ============================================================================
-- Create Sale Test User with Fixed Password
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/lvnvkpyxtuilhrabtlwv/sql/new
-- ============================================================================

-- ⚠️ IMPORTANT: Replace YOUR_TENANT_ID below with your actual tenant ID
-- To find your tenant_id, run: SELECT id, name FROM tenants WHERE status = 'active';

DO $$
DECLARE
  v_tenant_id UUID := 'YOUR_TENANT_ID'; -- ⚠️ CHANGE THIS LINE
  v_email TEXT := 'sale.test@bellaeip.com';
  v_password TEXT := 'BellaSale2026!';
  v_full_name TEXT := 'Nguyễn Văn Sale (Test)';
  v_auth_user_id UUID;
BEGIN
  -- Validate tenant exists
  IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = v_tenant_id) THEN
    RAISE EXCEPTION 'Tenant % does not exist. Please update v_tenant_id variable.', v_tenant_id;
  END IF;

  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE 'Creating Sale Test User';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

  -- Step 1: Check if email already exists
  SELECT id INTO v_auth_user_id
  FROM auth.users
  WHERE email = v_email;

  IF v_auth_user_id IS NOT NULL THEN
    RAISE NOTICE '⚠️  User already exists in auth.users';
    RAISE NOTICE '   Email: %', v_email;
    RAISE NOTICE '   Auth ID: %', v_auth_user_id;
    
    -- Update existing user
    UPDATE auth.users
    SET encrypted_password = crypt(v_password, gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = v_auth_user_id;
    
    RAISE NOTICE '✅ Updated password for existing user';
    
    -- Update public.users profile
    UPDATE public.users
    SET role = 'sale',
        status = 'active',
        tenant_id = v_tenant_id,
        full_name = v_full_name,
        updated_at = NOW()
    WHERE id = v_auth_user_id;
    
    IF NOT FOUND THEN
      -- Create profile if doesn't exist
      INSERT INTO public.users (
        id, email, full_name, role, status, tenant_id, created_at, updated_at
      ) VALUES (
        v_auth_user_id, v_email, v_full_name, 'sale', 'active', v_tenant_id, NOW(), NOW()
      );
      RAISE NOTICE '✅ Created public.users profile';
    ELSE
      RAISE NOTICE '✅ Updated public.users profile';
    END IF;
  ELSE
    -- Step 2: Create new auth user
    v_auth_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_auth_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(v_password, gen_salt('bf')),
      NOW(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('full_name', v_full_name),
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    );
    
    RAISE NOTICE '✅ Created auth.users (id: %)', v_auth_user_id;
    
    -- Step 3: Create identities record
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      v_auth_user_id,
      v_auth_user_id,
      v_auth_user_id,
      jsonb_build_object(
        'sub', v_auth_user_id::text,
        'email', v_email,
        'email_verified', true
      ),
      'email',
      NOW(),
      NOW(),
      NOW()
    );
    
    RAISE NOTICE '✅ Created auth.identities';
    
    -- Step 4: Create public.users profile
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
      v_auth_user_id,
      v_email,
      v_full_name,
      'sale',
      'active',
      v_tenant_id,
      NOW(),
      NOW()
    );
    
    RAISE NOTICE '✅ Created public.users profile';
  END IF;

  -- Output credentials
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '✅ SALE USER READY!';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
  RAISE NOTICE '';
  RAISE NOTICE '📧 Email:    %', v_email;
  RAISE NOTICE '🔑 Password: %', v_password;
  RAISE NOTICE '👤 Role:     sale';
  RAISE NOTICE '🏢 Tenant:   %', v_tenant_id;
  RAISE NOTICE '';
  RAISE NOTICE '🌐 Login URL:';
  RAISE NOTICE '   http://localhost:3000/login';
  RAISE NOTICE '';
  RAISE NOTICE '🚀 Workforce Portal:';
  RAISE NOTICE '   http://localhost:3000/workforce/dashboard';
  RAISE NOTICE '';
  RAISE NOTICE '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE '';
    RAISE NOTICE '❌ ERROR: %', SQLERRM;
    RAISE NOTICE '';
    RAISE NOTICE 'Common issues:';
    RAISE NOTICE '1. Did you update v_tenant_id variable?';
    RAISE NOTICE '   Run: SELECT id, name FROM tenants WHERE status = ''active'';';
    RAISE NOTICE '2. Check if you have permission to insert into auth schema';
    RAISE NOTICE '';
    RAISE;
END $$;
