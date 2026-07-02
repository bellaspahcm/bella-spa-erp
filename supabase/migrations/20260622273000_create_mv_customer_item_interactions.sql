-- Migration: Create Materialized View for Customer-Item Interactions
-- Purpose: Pre-compute customer-item interaction matrix for collaborative filtering
-- Related: Phase 7 - Forecast Intelligence & Recommendation Engine

-- ============================================================================
-- MATERIALIZED VIEW: Customer-Item Interactions
-- ============================================================================
-- Aggregates customer interactions with services/packages for recommendation algorithms
-- Supports Collaborative Filtering and Market Basket Analysis

CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_customer_item_interactions AS
WITH customer_service_interactions AS (
  -- Get all service interactions from completed sessions
  SELECT
    s.tenant_id,
    s.customer_id,
    ssd.service_id AS item_id,
    'service' AS item_type,
    sv.name AS item_name,
    COUNT(DISTINCT s.id) AS interaction_count,
    SUM(ssd.quantity) AS total_quantity,
    SUM(ssd.subtotal) AS total_revenue,
    AVG(r.overall_rating) AS avg_rating,
    COUNT(DISTINCT r.id) AS rating_count,
    MAX(s.check_out_time) AS last_interaction_date,
    MIN(s.check_in_time) AS first_interaction_date
  FROM public.sessions s
  JOIN public.session_service_details ssd ON s.id = ssd.session_id
  JOIN public.services sv ON ssd.service_id = sv.id
  LEFT JOIN public.reviews r ON s.id = r.session_id
  WHERE 
    s.status = 'completed'
    AND s.check_out_time IS NOT NULL
  GROUP BY 
    s.tenant_id, 
    s.customer_id, 
    ssd.service_id,
    sv.name
),
customer_package_interactions AS (
  -- Get all package interactions from bookings
  SELECT
    b.tenant_id,
    b.customer_id,
    b.package_id AS item_id,
    'package' AS item_type,
    p.name AS item_name,
    COUNT(DISTINCT b.id) AS interaction_count,
    SUM(1) AS total_quantity,
    SUM(b.total_amount) AS total_revenue,
    AVG(r.overall_rating) AS avg_rating,
    COUNT(DISTINCT r.id) AS rating_count,
    MAX(b.created_at) AS last_interaction_date,
    MIN(b.created_at) AS first_interaction_date
  FROM public.bookings b
  JOIN public.packages p ON b.package_id = p.id
  LEFT JOIN public.sessions s ON b.id = s.booking_id
  LEFT JOIN public.reviews r ON s.id = r.session_id
  WHERE 
    b.status IN ('confirmed', 'completed')
  GROUP BY 
    b.tenant_id, 
    b.customer_id, 
    b.package_id,
    p.name
),
all_interactions AS (
  SELECT * FROM customer_service_interactions
  UNION ALL
  SELECT * FROM customer_package_interactions
),
interaction_with_metrics AS (
  SELECT
    ai.*,
    -- Calculate recency (days since last interaction)
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - ai.last_interaction_date)) / 86400.0 AS recency_days,
    
    -- Calculate interaction frequency (interactions per month)
    CASE 
      WHEN ai.first_interaction_date IS NOT NULL THEN
        ai.interaction_count::NUMERIC / 
        GREATEST(
          EXTRACT(EPOCH FROM (ai.last_interaction_date - ai.first_interaction_date)) / 2592000.0, -- 30 days in seconds
          1.0 -- Minimum 1 month to avoid division by zero
        )
      ELSE 0
    END AS frequency_per_month,
    
    -- Calculate normalized interaction score (0-1)
    -- Combines frequency, recency, revenue, and ratings
    NULL AS interaction_score -- Will be calculated in next CTE
  FROM all_interactions ai
),
interaction_with_scores AS (
  SELECT
    iwm.*,
    -- Normalize interaction score using min-max scaling within tenant
    CASE
      WHEN MAX(iwm.interaction_count) OVER (PARTITION BY iwm.tenant_id) > 0 THEN
        (
          (iwm.interaction_count::NUMERIC / MAX(iwm.interaction_count) OVER (PARTITION BY iwm.tenant_id) * 0.4) + -- 40% weight on count
          (iwm.total_revenue::NUMERIC / NULLIF(MAX(iwm.total_revenue) OVER (PARTITION BY iwm.tenant_id), 0) * 0.3) + -- 30% weight on revenue
          (COALESCE(iwm.avg_rating, 3.0) / 5.0 * 0.2) + -- 20% weight on rating
          (1.0 / (1.0 + (iwm.recency_days / 30.0)) * 0.1) -- 10% weight on recency (decay function)
        )
      ELSE 0
    END AS interaction_score
  FROM interaction_with_metrics iwm
),
customer_item_pairs AS (
  SELECT
    tenant_id,
    customer_id,
    item_id,
    item_type,
    item_name,
    interaction_count,
    total_quantity,
    total_revenue,
    avg_rating,
    rating_count,
    last_interaction_date,
    first_interaction_date,
    recency_days,
    frequency_per_month,
    ROUND(interaction_score::NUMERIC, 4) AS interaction_score,
    
    -- Calculate percentile ranks for filtering top interactions
    PERCENT_RANK() OVER (
      PARTITION BY tenant_id, customer_id 
      ORDER BY interaction_score DESC
    ) AS interaction_percentile,
    
    -- Flag top interactions (top 20% for each customer)
    CASE
      WHEN PERCENT_RANK() OVER (
        PARTITION BY tenant_id, customer_id 
        ORDER BY interaction_score DESC
      ) <= 0.2 THEN TRUE
      ELSE FALSE
    END AS is_top_interaction
    
  FROM interaction_with_scores
)
SELECT
  tenant_id,
  customer_id,
  item_id,
  item_type,
  item_name,
  interaction_count,
  total_quantity,
  ROUND(total_revenue, 2) AS total_revenue,
  ROUND(avg_rating, 2) AS avg_rating,
  rating_count,
  last_interaction_date,
  first_interaction_date,
  ROUND(recency_days::NUMERIC, 1) AS recency_days,
  ROUND(frequency_per_month, 2) AS frequency_per_month,
  interaction_score,
  ROUND(interaction_percentile::NUMERIC, 4) AS interaction_percentile,
  is_top_interaction
