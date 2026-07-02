-- Migration: Performance Optimization - Additional Indexes
-- Purpose: Add missing indexes to optimize Intelligence Layer queries
-- Related: Phase 8 - Optimization & Production Readiness

-- ============================================================================
-- FORECAST_RESULTS OPTIMIZATIONS
-- ============================================================================

-- Index for querying forecasts by model performance
CREATE INDEX IF NOT EXISTS idx_forecast_results_model_accuracy 
  ON public.forecast_results(tenant_id, forecast_type, model_name, accuracy_pct DESC NULLS LAST)
  WHERE actual_value IS NOT NULL;

-- Index for time-range queries on forecasts
CREATE INDEX IF NOT EXISTS idx_forecast_results_date_range 
  ON public.forecast_results(tenant_id, forecast_type, forecast_date)
  INCLUDE (predicted_value, confidence_lower, confidence_upper);

-- Partial index for recent forecasts (last 90 days)
CREATE INDEX IF NOT EXISTS idx_forecast_results_recent 
  ON public.forecast_results(tenant_id, forecast_type, created_at DESC)
  WHERE created_at >= CURRENT_DATE - INTERVAL '90 days';

-- ============================================================================
-- RECOMMENDATION_CACHE OPTIMIZATIONS
-- ============================================================================

-- Index for cache analytics queries
CREATE INDEX IF NOT EXISTS idx_recommendation_cache_analytics 
  ON public.recommendation_cache(tenant_id, recommendation_type, created_at DESC)
  INCLUDE (relevance_score, confidence_score, hit_count);

-- Index for finding stale cache entries (not accessed in 24 hours)
CREATE INDEX IF NOT EXISTS idx_recommendation_cache_stale 
  ON public.recommendation_cache(tenant_id, last_accessed_at)
  WHERE last_accessed_at < NOW() - INTERVAL '24 hours' AND expires_at > NOW();

-- ============================================================================
-- SESSIONS TABLE OPTIMIZATIONS (for demand forecasting)
-- ============================================================================

-- Index for session date range queries (used by demand forecast)
CREATE INDEX IF NOT EXISTS idx_sessions_check_in_date 
  ON public.sessions(tenant_id, DATE(check_in_time), status)
  WHERE status = 'completed' AND check_in_time IS NOT NULL;

-- Index for session service details joins
CREATE INDEX IF NOT EXISTS idx_session_service_details_service 
  ON public.session_service_details(service_id, session_id)
  INCLUDE (quantity);

-- ============================================================================
-- BOOKINGS TABLE OPTIMIZATIONS (for package demand)
-- ============================================================================

-- Index for booking date range queries
CREATE INDEX IF NOT EXISTS idx_bookings_created_date 
  ON public.bookings(tenant_id, DATE(created_at), package_id, status)
  WHERE status IN ('confirmed', 'completed');

