-- Migration: Create Recommendation Cache Table
-- Purpose: Store computed recommendations for fast retrieval
-- Related: Phase 7 - Forecast Intelligence & Recommendation Engine

-- ============================================================================
-- RECOMMENDATION CACHE TABLE
-- ============================================================================
-- Caches recommendation results to avoid re-computing on every request
-- Supports service, upsell, and package recommendations

CREATE TABLE IF NOT EXISTS public.recommendation_cache (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Recommendation metadata
  recommendation_type VARCHAR(50) NOT NULL, -- 'service', 'upsell', 'package'
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  
  -- Recommendation algorithm
  algorithm_name VARCHAR(100) NOT NULL, -- e.g., 'collaborative_filtering', 'market_basket', 'rfm_based'
  algorithm_version VARCHAR(50) NOT NULL, -- e.g., 'v1.0', 'v2.1'
  
  -- Recommendation results
  recommendations JSONB NOT NULL, -- Array of recommended items with scores
  -- Example structure:
  -- [
  --   { "item_id": "uuid", "item_name": "Massage Thư Giãn", "score": 0.95, "reason": "Similar customers also purchased" },
  --   { "item_id": "uuid", "item_name": "Gội Đầu Dưỡng Sinh", "score": 0.87, "reason": "Frequently purchased together" }
  -- ]
  
  -- Relevance metrics
  relevance_score NUMERIC(5, 4), -- Overall relevance score (0-1)
  confidence_score NUMERIC(5, 4), -- Confidence in recommendations (0-1)
  diversity_score NUMERIC(5, 4), -- Diversity of recommendations (0-1, higher = more diverse)
  
  -- Context used for recommendations
  context JSONB, -- Input context (customer RFM segment, purchase history, preferences, etc.)
  
  -- Cache control
  cache_key VARCHAR(255) NOT NULL, -- MD5 hash of (tenant_id, customer_id, recommendation_type, context)
  expires_at TIMESTAMP NOT NULL, -- Cache expiration time (6 hours for recommendations)
  hit_count INTEGER DEFAULT 0, -- Number of times this cache entry was used
  
  -- Audit fields
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  last_accessed_at TIMESTAMP DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT recommendation_cache_type_check CHECK (recommendation_type IN ('service', 'upsell', 'package')),
  CONSTRAINT recommendation_cache_relevance_check CHECK (relevance_score >= 0 AND relevance_score <= 1),
  CONSTRAINT recommendation_cache_confidence_check CHECK (confidence_score >= 0 AND confidence_score <= 1),
  CONSTRAINT recommendation_cache_diversity_check CHECK (diversity_score >= 0 AND diversity_score <= 1)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Primary query pattern: fetch by cache_key
CREATE UNIQUE INDEX idx_recommendation_cache_key 
  ON public.recommendation_cache(tenant_id, cache_key)
  WHERE expires_at > NOW(); -- Partial index: only active cache entries

-- Query by customer and type
CREATE INDEX idx_recommendation_cache_customer_type 
  ON public.recommendation_cache(tenant_id, customer_id, recommendation_type)
  WHERE expires_at > NOW();

-- For cache cleanup jobs
CREATE INDEX idx_recommendation_cache_expired 
  ON public.recommendation_cache(expires_at)
  WHERE expires_at <= NOW();

-- For analytics on cache usage
CREATE INDEX idx_recommendation_cache_hit_count 
  ON public.recommendation_cache(tenant_id, recommendation_type, hit_count DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.recommendation_cache ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see recommendations for their tenant
CREATE POLICY recommendation_cache_tenant_isolation 
  ON public.recommendation_cache
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT tenant_id 
      FROM public.user_tenant_roles 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only service account can insert/update cache
CREATE POLICY recommendation_cache_service_write 
  ON public.recommendation_cache
  FOR ALL
  USING (
    tenant_id IN (
      SELECT utr.tenant_id 
      FROM public.user_tenant_roles utr
      JOIN public.roles r ON utr.role_id = r.id
      WHERE utr.user_id = auth.uid()
        AND r.name IN ('admin', 'owner', 'service_account')
    )
  );

-- ============================================================================
-- FUNCTION: Get Cached Recommendations
-- ============================================================================
-- Retrieves cached recommendations and increments hit_count

CREATE OR REPLACE FUNCTION public.get_cached_recommendations(
  p_tenant_id UUID,
  p_cache_key VARCHAR(255)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_recommendations JSONB;
BEGIN
  -- Fetch and increment hit count atomically
  UPDATE public.recommendation_cache
  SET 
    hit_count = hit_count + 1,
    last_accessed_at = NOW()
  WHERE 
    tenant_id = p_tenant_id
    AND cache_key = p_cache_key
    AND expires_at > NOW()
  RETURNING recommendations INTO v_recommendations;
  
  RETURN v_recommendations;
END;
$$;

-- ============================================================================
-- FUNCTION: Cleanup Expired Cache Entries
-- ============================================================================
-- Deletes expired recommendation cache entries
-- Should be called by a cron job daily

CREATE OR REPLACE FUNCTION public.cleanup_expired_recommendation_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.recommendation_cache
  WHERE expires_at <= NOW();
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;

-- ============================================================================
-- SCHEDULED JOB: Cleanup expired cache entries daily
-- ============================================================================
-- Runs every day at 2:00 AM to clean up expired cache

SELECT cron.schedule(
  'cleanup-expired-recommendation-cache',
  '0 2 * * *', -- Daily at 2:00 AM
  $$
  SELECT public.cleanup_expired_recommendation_cache();
  $$
);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE public.recommendation_cache IS 
  'Caches computed recommendations (service, upsell, package) for fast retrieval and to avoid re-computing on every request';

COMMENT ON COLUMN public.recommendation_cache.recommendation_type IS 
  'Type of recommendation: service (next service to try), upsell (complementary items), package (best-fit package)';

COMMENT ON COLUMN public.recommendation_cache.recommendations IS 
  'JSONB array of recommended items with scores and reasons';

COMMENT ON COLUMN public.recommendation_cache.relevance_score IS 
  'Overall relevance score (0-1): how relevant are these recommendations for this customer';

COMMENT ON COLUMN public.recommendation_cache.confidence_score IS 
  'Confidence score (0-1): how confident is the algorithm in these recommendations';

COMMENT ON COLUMN public.recommendation_cache.diversity_score IS 
  'Diversity score (0-1): how diverse are the recommendations (higher = more variety)';

COMMENT ON COLUMN public.recommendation_cache.cache_key IS 
  'MD5 hash of (tenant_id, customer_id, recommendation_type, context) for fast lookup';

COMMENT ON COLUMN public.recommendation_cache.expires_at IS 
  'Cache expiration time (typically 6 hours for recommendations to balance freshness and performance)';

COMMENT ON COLUMN public.recommendation_cache.hit_count IS 
  'Number of times this cache entry was used (for analytics on cache effectiveness)';

COMMENT ON FUNCTION public.get_cached_recommendations IS 
  'Retrieves cached recommendations and atomically increments hit_count for analytics';

COMMENT ON FUNCTION public.cleanup_expired_recommendation_cache IS 
  'Deletes expired recommendation cache entries (called by daily cron job)';
