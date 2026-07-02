-- Performance Analysis Script
-- Phase 8: Optimization & Production Readiness
-- Run this script to analyze Intelligence Layer performance

-- ============================================================================
-- 1. MATERIALIZED VIEW REFRESH PERFORMANCE
-- ============================================================================

-- Check MV refresh duration and frequency
SELECT 
  'mv_forecast_accuracy' as view_name,
  COUNT(*) as total_refreshes,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
  MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) as max_duration_seconds,
  AVG(rows_affected) as avg_rows
FROM mv_forecast_accuracy_refresh_jobs
WHERE started_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY view_name

UNION ALL

SELECT 
  'mv_customer_item_interactions' as view_name,
  COUNT(*) as total_refreshes,
  COUNT(*) FILTER (WHERE status = 'completed') as successful,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_duration_seconds,
  MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) as max_duration_seconds,
  AVG(rows_affected) as avg_rows
FROM mv_customer_item_interactions_refresh_jobs
WHERE started_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY view_name;

-- ============================================================================
-- 2. CACHE PERFORMANCE METRICS
-- ============================================================================

-- Cache hit rate by recommendation type
SELECT 
  recommendation_type,
  COUNT(*) as total_entries,
  SUM(hit_count) as total_hits,
  AVG(hit_count) as avg_hits_per_entry,
  AVG(relevance_score) as avg_relevance,
  AVG(confidence_score) as avg_confidence,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as active_entries,
  COUNT(*) FILTER (WHERE expires_at <= NOW()) as expired_entries
FROM recommendation_cache
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY recommendation_type
ORDER BY total_hits DESC;

-- Identify stale cache entries (not accessed in 24 hours)
SELECT 
  recommendation_type,
  COUNT(*) as stale_entries,
  SUM(hit_count) as wasted_storage_hits
FROM recommendation_cache
WHERE last_accessed_at < NOW() - INTERVAL '24 hours'
  AND expires_at > NOW()
GROUP BY recommendation_type;

-- ============================================================================
-- 3. FORECAST ACCURACY TRENDS
-- ============================================================================

-- Track forecast accuracy over time
SELECT 
  forecast_type,
  model_name,
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as total_forecasts,
  AVG(accuracy_pct) as avg_accuracy,
  STDDEV(accuracy_pct) as stddev_accuracy,
  COUNT(*) FILTER (WHERE accuracy_pct >= 80) as accurate_forecasts
FROM forecast_results
WHERE actual_value IS NOT NULL
  AND created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY forecast_type, model_name, DATE_TRUNC('week', created_at)
ORDER BY forecast_type, model_name, week DESC;

-- ============================================================================
-- 4. SLOW QUERY DETECTION
-- ============================================================================

-- Find slow queries in PostgreSQL query log
-- Note: Requires pg_stat_statements extension
-- Enable with: CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT 
  query,
  calls,
  total_exec_time / 1000 as total_seconds,
  mean_exec_time / 1000 as mean_seconds,
  max_exec_time / 1000 as max_seconds,
  stddev_exec_time / 1000 as stddev_seconds,
  rows
FROM pg_stat_statements
WHERE query LIKE '%forecast%' OR query LIKE '%recommendation%'
ORDER BY mean_exec_time DESC
LIMIT 20;


-- ============================================================================
-- 5. INDEX USAGE ANALYSIS
-- ============================================================================

-- Check index usage on forecast_results
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE tablename IN ('forecast_results', 'recommendation_cache', 'mv_forecast_accuracy', 'mv_customer_item_interactions')
ORDER BY tablename, idx_scan DESC;

-- Find unused indexes (candidates for removal)
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE tablename IN ('forecast_results', 'recommendation_cache')
  AND idx_scan = 0
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- 6. TABLE BLOAT ANALYSIS
-- ============================================================================