FROM customer_item_pairs
ORDER BY tenant_id, customer_id, interaction_score DESC;

-- ============================================================================
-- INDEXES for mv_customer_item_interactions
-- ============================================================================

CREATE INDEX idx_mv_customer_item_interactions_customer 
  ON public.mv_customer_item_interactions(tenant_id, customer_id, interaction_score DESC);

CREATE INDEX idx_mv_customer_item_interactions_item 
  ON public.mv_customer_item_interactions(tenant_id, item_id, item_type, interaction_score DESC);

CREATE INDEX idx_mv_customer_item_interactions_top 
  ON public.mv_customer_item_interactions(tenant_id, customer_id)
  WHERE is_top_interaction = TRUE;

CREATE INDEX idx_mv_customer_item_interactions_recency 
  ON public.mv_customer_item_interactions(tenant_id, last_interaction_date DESC);

-- ============================================================================
-- SCHEDULED REFRESH JOB
-- ============================================================================
-- Refresh every 6 hours (aligns with customer intelligence refresh)

CREATE TABLE IF NOT EXISTS public.mv_customer_item_interactions_refresh_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  status VARCHAR(50) NOT NULL DEFAULT 'running',
  rows_affected INTEGER,
  error_message TEXT,
  CONSTRAINT mv_customer_item_interactions_refresh_jobs_status_check CHECK (status IN ('running', 'completed', 'failed'))
);

CREATE INDEX idx_mv_customer_item_interactions_refresh_jobs_status 
  ON public.mv_customer_item_interactions_refresh_jobs(started_at DESC, status);

-- Schedule refresh every 6 hours at :30 past the hour
SELECT cron.schedule(
  'refresh-mv-customer-item-interactions',
  '30 */6 * * *', -- Every 6 hours at :30
  $$
  DO $$
  DECLARE
    v_job_id UUID;
    v_rows_affected INTEGER;
  BEGIN
    -- Create job record
    INSERT INTO public.mv_customer_item_interactions_refresh_jobs (status)
    VALUES ('running')
    RETURNING id INTO v_job_id;
    
    -- Refresh materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_customer_item_interactions;
    
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    
    -- Update job record
    UPDATE public.mv_customer_item_interactions_refresh_jobs
    SET 
      completed_at = NOW(),
      status = 'completed',
      rows_affected = v_rows_affected
    WHERE id = v_job_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Log error
    UPDATE public.mv_customer_item_interactions_refresh_jobs
    SET 
      completed_at = NOW(),
      status = 'failed',
      error_message = SQLERRM
    WHERE id = v_job_id;
    
    RAISE;
  END $$;
  $$
);

-- ============================================================================
-- FUNCTION: Get Similar Customers
-- ============================================================================
-- Finds customers with similar interaction patterns (for collaborative filtering)

