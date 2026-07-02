-- Migration: Create RPC Functions for Recommendation Engine
-- Purpose: Support functions for service/package recommendations
-- Related: Phase 7 - Forecast Intelligence & Recommendation Engine

-- ============================================================================
-- FUNCTION: Get Service Ratings
-- ============================================================================
-- Returns average ratings and review counts for services

CREATE OR REPLACE FUNCTION public.get_service_ratings(
  p_tenant_id UUID,
  p_service_ids UUID[]
)
RETURNS TABLE (
  service_id UUID,
  avg_rating NUMERIC,
  total_reviews BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ssd.service_id,
    ROUND(AVG(r.overall_rating), 2) AS avg_rating,
    COUNT(DISTINCT r.id) AS total_reviews
  FROM public.session_service_details ssd
  JOIN public.sessions s ON ssd.session_id = s.id
  LEFT JOIN public.reviews r ON s.id = r.session_id
  WHERE 
    s.tenant_id = p_tenant_id
    AND ssd.service_id = ANY(p_service_ids)
    AND s.status = 'completed'
  GROUP BY ssd.service_id;
END;
$$;

-- ============================================================================
-- FUNCTION: Get Popular Services
-- ============================================================================
-- Returns most popular services across all customers

CREATE OR REPLACE FUNCTION public.get_popular_services(
  p_tenant_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  service_id UUID,
  service_name TEXT,
  price NUMERIC,
  duration INTEGER,
  category TEXT,
  purchase_count BIGINT,
  avg_rating NUMERIC,
  total_reviews BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH service_popularity AS (
    SELECT
      ssd.service_id,
      sv.name AS service_name,
      sv.price,
      sv.duration,
      sv.category,
      COUNT(DISTINCT s.id) AS purchase_count
    FROM public.session_service_details ssd
    JOIN public.sessions s ON ssd.session_id = s.id
    JOIN public.services sv ON ssd.service_id = sv.id
    WHERE 
      s.tenant_id = p_tenant_id
      AND s.status = 'completed'
      AND sv.is_active = TRUE
      AND s.check_out_time >= CURRENT_DATE - INTERVAL '90 days' -- Last 3 months
    GROUP BY ssd.service_id, sv.name, sv.price, sv.duration, sv.category
  ),
  service_ratings AS (
    SELECT
      ssd.service_id,
      ROUND(AVG(r.overall_rating), 2) AS avg_rating,
      COUNT(DISTINCT r.id) AS total_reviews
    FROM public.session_service_details ssd
    JOIN public.sessions s ON ssd.session_id = s.id
    LEFT JOIN public.reviews r ON s.id = r.session_id
    WHERE 
      s.tenant_id = p_tenant_id
      AND s.status = 'completed'
    GROUP BY ssd.service_id
  )
  SELECT
    sp.service_id,
    sp.service_name,
    sp.price,
    sp.duration,
    sp.category,
    sp.purchase_count,
    COALESCE(sr.avg_rating, 0) AS avg_rating,
    COALESCE(sr.total_reviews, 0) AS total_reviews
  FROM service_popularity sp
  LEFT JOIN service_ratings sr ON sp.service_id = sr.service_id
  ORDER BY sp.purchase_count DESC, sr.avg_rating DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- FUNCTION: Get Popular Services by RFM Segment
-- ============================================================================
-- Returns most popular services among customers in a specific RFM segment

CREATE OR REPLACE FUNCTION public.get_popular_services_by_segment(
  p_tenant_id UUID,
  p_segment TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  service_id UUID,
  service_name TEXT,
  price NUMERIC,
  duration INTEGER,
  category TEXT,
  purchase_count BIGINT,
  avg_rating NUMERIC,
  total_reviews BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH segment_customers AS (
    SELECT customer_id
    FROM public.mv_customer_segments
    WHERE tenant_id = p_tenant_id
      AND segment = p_segment
  ),
  service_popularity AS (
    SELECT
      ssd.service_id,
      sv.name AS service_name,
      sv.price,
      sv.duration,
      sv.category,
      COUNT(DISTINCT s.id) AS purchase_count
    FROM public.session_service_details ssd
    JOIN public.sessions s ON ssd.session_id = s.id
    JOIN public.services sv ON ssd.service_id = sv.id
    JOIN segment_customers sc ON s.customer_id = sc.customer_id
    WHERE 
      s.tenant_id = p_tenant_id
      AND s.status = 'completed'
      AND sv.is_active = TRUE
      AND s.check_out_time >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY ssd.service_id, sv.name, sv.price, sv.duration, sv.category
  ),
  service_ratings AS (
    SELECT
      ssd.service_id,
      ROUND(AVG(r.overall_rating), 2) AS avg_rating,
      COUNT(DISTINCT r.id) AS total_reviews
    FROM public.session_service_details ssd
    JOIN public.sessions s ON ssd.session_id = s.id
    LEFT JOIN public.reviews r ON s.id = r.session_id
    WHERE 
      s.tenant_id = p_tenant_id
      AND s.status = 'completed'
    GROUP BY ssd.service_id
  )
  SELECT
    sp.service_id,
    sp.service_name,
    sp.price,
    sp.duration,
    sp.category,
    sp.purchase_count,
    COALESCE(sr.avg_rating, 0) AS avg_rating,
    COALESCE(sr.total_reviews, 0) AS total_reviews
  FROM service_popularity sp
  LEFT JOIN service_ratings sr ON sp.service_id = sr.service_id
  ORDER BY sp.purchase_count DESC, sr.avg_rating DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- FUNCTION: Get Popular Packages
-- ============================================================================
-- Returns most popular packages across all customers

CREATE OR REPLACE FUNCTION public.get_popular_packages(
  p_tenant_id UUID,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  package_id UUID,
  package_name TEXT,
  price NUMERIC,
  total_sessions INTEGER,
  purchase_count BIGINT,
  avg_rating NUMERIC,
  total_reviews BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH package_popularity AS (
    SELECT
      b.package_id,
      p.name AS package_name,
      p.price,
      p.total_sessions,
      COUNT(DISTINCT b.id) AS purchase_count
    FROM public.bookings b
    JOIN public.packages p ON b.package_id = p.id
    WHERE 
      b.tenant_id = p_tenant_id
      AND b.status IN ('confirmed', 'completed')
      AND p.is_active = TRUE
      AND b.created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY b.package_id, p.name, p.price, p.total_sessions
  ),
  package_ratings AS (
    SELECT
      b.package_id,
      ROUND(AVG(r.overall_rating), 2) AS avg_rating,
      COUNT(DISTINCT r.id) AS total_reviews
    FROM public.bookings b
    JOIN public.sessions s ON b.id = s.booking_id
    LEFT JOIN public.reviews r ON s.id = r.session_id
    WHERE 
      b.tenant_id = p_tenant_id
      AND b.status IN ('confirmed', 'completed')
    GROUP BY b.package_id
  )
  SELECT
    pp.package_id,
    pp.package_name,
    pp.price,
    pp.total_sessions,
    pp.purchase_count,
    COALESCE(pr.avg_rating, 0) AS avg_rating,
    COALESCE(pr.total_reviews, 0) AS total_reviews
  FROM package_popularity pp
  LEFT JOIN package_ratings pr ON pp.package_id = pr.package_id
  ORDER BY pp.purchase_count DESC, pr.avg_rating DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- FUNCTION: Get Popular Packages by RFM Segment
-- ============================================================================
-- Returns most popular packages among customers in a specific RFM segment

CREATE OR REPLACE FUNCTION public.get_popular_packages_by_segment(
  p_tenant_id UUID,
  p_segment TEXT,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  package_id UUID,
  package_name TEXT,
  price NUMERIC,
  total_sessions INTEGER,
  purchase_count BIGINT,
  avg_rating NUMERIC,
  total_reviews BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN QUERY
  WITH segment_customers AS (
    SELECT customer_id
    FROM public.mv_customer_segments
    WHERE tenant_id = p_tenant_id
      AND segment = p_segment
  ),
  package_popularity AS (
    SELECT
      b.package_id,
      p.name AS package_name,
      p.price,
      p.total_sessions,
      COUNT(DISTINCT b.id) AS purchase_count
    FROM public.bookings b
    JOIN public.packages p ON b.package_id = p.id
    JOIN segment_customers sc ON b.customer_id = sc.customer_id
    WHERE 
      b.tenant_id = p_tenant_id
      AND b.status IN ('confirmed', 'completed')
      AND p.is_active = TRUE
      AND b.created_at >= CURRENT_DATE - INTERVAL '90 days'
    GROUP BY b.package_id, p.name, p.price, p.total_sessions
  ),
  package_ratings AS (
    SELECT
      b.package_id,
      ROUND(AVG(r.overall_rating), 2) AS avg_rating,
      COUNT(DISTINCT r.id) AS total_reviews
    FROM public.bookings b
    JOIN public.sessions s ON b.id = s.booking_id
    LEFT JOIN public.reviews r ON s.id = r.session_id
    WHERE 
      b.tenant_id = p_tenant_id
      AND b.status IN ('confirmed', 'completed')
    GROUP BY b.package_id
  )
  SELECT
    pp.package_id,
    pp.package_name,
    pp.price,
    pp.total_sessions,
    pp.purchase_count,
    COALESCE(pr.avg_rating, 0) AS avg_rating,
    COALESCE(pr.total_reviews, 0) AS total_reviews
  FROM package_popularity pp
  LEFT JOIN package_ratings pr ON pp.package_id = pr.package_id
  ORDER BY pp.purchase_count DESC, pr.avg_rating DESC NULLS LAST
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- FUNCTION: Get Customer Purchase Transactions (for Market Basket Analysis)
-- ============================================================================
-- Returns transactions as arrays of item IDs for association rule mining

CREATE OR REPLACE FUNCTION public.get_customer_transactions(
  p_tenant_id UUID,
  p_item_type TEXT DEFAULT 'service', -- 'service' or 'package'
  p_min_date DATE DEFAULT CURRENT_DATE - INTERVAL '180 days'
)
RETURNS TABLE (
  transaction_id UUID,
  customer_id UUID,
  item_ids UUID[],
  transaction_date TIMESTAMP
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF p_item_type = 'service' THEN
    RETURN QUERY
    SELECT
      s.id AS transaction_id,
      s.customer_id,
      ARRAY_AGG(DISTINCT ssd.service_id) AS item_ids,
      s.check_in_time AS transaction_date
    FROM public.sessions s
    JOIN public.session_service_details ssd ON s.id = ssd.session_id
    WHERE 
      s.tenant_id = p_tenant_id
      AND s.status = 'completed'
      AND s.check_in_time >= p_min_date
    GROUP BY s.id, s.customer_id, s.check_in_time
    HAVING COUNT(DISTINCT ssd.service_id) >= 2; -- At least 2 services per transaction
  
  ELSE -- package
    RETURN QUERY
    SELECT
      b.id AS transaction_id,
      b.customer_id,
      ARRAY[b.package_id] AS item_ids, -- Single package per transaction
      b.created_at AS transaction_date
    FROM public.bookings b
    WHERE 
      b.tenant_id = p_tenant_id
      AND b.status IN ('confirmed', 'completed')
      AND b.created_at >= p_min_date;
  END IF;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON FUNCTION public.get_service_ratings IS 
  'Returns average ratings and review counts for specified services';

COMMENT ON FUNCTION public.get_popular_services IS 
  'Returns most popular services (by purchase count) in the last 90 days';

COMMENT ON FUNCTION public.get_popular_services_by_segment IS 
  'Returns most popular services among customers in a specific RFM segment';

COMMENT ON FUNCTION public.get_popular_packages IS 
  'Returns most popular packages (by purchase count) in the last 90 days';

COMMENT ON FUNCTION public.get_popular_packages_by_segment IS 
  'Returns most popular packages among customers in a specific RFM segment';

COMMENT ON FUNCTION public.get_customer_transactions IS 
  'Returns customer transactions as arrays of item IDs for market basket analysis';
