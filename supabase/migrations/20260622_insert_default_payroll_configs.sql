-- =====================================================
-- INSERT DEFAULT PAYROLL CONFIGS
-- =====================================================
-- Purpose: Insert default configuration for all existing tenants
-- This gives each tenant sensible defaults that they can customize later
--
-- Run this AFTER creating tenant_payroll_config schema
-- Run this AFTER tenants have been created
--
-- Safe to run multiple times (uses ON CONFLICT DO NOTHING)
-- =====================================================

-- =====================================================
-- STEP 1: Commission Provider (Fixed Strategy)
-- =====================================================
-- Default: 120,000 VND per session
-- This is the most common commission structure for spas
-- =====================================================

INSERT INTO tenant_payroll_config (
  tenant_id,
  provider_key,
  enabled,
  strategy,
  config,
  notes,
  created_by,
  updated_by
)
SELECT 
  t.id as tenant_id,
  'commission' as provider_key,
  true as enabled,
  'fixed' as strategy,
  jsonb_build_object(
    'rate', 120000,
    'minSessions', 0
  ) as config,
  'Default commission: 120,000 VND per session (auto-generated)' as notes,
  NULL as created_by,  -- System-generated
  NULL as updated_by
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_payroll_config 
  WHERE tenant_id = t.id AND provider_key = 'commission'
)
ON CONFLICT (tenant_id, provider_key) DO NOTHING;

-- Verify
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO inserted_count
  FROM tenant_payroll_config
  WHERE provider_key = 'commission';
  
  RAISE NOTICE 'Commission configs inserted/existing: %', inserted_count;
END $$;

-- =====================================================
-- STEP 2: KPI Provider (Threshold Strategy)
-- =====================================================
-- Default: 30 sessions → 1,000,000 VND bonus
-- DISABLED by default (tenants can enable if needed)
-- =====================================================

INSERT INTO tenant_payroll_config (
  tenant_id,
  provider_key,
  enabled,
  strategy,
  config,
  notes,
  created_by,
  updated_by
)
SELECT 
  t.id as tenant_id,
  'kpi' as provider_key,
  false as enabled,  -- ← Disabled by default
  'threshold' as strategy,
  jsonb_build_object(
    'target', 30,
    'bonus', 1000000
  ) as config,
  'Default KPI: 30 sessions → 1M bonus (disabled by default, auto-generated)' as notes,
  NULL as created_by,
  NULL as updated_by
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_payroll_config 
  WHERE tenant_id = t.id AND provider_key = 'kpi'
)
ON CONFLICT (tenant_id, provider_key) DO NOTHING;

-- Verify
DO $$
DECLARE
  inserted_count INTEGER;
  enabled_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO inserted_count
  FROM tenant_payroll_config
  WHERE provider_key = 'kpi';
  
  SELECT COUNT(*) INTO enabled_count
  FROM tenant_payroll_config
  WHERE provider_key = 'kpi' AND enabled = true;
  
  RAISE NOTICE 'KPI configs inserted/existing: % (enabled: %)', inserted_count, enabled_count;
END $$;

-- =====================================================
-- STEP 3: Attendance Provider (Deduction Strategy)
-- =====================================================
-- Default penalties:
-- - Late: 50,000 VND
-- - Absent: 200,000 VND
-- - Grace period: 15 minutes
-- ENABLED by default
-- =====================================================

INSERT INTO tenant_payroll_config (
  tenant_id,
  provider_key,
  enabled,
  strategy,
  config,
  notes,
  created_by,
  updated_by
)
SELECT 
  t.id as tenant_id,
  'attendance' as provider_key,
  true as enabled,
  'late_deduction' as strategy,
  jsonb_build_object(
    'latePenalty', 50000,
    'absentPenalty', 200000,
    'lateGracePeriod', 15
  ) as config,
  'Default attendance: 50k late, 200k absent, 15min grace (auto-generated)' as notes,
  NULL as created_by,
  NULL as updated_by
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_payroll_config 
  WHERE tenant_id = t.id AND provider_key = 'attendance'
)
ON CONFLICT (tenant_id, provider_key) DO NOTHING;

-- Verify
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO inserted_count
  FROM tenant_payroll_config
  WHERE provider_key = 'attendance';
  
  RAISE NOTICE 'Attendance configs inserted/existing: %', inserted_count;
END $$;

-- =====================================================
-- STEP 4: Rating Provider (Threshold Strategy)
-- =====================================================
-- Default: ≥4.5 stars → 50,000 VND bonus
-- DISABLED by default (not all spas use this)
-- =====================================================