-- Check for table bloat (dead tuples)
SELECT 
  schemaname,
  tablename,
  n_live_tup as live_tuples,
  n_dead_tup as dead_tuples,
  ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_tuple_pct,
  last_vacuum,
  last_autovacuum,
  last_analyze,
  last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename IN ('forecast_results', 'recommendation_cache', 'mv_forecast_accuracy', 'mv_customer_item_interactions')
ORDER BY dead_tuple_pct DESC NULLS LAST;

-- ============================================================================
-- 7. API ENDPOINT PERFORMANCE (from recommendation cache)
-- ============================================================================

-- Infer API performance from cache access patterns
SELECT 
  recommendation_type,
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as requests,
  AVG(hit_count) as avg_cache_hits,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY hit_count) as median_hits,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY hit_count) as p95_hits
FROM recommendation_cache
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY recommendation_type, DATE_TRUNC('hour', created_at)
ORDER BY hour DESC, requests DESC
LIMIT 50;

-- ============================================================================
-- 8. OPTIMIZATION RECOMMENDATIONS
-- ============================================================================

-- Generate optimization recommendations based on above analysis
WITH cache_stats AS (
  SELECT 
    recommendation_type,
    COUNT(*) as entries,
    AVG(hit_count) as avg_hits,
    SUM(hit_count) as total_hits
  FROM recommendation_cache
  WHERE expires_at > NOW()
  GROUP BY recommendation_type
),
mv_stats AS (
  SELECT 
    'mv_forecast_accuracy' as view_name,
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_refresh_seconds
  FROM mv_forecast_accuracy_refresh_jobs
  WHERE started_at >= CURRENT_DATE - INTERVAL '7 days'
    AND status = 'completed'
  
  UNION ALL
  
  SELECT 
    'mv_customer_item_interactions',
    AVG(EXTRACT(EPOCH FROM (completed_at - started_at)))
  FROM mv_customer_item_interactions_refresh_jobs
  WHERE started_at >= CURRENT_DATE - INTERVAL '7 days'
    AND status = 'completed'
)
SELECT 
  'CACHE' as component,
  recommendation_type as detail,
  CASE 
    WHEN avg_hits < 5 THEN 'LOW_USAGE: Consider shorter TTL or removing'
    WHEN avg_hits > 50 THEN 'HIGH_USAGE: Consider longer TTL'
    ELSE 'OPTIMAL'
  END as recommendation,
  CONCAT('Avg hits: ', ROUND(avg_hits, 2), ', Total hits: ', total_hits) as metrics
FROM cache_stats

UNION ALL

SELECT 
  'MATERIALIZED_VIEW' as component,
  view_name as detail,
  CASE 
    WHEN avg_refresh_seconds > 60 THEN 'SLOW_REFRESH: Consider optimization or less frequent refresh'
    WHEN avg_refresh_seconds > 300 THEN 'CRITICAL_SLOW: Immediate optimization needed'
    ELSE 'OPTIMAL'
  END as recommendation,
  CONCAT('Avg refresh: ', ROUND(avg_refresh_seconds, 2), ' seconds') as metrics
FROM mv_stats;

-- ============================================================================
-- 9. CLEANUP OPPORTUNITIES
-- ============================================================================

-- Identify old forecast results that can be archived
SELECT 
  'forecast_results' as table_name,
  COUNT(*) as old_records,
  pg_size_pretty(SUM(pg_column_size(forecast_results.*))) as estimated_size
FROM forecast_results
WHERE created_at < CURRENT_DATE - INTERVAL '365 days';

-- Identify expired cache entries that should be cleaned up
SELECT 
  'recommendation_cache' as table_name,
  COUNT(*) as expired_records,
  pg_size_pretty(SUM(pg_column_size(recommendation_cache.*))) as estimated_size
FROM recommendation_cache
WHERE expires_at < NOW();

-- ============================================================================
-- END OF PERFORMANCE ANALYSIS
-- ============================================================================
