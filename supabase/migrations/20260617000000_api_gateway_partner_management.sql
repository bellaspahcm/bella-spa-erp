-- =====================================================
-- API Gateway Phase 1: Partner Management System
-- =====================================================
-- Description: Create tables for API partner management, authentication,
--              request logging, and scope-based access control
-- Date: 2026-06-17
-- Author: Kiro AI Agent
-- Phase: API Gateway Phase 1 - Week 1
-- =====================================================

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for gen_random_bytes function
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- 1. API PARTNERS TABLE
-- =====================================================
-- Purpose: Store API partners/integrations with authentication credentials
-- Security: tenant-scoped, RLS enabled
-- Relationships: Each partner belongs to ONE tenant

CREATE TABLE IF NOT EXISTS public.api_partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Partner Identity
  partner_name VARCHAR(255) NOT NULL,
  partner_type VARCHAR(50) NOT NULL CHECK (
    partner_type IN ('pos', 'payment', 'invoice', 'franchise', 'hr', 'analytics', 'mobile_app', 'other')
  ),
  partner_description TEXT,
  contact_email VARCHAR(255),
  contact_phone VARCHAR(50),
  
  -- API Authentication
  api_key VARCHAR(255) UNIQUE NOT NULL,
  api_secret VARCHAR(255), -- For HMAC signing (optional, encrypted at app level)
  
  -- Webhook Configuration (for outbound events)
  webhook_url TEXT,
  webhook_secret VARCHAR(255), -- For webhook signature verification
  webhook_events TEXT[], -- Array of subscribed events: ['order.created', 'payment.received']
  
  -- Access Control & Scopes
  allowed_scopes TEXT[] NOT NULL DEFAULT '{}', -- ['order:read', 'payment:write', etc.]
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  is_sandbox BOOLEAN NOT NULL DEFAULT FALSE, -- Sandbox mode for testing
  
  -- Rate Limiting Configuration
  rate_limit_tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (
    rate_limit_tier IN ('free', 'basic', 'pro', 'enterprise', 'unlimited')
  ),
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 100,
  rate_limit_per_day INTEGER NOT NULL DEFAULT 5000,
  rate_limit_burst INTEGER NOT NULL DEFAULT 200, -- Burst allowance (legacy, use tier instead)
  
  -- Usage Statistics
  last_request_at TIMESTAMP WITH TIME ZONE,
  total_requests_count BIGINT NOT NULL DEFAULT 0,
  failed_requests_count BIGINT NOT NULL DEFAULT 0,
  last_error_at TIMESTAMP WITH TIME ZONE,
  last_error_message TEXT,
  
  -- Metadata & Audit
  metadata JSONB DEFAULT '{}', -- Custom partner-specific data
  notes TEXT, -- Admin notes about this partner
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  CONSTRAINT api_partners_rate_limits_positive CHECK (
    rate_limit_per_minute > 0 AND 
    rate_limit_per_day > 0 AND 
    rate_limit_burst > 0
  )
);

-- Indexes for api_partners
CREATE INDEX idx_api_partners_tenant_id ON public.api_partners(tenant_id);
CREATE INDEX idx_api_partners_api_key ON public.api_partners(api_key) WHERE is_active = TRUE;
CREATE INDEX idx_api_partners_is_active ON public.api_partners(is_active);
CREATE INDEX idx_api_partners_partner_type ON public.api_partners(partner_type);
CREATE INDEX idx_api_partners_is_sandbox ON public.api_partners(is_sandbox);

-- Comments
COMMENT ON TABLE public.api_partners IS 'API partners/integrations with authentication and access control';
COMMENT ON COLUMN public.api_partners.api_key IS 'API key for authentication (format: pk_live_... or pk_test_...)';
COMMENT ON COLUMN public.api_partners.allowed_scopes IS 'Array of permission scopes (e.g., order:read, payment:write)';
COMMENT ON COLUMN public.api_partners.is_sandbox IS 'TRUE for test/sandbox partners (no real transactions)';
COMMENT ON COLUMN public.api_partners.webhook_events IS 'Array of event types this partner subscribes to';


-- =====================================================
-- 2. API REQUEST LOGS TABLE
-- =====================================================
-- Purpose: Audit trail of all API requests for monitoring, debugging, compliance
-- Security: tenant-scoped, RLS enabled, time-series partitioning recommended for production
-- Retention: Recommend 90 days for detailed logs, 1 year for aggregated stats