INSERT INTO tenant_payroll_config (
  tenant_id,
  provider_key,
  enabled,
  strategy,
  config,
  notes,
  created_by,
  updated_by
)
SELECT 
  t.id as tenant_id,
  'rating' as provider_key,
  false as enabled,  -- ← Disabled by default
  'threshold' as strategy,
  jsonb_build_object(
    'minRating', 4.5,
    'bonus', 50000
  ) as config,
  'Default rating: ≥4.5 stars → 50k bonus (disabled by default, auto-generated)' as notes,
  NULL as created_by,
  NULL as updated_by
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_payroll_config 
  WHERE tenant_id = t.id AND provider_key = 'rating'
)
ON CONFLICT (tenant_id, provider_key) DO NOTHING;

-- Verify
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO inserted_count
  FROM tenant_payroll_config
  WHERE provider_key = 'rating';
  
  RAISE NOTICE 'Rating configs inserted/existing: %', inserted_count;
END $$;

-- =====================================================
-- STEP 5: Bonus Provider (Manual Strategy)
-- =====================================================
-- For ad-hoc bonuses (birthday, anniversary, etc.)
-- DISABLED by default (admin assigns manually)
-- =====================================================

INSERT INTO tenant_payroll_config (
  tenant_id,
  provider_key,
  enabled,
  strategy,
  config,
  notes,
  created_by,
  updated_by
)
SELECT 
  t.id as tenant_id,
  'bonus' as provider_key,
  false as enabled,  -- ← Disabled by default
  NULL as strategy,  -- Manual assignment, no auto strategy
  '{}'::jsonb as config,
  'Manual bonus provider (disabled by default, auto-generated)' as notes,
  NULL as created_by,
  NULL as updated_by
FROM tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_payroll_config 
  WHERE tenant_id = t.id AND provider_key = 'bonus'
)
ON CONFLICT (tenant_id, provider_key) DO NOTHING;

-- Verify
DO $$
DECLARE
  inserted_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO inserted_count
  FROM tenant_payroll_config
  WHERE provider_key = 'bonus';
  
  RAISE NOTICE 'Bonus configs inserted/existing: %', inserted_count;
END $$;

-- =====================================================
-- FINAL VERIFICATION
-- =====================================================

DO $$
DECLARE
  tenant_count INTEGER;
  config_count INTEGER;
  expected_count INTEGER;
BEGIN
  -- Count tenants
  SELECT COUNT(*) INTO tenant_count FROM tenants;
  
  -- Count configs
  SELECT COUNT(*) INTO config_count FROM tenant_payroll_config;
  
  -- Expected: 5 providers × N tenants
  expected_count := tenant_count * 5;
  
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'FINAL VERIFICATION';
  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Total tenants: %', tenant_count;
  RAISE NOTICE 'Total configs: %', config_count;
  RAISE NOTICE 'Expected configs: %', expected_count;
  RAISE NOTICE 'Status: %', 
    CASE 
      WHEN config_count >= expected_count THEN '✅ ALL CONFIGS PRESENT'
      ELSE '⚠️ SOME CONFIGS MISSING'
    END;
  RAISE NOTICE '==================================================';
  
  -- Show config breakdown by provider
  RAISE NOTICE 'Config breakdown by provider:';
  FOR rec IN (
    SELECT 
      provider_key,
      COUNT(*) as total,
      SUM(CASE WHEN enabled THEN 1 ELSE 0 END) as enabled_count
    FROM tenant_payroll_config
    GROUP BY provider_key
    ORDER BY provider_key
  ) LOOP
    RAISE NOTICE '  % : % total (% enabled)', rec.provider_key, rec.total, rec.enabled_count;
  END LOOP;
END $$;

-- =====================================================
-- USAGE NOTES
-- =====================================================

/*

This migration inserts default configs for 5 providers:

1. Commission (enabled)
   - Fixed 120k/session
   - Most common for spas

2. KPI (disabled)
   - 30 sessions → 1M bonus
   - Tenants can enable if needed

3. Attendance (enabled)
   - Penalties for late/absent
   - 15min grace period

4. Rating (disabled)
   - ≥4.5 stars → 50k bonus
   - Not all spas use this

5. Bonus (disabled)
   - Manual assignment only
   - No auto strategy

Tenants can customize via Settings UI:
- Change rates (120k → 150k)
- Enable/disable providers
- Switch strategies (fixed → tier)
- Add/remove providers

Next steps:
- Build Settings UI for admin to manage configs
- Refactor providers to read from config
- Test with different tenant configs

*/

-- =====================================================
-- ROLLBACK INSTRUCTIONS
-- =====================================================

/*

To rollback this migration:

-- Delete auto-generated configs
DELETE FROM tenant_payroll_config
WHERE notes LIKE '%(auto-generated)%';

-- Or delete all configs (dangerous!)
-- DELETE FROM tenant_payroll_config;

*/
