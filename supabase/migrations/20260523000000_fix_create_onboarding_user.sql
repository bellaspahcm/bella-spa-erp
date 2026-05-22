-- Migration: Fix create_onboarding_user by removing generated columns (confirmed_at and email) from insert statement

CREATE OR REPLACE FUNCTION public.create_onboarding_user(p_email text, p_password text, p_full_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_user_id UUID;
  v_encrypted_password TEXT;
BEGIN
  -- Check if user already exists
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email;
  IF v_user_id IS NOT NULL THEN
    RETURN v_user_id;
  END IF;

  -- Generate user ID
  v_user_id := gen_random_uuid();
  
  -- Encrypt password with bcrypt
  v_encrypted_password := crypt(p_password, gen_salt('bf', 10));

  -- Insert into auth.users (excluding confirmed_at which is is_generated ALWAYS)
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
    updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid,
    v_user_id,
    'authenticated',
    'authenticated',
    p_email,
    v_encrypted_password,
    NOW(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'email_verified', true),
    NOW(),
    NOW()
  );

  -- Insert into auth.identities (excluding email which is is_generated ALWAYS)
  INSERT INTO auth.identities (
    id,
    provider_id,
    user_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    v_user_id::text,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', p_email, 'email_verified', true, 'phone_verified', false),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  RETURN v_user_id;
END;
$function$;