CREATE OR REPLACE FUNCTION public.get_similar_customers(
  p_tenant_id UUID,
  p_customer_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  similar_customer_id UUID,
  similarity_score NUMERIC,
  common_items INTEGER,
  total_interactions INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH target_customer_items AS (
    SELECT item_id, interaction_score
    FROM public.mv_customer_item_interactions
    WHERE tenant_id = p_tenant_id
      AND customer_id = p_customer_id
  ),
  other_customer_items AS (
    SELECT 
      customer_id,
      item_id,
      interaction_score
    FROM public.mv_customer_item_interactions
    WHERE tenant_id = p_tenant_id
      AND customer_id != p_customer_id
  ),
  similarity_calculation AS (
    SELECT
      oci.customer_id,
      COUNT(DISTINCT oci.item_id) AS common_items,
      SUM(tci.interaction_score * oci.interaction_score) AS dot_product,
      SQRT(SUM(tci.interaction_score * tci.interaction_score)) AS target_magnitude,
      SQRT(SUM(oci.interaction_score * oci.interaction_score)) AS other_magnitude,
      COUNT(DISTINCT oci.item_id) AS total_interactions
    FROM other_customer_items oci
    INNER JOIN target_customer_items tci ON oci.item_id = tci.item_id
    GROUP BY oci.customer_id
  )
  SELECT
    customer_id AS similar_customer_id,
    ROUND(
      (dot_product / NULLIF(target_magnitude * other_magnitude, 0))::NUMERIC,
      4
    ) AS similarity_score,
    common_items::INTEGER,
    total_interactions::INTEGER
  FROM similarity_calculation
  WHERE common_items >= 2 -- At least 2 common items
  ORDER BY similarity_score DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- FUNCTION: Get Co-Purchased Items
-- ============================================================================
-- Finds items frequently purchased together (for market basket analysis)

CREATE OR REPLACE FUNCTION public.get_co_purchased_items(
  p_tenant_id UUID,
  p_item_id UUID,
  p_item_type VARCHAR(50),
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  co_item_id UUID,
  co_item_type VARCHAR(50),
  co_item_name TEXT,
  co_purchase_count BIGINT,
  support NUMERIC,
  confidence NUMERIC,
  lift NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH target_item_customers AS (
    -- Customers who purchased target item
    SELECT customer_id
    FROM public.mv_customer_item_interactions
    WHERE tenant_id = p_tenant_id
      AND item_id = p_item_id
      AND item_type = p_item_type
  ),
  co_purchases AS (
    -- Items purchased by same customers
    SELECT
      mii.item_id AS co_item_id,
      mii.item_type AS co_item_type,
      mii.item_name AS co_item_name,
      COUNT(DISTINCT mii.customer_id) AS co_purchase_count
    FROM public.mv_customer_item_interactions mii
    INNER JOIN target_item_customers tic ON mii.customer_id = tic.customer_id
    WHERE 
      mii.tenant_id = p_tenant_id
      AND (mii.item_id != p_item_id OR mii.item_type != p_item_type) -- Exclude target item
    GROUP BY mii.item_id, mii.item_type, mii.item_name
  ),
  item_stats AS (
    SELECT
      (SELECT COUNT(DISTINCT customer_id) FROM target_item_customers) AS target_customer_count,
      (SELECT COUNT(DISTINCT customer_id) FROM public.mv_customer_item_interactions WHERE tenant_id = p_tenant_id) AS total_customer_count
  )
  SELECT
    cp.co_item_id,
    cp.co_item_type,
    cp.co_item_name,
    cp.co_purchase_count,
    -- Support: P(A ∩ B) = customers who bought both / total customers
    ROUND(
      (cp.co_purchase_count::NUMERIC / NULLIF(ist.total_customer_count, 0))::NUMERIC,
      4
    ) AS support,
    -- Confidence: P(B|A) = customers who bought both / customers who bought A
    ROUND(
      (cp.co_purchase_count::NUMERIC / NULLIF(ist.target_customer_count, 0))::NUMERIC,
      4
    ) AS confidence,
    -- Lift: Confidence / P(B) = how much more likely B is purchased given A
    ROUND(
      (
        (cp.co_purchase_count::NUMERIC / NULLIF(ist.target_customer_count, 0)) /
        NULLIF(
          (SELECT COUNT(DISTINCT customer_id) FROM public.mv_customer_item_interactions 
           WHERE tenant_id = p_tenant_id AND item_id = cp.co_item_id AND item_type = cp.co_item_type)::NUMERIC / 
          NULLIF(ist.total_customer_count, 0),
          0
        )
      )::NUMERIC,
      4
    ) AS lift
  FROM co_purchases cp
  CROSS JOIN item_stats ist
  WHERE cp.co_purchase_count >= 3 -- At least 3 co-purchases
  ORDER BY confidence DESC, lift DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON MATERIALIZED VIEW public.mv_customer_item_interactions IS 
  'Pre-computed customer-item interaction matrix for collaborative filtering and market basket analysis. Includes interaction scores, recency, frequency, and ratings.';

COMMENT ON COLUMN public.mv_customer_item_interactions.interaction_score IS 
  'Normalized interaction score (0-1) combining frequency (40%), revenue (30%), rating (20%), and recency (10%)';

COMMENT ON COLUMN public.mv_customer_item_interactions.interaction_percentile IS 
  'Percentile rank of this interaction among all interactions for this customer (0-1)';

COMMENT ON COLUMN public.mv_customer_item_interactions.is_top_interaction IS 
  'TRUE if this interaction is in the top 20% for this customer (used for filtering strong preferences)';

COMMENT ON COLUMN public.mv_customer_item_interactions.recency_days IS 
  'Days since last interaction (lower = more recent)';

COMMENT ON COLUMN public.mv_customer_item_interactions.frequency_per_month IS 
  'Average interactions per month (higher = more frequent)';

COMMENT ON FUNCTION public.get_similar_customers IS 
  'Finds customers with similar interaction patterns using cosine similarity (for collaborative filtering recommendations)';

COMMENT ON FUNCTION public.get_co_purchased_items IS 
  'Finds items frequently purchased together using association rules: support, confidence, and lift (for market basket analysis)';
