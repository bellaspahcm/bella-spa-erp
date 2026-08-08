-- Progressive Rollout: Query Hospital Tenants and Categorize by Risk Profile
-- Run this to identify tenants for each rollout stage

-- ============================================================================
-- STEP 1: Get all hospital tenants with activity metrics
-- ============================================================================

WITH tenant_metrics AS (
  SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.tenant_type,
    t.subscription_plan,
    t.created_at,
    
    -- Bed count (capacity indicator)
    COALESCE((
      SELECT COUNT(*) 
      FROM hc_beds b 
      WHERE b.tenant_id = t.id
    ), 0) AS total_beds,
    
    -- Active users (last 30 days)
    COALESCE((
      SELECT COUNT(DISTINCT user_id)
      FROM audit_logs al
      WHERE al.tenant_id = t.id
        AND al.created_at > NOW() - INTERVAL '30 days'
    ), 0) AS active_users_30d,
    
    -- Daily admissions (avg last 7 days)
    COALESCE((
      SELECT COUNT(*) / 7.0
      FROM hc_admissions adm
      WHERE adm.tenant_id = t.id
        AND adm.admission_date > NOW() - INTERVAL '7 days'
    ), 0) AS avg_daily_admissions,
    
    -- Medication orders per hour (peak hour yesterday)
    COALESCE((
      SELECT MAX(hourly_count)
      FROM (
        SELECT COUNT(*) AS hourly_count
        FROM hc_medication_orders mo
        WHERE mo.tenant_id = t.id
          AND mo.prescribed_date > NOW() - INTERVAL '1 day'
        GROUP BY DATE_TRUNC('hour', mo.prescribed_date)
      ) hourly
    ), 0) AS peak_med_orders_per_hour,
    
    -- Vitals records per hour (peak hour yesterday)
    COALESCE((
      SELECT MAX(hourly_count)
      FROM (
        SELECT COUNT(*) AS hourly_count
        FROM hc_vital_signs vs
        WHERE vs.tenant_id = t.id
          AND vs.recorded_date_time > NOW() - INTERVAL '1 day'
        GROUP BY DATE_TRUNC('hour', vs.recorded_date_time)
      ) hourly
    ), 0) AS peak_vitals_per_hour,
    
    -- Has critical departments (ICU, OR, ED)
    EXISTS(
      SELECT 1 FROM hc_departments d
      WHERE d.tenant_id = t.id
        AND d.department_type IN ('icu', 'operating_room', 'emergency')
    ) AS has_critical_depts,
    
    -- Is production environment (not dev/staging)
    CASE 
      WHEN t.name ILIKE '%dev%' OR t.name ILIKE '%test%' OR t.name ILIKE '%staging%' THEN false
      ELSE true
    END AS is_production

  FROM tenants t
  WHERE t.tenant_type = 'hospital'
    AND t.status = 'active'
),

-- ============================================================================
-- STEP 2: Calculate risk score and categorize
-- ============================================================================

tenant_risk_scores AS (
  SELECT 
    *,
    -- Risk score calculation (0-100)
    (
      -- Bed count weight (0-30 points)
      LEAST(total_beds / 10.0, 30) +
      
      -- Active users weight (0-20 points)
      LEAST(active_users_30d / 25.0, 20) +
      
      -- Transaction rate weight (0-20 points)
      LEAST((peak_med_orders_per_hour + peak_vitals_per_hour) / 10.0, 20) +
      
      -- Critical departments weight (0-20 points)
      CASE WHEN has_critical_depts THEN 20 ELSE 0 END +
      
      -- Production environment weight (0-10 points)
      CASE WHEN is_production THEN 10 ELSE 0 END
    )::INTEGER AS risk_score,
    
    -- Risk category
    CASE
      -- Low risk: <30 beds, <100 users, no critical depts, OR dev/staging
      WHEN total_beds < 30 
           AND active_users_30d < 100 
           AND NOT has_critical_depts 
           OR NOT is_production 
        THEN 'low'
      
      -- High risk: >200 beds, >500 users, OR has critical depts
      WHEN total_beds > 200 
           OR active_users_30d > 500 
           OR has_critical_depts
        THEN 'high'
      
      -- Medium risk: everything else
      ELSE 'medium'
    END AS risk_category

  FROM tenant_metrics
)

-- ============================================================================
-- STEP 3: Final output with rollout stage assignment
-- ============================================================================

SELECT 
  tenant_id,
  tenant_name,
  subscription_plan,
  total_beds,
  active_users_30d,
  avg_daily_admissions,
  peak_med_orders_per_hour,
  peak_vitals_per_hour,
  has_critical_depts,
  is_production,
  risk_score,
  risk_category,
  
  -- Suggested rollout stage
  CASE risk_category
    WHEN 'low' THEN 'Stage 1 (10%)'
    WHEN 'medium' THEN 'Stage 2-3 (25-50%)'
    WHEN 'high' THEN 'Stage 4 (100%)'
  END AS suggested_stage,
  
  -- Check if already enabled
  EXISTS(
    SELECT 1 FROM feature_flags ff
    WHERE ff.tenant_id = tenant_risk_scores.tenant_id
      AND ff.flag_key = 'phase_a_platform_of_platforms'
      AND ff.enabled = true
  ) AS already_enabled

