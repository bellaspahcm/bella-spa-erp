-- Migration: Create get_user_by_email_v1 RPC function to safely retrieve user profile bypassing RLS for local bypass
-- This is critical for local development bypass so it doesn't get blocked by strict RLS policies.

CREATE OR REPLACE FUNCTION public.get_user_by_email_v1(p_email text)
RETURNS TABLE (
    id uuid,
    email text,
    full_name text,
    role text,
    status text,
    tenant_id uuid,
    created_at timestamptz,
    avatar_url text
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email, u.full_name, u.role, u.status, u.tenant_id, u.created_at, u.avatar_url
    FROM public.users u WHERE u.email = p_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
