-- =====================================================
-- Create log_api_request RPC for Security-Definer Request Audit Logging
-- =====================================================
-- Description: Allows logging API requests with SECURITY DEFINER privileges to bypass RLS,
--              safely handles INET type casting without throwing 22P02,
--              and triggers total_requests_count increments reliably.
-- Date: 2026-07-30
-- =====================================================

CREATE OR REPLACE FUNCTION public.log_api_request(
  p_partner_id UUID,
  p_tenant_id UUID,
  p_method TEXT,
  p_endpoint TEXT,
  p_status_code INTEGER,
  p_response_time_ms INTEGER,
  p_is_error BOOLEAN DEFAULT FALSE,
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_log_id UUID;
  v_inet_ip INET := NULL;
BEGIN
  IF p_ip_address IS NOT NULL AND p_ip_address != '' AND p_ip_address != 'unknown' THEN
    BEGIN
      v_inet_ip := p_ip_address::INET;
    EXCEPTION WHEN OTHERS THEN
      v_inet_ip := NULL;
    END;
  END IF;

  INSERT INTO public.api_request_logs (
    partner_id,
    tenant_id,
    method,
    endpoint,
    status_code,
    response_time_ms,
    is_error,
    error_code,
    error_message,
    ip_address,
    user_agent,
    request_id
  ) VALUES (
    p_partner_id,
    p_tenant_id,
    p_method,
    p_endpoint,
    p_status_code,
    p_response_time_ms,
    p_is_error,
    p_error_code,
    p_error_message,
    v_inet_ip,
    p_user_agent,
    p_request_id
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

COMMENT ON FUNCTION public.log_api_request IS 'Audit log insertion with SECURITY DEFINER and safe INET casting';

-- Grant execute to anon and service_role
GRANT EXECUTE ON FUNCTION public.log_api_request TO anon, service_role;