FROM tenant_risk_scores
ORDER BY risk_score ASC, total_beds ASC;


-- ============================================================================
-- SUMMARY STATISTICS
-- ============================================================================

-- Run this separately to see distribution
SELECT 
  risk_category,
  COUNT(*) AS tenant_count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) AS percentage,
  ROUND(AVG(total_beds)) AS avg_beds,
  ROUND(AVG(active_users_30d)) AS avg_users,
  SUM(CASE WHEN has_critical_depts THEN 1 ELSE 0 END) AS with_critical_depts
FROM (
  SELECT 
    t.id AS tenant_id,
    COALESCE((SELECT COUNT(*) FROM hc_beds b WHERE b.tenant_id = t.id), 0) AS total_beds,
    COALESCE((SELECT COUNT(DISTINCT user_id) FROM audit_logs al WHERE al.tenant_id = t.id AND al.created_at > NOW() - INTERVAL '30 days'), 0) AS active_users_30d,
    EXISTS(SELECT 1 FROM hc_departments d WHERE d.tenant_id = t.id AND d.department_type IN ('icu', 'operating_room', 'emergency')) AS has_critical_depts,
    CASE 
      WHEN COALESCE((SELECT COUNT(*) FROM hc_beds b WHERE b.tenant_id = t.id), 0) < 30 
           AND COALESCE((SELECT COUNT(DISTINCT user_id) FROM audit_logs al WHERE al.tenant_id = t.id AND al.created_at > NOW() - INTERVAL '30 days'), 0) < 100 
           AND NOT EXISTS(SELECT 1 FROM hc_departments d WHERE d.tenant_id = t.id AND d.department_type IN ('icu', 'operating_room', 'emergency'))
           OR (t.name ILIKE '%dev%' OR t.name ILIKE '%test%' OR t.name ILIKE '%staging%')
        THEN 'low'
      WHEN COALESCE((SELECT COUNT(*) FROM hc_beds b WHERE b.tenant_id = t.id), 0) > 200 
           OR COALESCE((SELECT COUNT(DISTINCT user_id) FROM audit_logs al WHERE al.tenant_id = t.id AND al.created_at > NOW() - INTERVAL '30 days'), 0) > 500 
           OR EXISTS(SELECT 1 FROM hc_departments d WHERE d.tenant_id = t.id AND d.department_type IN ('icu', 'operating_room', 'emergency'))
        THEN 'high'
      ELSE 'medium'
    END AS risk_category
  FROM tenants t
  WHERE t.tenant_type = 'hospital'
    AND t.status = 'active'
) summary
GROUP BY risk_category
ORDER BY 
  CASE risk_category 
    WHEN 'low' THEN 1 
    WHEN 'medium' THEN 2 
    WHEN 'high' THEN 3 
  END;


-- ============================================================================
-- STAGE SELECTION QUERIES (use these to enable flags)
-- ============================================================================

-- Stage 1: Get 10% lowest-risk tenants
-- Copy tenant_ids from this result to enable feature flag

COMMENT ON COLUMN tenant_risk_scores.risk_score IS 'Risk score 0-100: Lower = safer for early rollout';

WITH ranked_tenants AS (
  SELECT 
    t.id AS tenant_id,
    t.name AS tenant_name,
    COALESCE((SELECT COUNT(*) FROM hc_beds b WHERE b.tenant_id = t.id), 0) AS total_beds,
    ROW_NUMBER() OVER (ORDER BY 
      CASE 
        WHEN COALESCE((SELECT COUNT(*) FROM hc_beds b WHERE b.tenant_id = t.id), 0) < 30 
             AND COALESCE((SELECT COUNT(DISTINCT user_id) FROM audit_logs al WHERE al.tenant_id = t.id AND al.created_at > NOW() - INTERVAL '30 days'), 0) < 100 
             AND NOT EXISTS(SELECT 1 FROM hc_departments d WHERE d.tenant_id = t.id AND d.department_type IN ('icu', 'operating_room', 'emergency'))
          THEN 0 
        ELSE 1 
      END,
      COALESCE((SELECT COUNT(*) FROM hc_beds b WHERE b.tenant_id = t.id), 0) ASC
    ) AS rank,
    COUNT(*) OVER () AS total_tenants
  FROM tenants t
  WHERE t.tenant_type = 'hospital'
    AND t.status = 'active'
    AND NOT EXISTS(
      SELECT 1 FROM feature_flags ff
      WHERE ff.tenant_id = t.id
        AND ff.flag_key = 'phase_a_platform_of_platforms'
        AND ff.enabled = true
    )
)
SELECT 
  tenant_id,
  tenant_name,
  total_beds,
  '-- Copy these tenant_ids for Stage 1' AS note
FROM ranked_tenants
WHERE rank <= CEIL(total_tenants * 0.10)
ORDER BY rank;