CREATE TABLE IF NOT EXISTS public.api_request_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.api_partners(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Request Information
  method VARCHAR(10) NOT NULL CHECK (method IN ('GET', 'POST', 'PUT', 'PATCH', 'DELETE')),
  endpoint TEXT NOT NULL,
  request_body JSONB,
  request_headers JSONB,
  query_params JSONB,
  
  -- Response Information
  status_code INTEGER NOT NULL,
  response_body JSONB,
  response_time_ms INTEGER NOT NULL, -- Response time in milliseconds
  
  -- Error Tracking
  is_error BOOLEAN NOT NULL DEFAULT FALSE,
  error_message TEXT,
  error_code VARCHAR(50),
  error_stack TEXT, -- Stack trace for debugging (optional)
  
  -- Security & Audit
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(255), -- Unique request ID for tracing
  idempotency_key VARCHAR(255), -- For idempotent operations
  
  -- Rate Limiting Context
  rate_limit_remaining INTEGER,
  rate_limit_reset_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for api_request_logs (time-series optimized)
CREATE INDEX idx_api_request_logs_partner_id ON public.api_request_logs(partner_id);
CREATE INDEX idx_api_request_logs_tenant_id ON public.api_request_logs(tenant_id);
CREATE INDEX idx_api_request_logs_created_at ON public.api_request_logs(created_at DESC);
CREATE INDEX idx_api_request_logs_endpoint ON public.api_request_logs(endpoint);
CREATE INDEX idx_api_request_logs_is_error ON public.api_request_logs(is_error) WHERE is_error = TRUE;
CREATE INDEX idx_api_request_logs_status_code ON public.api_request_logs(status_code);
CREATE INDEX idx_api_request_logs_request_id ON public.api_request_logs(request_id);

-- Composite indexes for common queries
CREATE INDEX idx_api_request_logs_partner_created ON public.api_request_logs(partner_id, created_at DESC);
CREATE INDEX idx_api_request_logs_tenant_created ON public.api_request_logs(tenant_id, created_at DESC);

-- Comments
COMMENT ON TABLE public.api_request_logs IS 'Audit trail of all API requests for monitoring and compliance';
COMMENT ON COLUMN public.api_request_logs.response_time_ms IS 'Response time in milliseconds for performance monitoring';
COMMENT ON COLUMN public.api_request_logs.idempotency_key IS 'Idempotency key for preventing duplicate operations';
COMMENT ON COLUMN public.api_request_logs.request_id IS 'Unique request ID for distributed tracing';

-- =====================================================
-- 3. API RATE LIMIT COUNTERS TABLE
-- =====================================================
-- Purpose: Track rate limit consumption per partner (Redis alternative for basic use)
-- Note: For production, Redis is recommended for better performance
-- This table serves as fallback or for persistent rate limit tracking

CREATE TABLE IF NOT EXISTS public.api_rate_limit_counters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.api_partners(id) ON DELETE CASCADE,
  
  -- Time Window
  window_start TIMESTAMP WITH TIME ZONE NOT NULL,
  window_type VARCHAR(20) NOT NULL CHECK (window_type IN ('minute', 'hour', 'day')),
  
  -- Counters
  request_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Unique constraint: one counter per partner per window
  UNIQUE(partner_id, window_start, window_type)
);

-- Indexes for api_rate_limit_counters
CREATE INDEX idx_api_rate_limit_counters_partner_id ON public.api_rate_limit_counters(partner_id);
CREATE INDEX idx_api_rate_limit_counters_window_start ON public.api_rate_limit_counters(window_start);

-- Comments
COMMENT ON TABLE public.api_rate_limit_counters IS 'Rate limit tracking per partner (use Redis in production for better performance)';


-- =====================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================
-- Critical: Enforce tenant isolation at database level

-- Enable RLS on all tables
ALTER TABLE public.api_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_request_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_rate_limit_counters ENABLE ROW LEVEL SECURITY;

-- ----------------
-- api_partners RLS
-- ----------------

-- Admin/Super Admin: Full access to their tenant's partners
CREATE POLICY api_partners_tenant_admin_access ON public.api_partners
  FOR ALL
  USING (
    tenant_id IN (
      SELECT t.id FROM public.tenants t
      INNER JOIN public.users u ON u.tenant_id = t.id
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    tenant_id IN (
      SELECT t.id FROM public.tenants t
      INNER JOIN public.users u ON u.tenant_id = t.id
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'super_admin')
    )
  );

-- Service role: Full access (for backend operations)
CREATE POLICY api_partners_service_role_access ON public.api_partners
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ----------------
-- api_request_logs RLS
-- ----------------

-- Admin/Super Admin: Read access to their tenant's logs
CREATE POLICY api_request_logs_tenant_admin_read ON public.api_request_logs
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT t.id FROM public.tenants t
      INNER JOIN public.users u ON u.tenant_id = t.id
      WHERE u.id = auth.uid()
      AND u.role IN ('admin', 'super_admin')
    )
  );

