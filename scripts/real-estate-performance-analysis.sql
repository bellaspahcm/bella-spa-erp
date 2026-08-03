-- ============================================================================
-- REAL ESTATE PERFORMANCE ANALYSIS
-- ============================================================================
-- Based on: Beauty Spa performance-analysis.sql pattern
-- Purpose: Monitor and optimize Real Estate module performance
-- ============================================================================

-- ============================================================================
-- 1. INDEX USAGE ANALYSIS
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched,
  pg_size_pretty(pg_relation_size(indexrelid)) as size
FROM pg_stat_user_indexes
WHERE tablename LIKE 're_%' OR tablename LIKE 'real_estate_%'
ORDER BY idx_scan DESC;

-- ============================================================================
-- 2. SLOW QUERIES DETECTION
-- ============================================================================

-- Requires pg_stat_statements extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

SELECT 
  LEFT(query, 100) as query_preview,
  calls,
  ROUND(total_exec_time::numeric / 1000, 2) as total_seconds,
  ROUND(mean_exec_time::numeric / 1000, 2) as avg_seconds,
  ROUND(max_exec_time::numeric / 1000, 2) as max_seconds
FROM pg_stat_statements
WHERE query LIKE '%re_%' OR query LIKE '%real_estate%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- ============================================================================
-- 3. TABLE STATISTICS
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_pct,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  last_vacuum,
  last_autovacuum
FROM pg_stat_user_tables
WHERE tablename LIKE 're_%' OR tablename LIKE 'real_estate_%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- 4. QUERY PERFORMANCE BY MODULE
-- ============================================================================

-- Most queried products (available units)
SELECT 
  p.project_id,
  proj.name as project_name,
  COUNT(*) as total_units,
  COUNT(*) FILTER (WHERE p.status = 'available') as available_units,
  AVG(p.unit_price) as avg_price,
  MIN(p.unit_price) as min_price,
  MAX(p.unit_price) as max_price
FROM real_estate_products p
LEFT JOIN real_estate_projects proj ON proj.id = p.project_id
WHERE p.deleted_at IS NULL
GROUP BY p.project_id, proj.name
ORDER BY total_units DESC;

-- Lead conversion funnel
SELECT 
  state,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM re_leads
WHERE deleted_at IS NULL
GROUP BY state
ORDER BY 
  CASE state
    WHEN 'NEW' THEN 1
    WHEN 'ASSIGNED' THEN 2
    WHEN 'CONTACTED' THEN 3
    WHEN 'QUALIFIED' THEN 4
    WHEN 'VISIT_SCHEDULED' THEN 5
    WHEN 'NEGOTIATING' THEN 6
    WHEN 'CONVERTED' THEN 7
    WHEN 'LOST' THEN 8
  END;

-- Transaction summary (last 30 days)
SELECT 
  transaction_type,
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount
FROM re_transactions
WHERE transaction_date > CURRENT_DATE - INTERVAL '30 days'
  AND deleted_at IS NULL
GROUP BY transaction_type, status
ORDER BY total_amount DESC;

-- ============================================================================
-- 5. UNUSED INDEXES (candidates for removal)
-- ============================================================================

SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) as wasted_size
FROM pg_stat_user_indexes
WHERE (tablename LIKE 're_%' OR tablename LIKE 'real_estate_%')
  AND idx_scan = 0
  AND indexname NOT LIKE '%_pkey'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ============================================================================
-- 6. CACHE RECOMMENDATIONS
-- ============================================================================

-- Identify frequently accessed data (good cache candidates)
WITH frequent_products AS (
  SELECT 
    product_id,
    COUNT(*) as access_count
  FROM re_reservations
  WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
  GROUP BY product_id
  HAVING COUNT(*) > 5
)
SELECT 
  'FREQUENT_PRODUCTS' as cache_candidate,
  COUNT(*) as candidate_count,
  STRING_AGG(product_id::text, ', ') as product_ids
FROM frequent_products;

-- ============================================================================
-- 7. OPTIMIZATION RECOMMENDATIONS
-- ============================================================================

WITH table_stats AS (
  SELECT 
    tablename,
    n_live_tup,
    n_dead_tup,
    last_vacuum,
    last_autovacuum
  FROM pg_stat_user_tables
  WHERE tablename LIKE 're_%' OR tablename LIKE 'real_estate_%'
)
SELECT 
  tablename,
  CASE 
    WHEN n_dead_tup > n_live_tup * 0.2 THEN 'NEEDS_VACUUM: High dead tuple ratio'
    WHEN last_vacuum IS NULL AND last_autovacuum < NOW() - INTERVAL '7 days' THEN 'NEEDS_VACUUM: Not vacuumed in 7 days'
    ELSE 'OK'
  END as recommendation,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows,
  ROUND(n_dead_tup * 100.0 / NULLIF(n_live_tup + n_dead_tup, 0), 2) as dead_pct
FROM table_stats
WHERE n_live_tup > 0
ORDER BY dead_pct DESC NULLS LAST;

-- ============================================================================
-- 8. QUERY PATTERNS ANALYSIS
-- ============================================================================

-- Most common filters (from index usage)
SELECT 
  'Available Units Query' as query_pattern,
  COUNT(*) as frequency,
  'Optimized: idx_re_products_available' as optimization_status
FROM real_estate_products
WHERE status = 'available' AND deleted_at IS NULL

UNION ALL

SELECT 
  'Active Leads Query',
  COUNT(*),
  'Optimized: idx_re_leads_active_state'
FROM re_leads
WHERE state NOT IN ('CONVERTED', 'LOST') AND deleted_at IS NULL

UNION ALL

SELECT 
  'Recent Transactions',
  COUNT(*),
  'Optimized: idx_re_transactions_recent'
FROM re_transactions
WHERE transaction_date > CURRENT_DATE - INTERVAL '30 days' AND deleted_at IS NULL;

-- ============================================================================
-- END OF ANALYSIS
-- ============================================================================