-- Service role: Full access (for logging)
CREATE POLICY api_request_logs_service_role_access ON public.api_request_logs
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- ----------------
-- api_rate_limit_counters RLS
-- ----------------

-- Service role only: Rate limiting is backend-only
CREATE POLICY api_rate_limit_counters_service_role_access ON public.api_rate_limit_counters
  FOR ALL
  TO service_role
  USING (TRUE)
  WITH CHECK (TRUE);

-- =====================================================
-- 5. TRIGGERS
-- =====================================================

-- Updated_at trigger for api_partners
CREATE OR REPLACE FUNCTION update_api_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_api_partners_updated_at
  BEFORE UPDATE ON public.api_partners
  FOR EACH ROW
  EXECUTE FUNCTION update_api_partners_updated_at();

-- Auto-increment stats on api_partners when request log created
CREATE OR REPLACE FUNCTION increment_api_partner_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.api_partners
  SET 
    total_requests_count = total_requests_count + 1,
    failed_requests_count = CASE WHEN NEW.is_error THEN failed_requests_count + 1 ELSE failed_requests_count END,
    last_request_at = NEW.created_at,
    last_error_at = CASE WHEN NEW.is_error THEN NEW.created_at ELSE last_error_at END,
    last_error_message = CASE WHEN NEW.is_error THEN NEW.error_message ELSE last_error_message END
  WHERE id = NEW.partner_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_increment_api_partner_stats
  AFTER INSERT ON public.api_request_logs
  FOR EACH ROW
  EXECUTE FUNCTION increment_api_partner_stats();

-- =====================================================
-- 6. HELPER FUNCTIONS
-- =====================================================

-- Function: Generate API key with proper format
-- Format: pk_live_<random> or pk_test_<random>
CREATE OR REPLACE FUNCTION public.generate_api_key(is_test BOOLEAN DEFAULT FALSE)
RETURNS TEXT AS $$
DECLARE
  prefix TEXT;
  random_string TEXT;
BEGIN
  prefix := CASE WHEN is_test THEN 'pk_test_' ELSE 'pk_live_' END;
  
  -- Generate 32 character random string using gen_random_uuid() twice
  -- This avoids dependency on pgcrypto extension's gen_random_bytes
  random_string := REPLACE(REPLACE(gen_random_uuid()::TEXT, '-', ''), ' ', '') || REPLACE(REPLACE(gen_random_uuid()::TEXT, '-', ''), ' ', '');
  random_string := SUBSTRING(random_string, 1, 32);
  
  RETURN prefix || random_string;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.generate_api_key IS 'Generate API key with format pk_live_... or pk_test_...';

-- Function: Validate API partner by key and return partner info
CREATE OR REPLACE FUNCTION public.validate_api_partner(p_api_key TEXT)
RETURNS TABLE (
  partner_id UUID,
  tenant_id UUID,
  partner_name TEXT,
  allowed_scopes TEXT[],
  is_active BOOLEAN,
  is_sandbox BOOLEAN,
  rate_limit_per_minute INTEGER,
  rate_limit_per_day INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ap.id,
    ap.tenant_id,
    ap.partner_name,
    ap.allowed_scopes,
    ap.is_active,
    ap.is_sandbox,
    ap.rate_limit_per_minute,
    ap.rate_limit_per_day
  FROM public.api_partners ap
  WHERE ap.api_key = p_api_key
    AND ap.is_active = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.validate_api_partner IS 'Validate API key and return partner configuration';

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.generate_api_key TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_api_partner TO service_role, anon;


-- =====================================================
-- 7. SEED DATA (Optional - for development/testing)
-- =====================================================

-- Insert sandbox test partner for development
-- Note: Only insert if not in production
-- TEMPORARILY COMMENTED OUT FOR MIGRATION TESTING
/*
DO $$
DECLARE
  v_tenant_id UUID;
  v_test_api_key TEXT;
BEGIN
  -- Get first tenant for development (adjust as needed)
  SELECT id INTO v_tenant_id FROM public.tenants LIMIT 1;
  
  IF v_tenant_id IS NOT NULL THEN
    -- Generate test API key
    v_test_api_key := public.generate_api_key(TRUE);
    
    -- Insert sandbox partner
    INSERT INTO public.api_partners (
      tenant_id,
      partner_name,
      partner_type,
      partner_description,
      contact_email,
      api_key,
      allowed_scopes,
      is_active,
      is_sandbox,
      rate_limit_per_minute,
      rate_limit_per_day,
      metadata
    ) VALUES (
      v_tenant_id,
      'Development Sandbox Partner',
      'other',
      'Test partner for development and integration testing',
      'dev@bella-erp.com',
      v_test_api_key,
      ARRAY['order:read', 'order:write', 'payment:read', 'analytics:read'],
      TRUE,
      TRUE,
      1000, -- Higher limits for sandbox
      50000,
      jsonb_build_object(
        'environment', 'development',
        'auto_generated', TRUE,
        'note', 'This is a test partner created automatically'
      )
    )
    ON CONFLICT DO NOTHING;
    
    -- Log the generated API key (for development only)
    RAISE NOTICE 'Sandbox API Key Generated: %', v_test_api_key;
  END IF;
END $$;
*/

-- =====================================================
-- 8. GRANTS & PERMISSIONS
-- =====================================================

-- Grant SELECT to authenticated users (through RLS)
GRANT SELECT ON public.api_partners TO authenticated;
GRANT SELECT ON public.api_request_logs TO authenticated;

-- Grant ALL to service_role (for backend operations)
GRANT ALL ON public.api_partners TO service_role;
GRANT ALL ON public.api_request_logs TO service_role;
GRANT ALL ON public.api_rate_limit_counters TO service_role;

-- Grant USAGE on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- =====================================================
-- 9. ANALYTICS VIEWS (Optional - for monitoring)
-- =====================================================

-- View: Partner API Usage Summary (last 30 days)
CREATE OR REPLACE VIEW public.api_partner_usage_summary AS
SELECT 
  ap.id AS partner_id,
  ap.partner_name,
  ap.partner_type,
  ap.is_sandbox,
  ap.tenant_id,
  COUNT(arl.id) AS total_requests_30d,
  COUNT(arl.id) FILTER (WHERE arl.is_error) AS error_requests_30d,
  ROUND(
    (COUNT(arl.id) FILTER (WHERE arl.is_error)::NUMERIC / NULLIF(COUNT(arl.id), 0)) * 100, 
    2
  ) AS error_rate_percent,
  ROUND(AVG(arl.response_time_ms), 2) AS avg_response_time_ms,
  ROUND(MAX(arl.response_time_ms), 2) AS max_response_time_ms, -- Simplified from PERCENTILE_CONT
  MAX(arl.created_at) AS last_request_at,
  ap.rate_limit_per_minute,
  ap.rate_limit_per_day
FROM public.api_partners ap
LEFT JOIN public.api_request_logs arl 
  ON arl.partner_id = ap.id 
  AND arl.created_at >= NOW() - INTERVAL '30 days'
GROUP BY 
  ap.id,
  ap.partner_name,
  ap.partner_type,
  ap.is_sandbox,
  ap.tenant_id,
  ap.rate_limit_per_minute,
  ap.rate_limit_per_day;

COMMENT ON VIEW public.api_partner_usage_summary IS 'API partner usage statistics for last 30 days';

-- Grant access to view
GRANT SELECT ON public.api_partner_usage_summary TO authenticated, service_role;

-- =====================================================
-- 10. DOCUMENTATION & METADATA
-- =====================================================

-- Migration metadata
COMMENT ON TABLE public.api_partners IS 
  'Phase 1: API Gateway Partner Management - Stores API partners with authentication, rate limiting, and scope-based access control. Created: 2026-06-17';

COMMENT ON TABLE public.api_request_logs IS 
  'Phase 1: API Gateway Request Logging - Audit trail of all API requests for monitoring, debugging, and compliance. Recommend time-series partitioning for production. Created: 2026-06-17';

COMMENT ON TABLE public.api_rate_limit_counters IS 
  'Phase 1: API Gateway Rate Limiting - Tracks rate limit consumption per partner. Redis recommended for production use. Created: 2026-06-17';

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Tables Created:
--   1. api_partners - Partner management with auth credentials
--   2. api_request_logs - Request audit trail
--   3. api_rate_limit_counters - Rate limit tracking
--
-- Security:
--   ✅ RLS enabled on all tables
--   ✅ Tenant isolation enforced
--   ✅ Service role has full access
--   ✅ Admin users have scoped access
--
-- Functions Created:
--   - generate_api_key() - Generate API keys
--   - validate_api_partner() - Validate API keys
--
-- Views Created:
--   - api_partner_usage_summary - Usage analytics
--
-- Next Steps:
--   1. Test migration: supabase db reset
--   2. Verify RLS policies work correctly
--   3. Create TypeScript types from schema
--   4. Implement API key middleware
--   5. Build partner management UI
-- =====================================================

