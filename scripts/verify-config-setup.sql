-- =====================================================
-- VERIFY CONFIGURATION SYSTEM SETUP
-- =====================================================
-- Purpose: Check if configuration system is properly set up
-- Usage: Run this query in Supabase SQL Editor
-- =====================================================

-- =====================================================
-- 1. Check if tables exist
-- =====================================================

SELECT 
  'tenant_payroll_config' as table_name,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'tenant_payroll_config'
  ) as exists
UNION ALL
SELECT 
  'tenant_payroll_config_history' as table_name,
  EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'tenant_payroll_config_history'
  ) as exists;

-- =====================================================
-- 2. Count tenants
-- =====================================================

SELECT 
  'Total tenants' as metric,
  COUNT(*)::TEXT as value
FROM tenants;

-- =====================================================
-- 3. Count configs
-- =====================================================

SELECT 
  'Total configs' as metric,
  COUNT(*)::TEXT as value
FROM tenant_payroll_config
UNION ALL
SELECT 
  'Expected configs (5 providers × N tenants)' as metric,
  (5 * (SELECT COUNT(*) FROM tenants))::TEXT as value;

-- =====================================================
-- 4. Config breakdown by provider
-- =====================================================

SELECT 
  provider_key,
  COUNT(*) as total_configs,
  SUM(CASE WHEN enabled THEN 1 ELSE 0 END) as enabled_count,
  SUM(CASE WHEN enabled THEN 0 ELSE 1 END) as disabled_count
FROM tenant_payroll_config
GROUP BY provider_key
ORDER BY provider_key;

-- =====================================================
-- 5. Sample config for each provider
-- =====================================================

SELECT 
  provider_key,
  enabled,
  strategy,
  config
FROM tenant_payroll_config
WHERE provider_key IN ('commission', 'kpi', 'attendance', 'rating', 'bonus')
LIMIT 1 -- Change to see all: LIMIT 100
OFFSET 0;

-- =====================================================
-- 6. Check history table
-- =====================================================

SELECT 
  'Total history records' as metric,
  COUNT(*)::TEXT as value
FROM tenant_payroll_config_history;

-- =====================================================
-- 7. Check RLS policies
-- =====================================================

SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE tablename IN ('tenant_payroll_config', 'tenant_payroll_config_history')
ORDER BY tablename, policyname;

-- =====================================================
-- 8. Check triggers
-- =====================================================

SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_timing
FROM information_schema.triggers
WHERE event_object_table IN ('tenant_payroll_config', 'tenant_payroll_config_history')
ORDER BY event_object_table, trigger_name;

-- =====================================================
-- 9. Test query: Get all configs for first tenant
-- =====================================================

WITH first_tenant AS (
  SELECT id, name FROM tenants LIMIT 1
)
SELECT 
  t.name as tenant_name,
  c.provider_key,
  c.enabled,
  c.strategy,
  c.config,
  c.version,
  c.updated_at
FROM first_tenant t
LEFT JOIN tenant_payroll_config c ON c.tenant_id = t.id
ORDER BY c.provider_key;

-- =====================================================
-- 10. Summary report
-- =====================================================

WITH stats AS (
  SELECT 
    (SELECT COUNT(*) FROM tenants) as tenant_count,
    (SELECT COUNT(*) FROM tenant_payroll_config) as config_count,
    (SELECT COUNT(*) FROM tenant_payroll_config WHERE enabled = true) as enabled_count,
    (SELECT COUNT(*) FROM tenant_payroll_config_history) as history_count
)
SELECT 
  '═══════════════════════════════════════════' as separator,
  'CONFIGURATION SYSTEM STATUS' as title,
  '═══════════════════════════════════════════' as separator
UNION ALL
SELECT 
  'Tenants:',
  tenant_count::TEXT,
  ''
FROM stats
UNION ALL
SELECT 
  'Total configs:',
  config_count::TEXT,
  ''
FROM stats
UNION ALL
SELECT 
  'Expected configs:',
  (tenant_count * 5)::TEXT || ' (5 providers × ' || tenant_count::TEXT || ' tenants)',
  ''
FROM stats
UNION ALL
SELECT 
  'Enabled configs:',
  enabled_count::TEXT,
  ''
FROM stats
UNION ALL
SELECT 
  'History records:',
  history_count::TEXT,
  ''
FROM stats
UNION ALL
SELECT 
  'Status:',
  CASE 
    WHEN config_count >= tenant_count * 5 THEN '✅ ALL CONFIGS PRESENT'
    WHEN config_count > 0 THEN '⚠️ SOME CONFIGS MISSING'
    ELSE '❌ NO CONFIGS FOUND'
  END,
  ''
FROM stats
UNION ALL
SELECT 
  '═══════════════════════════════════════════',
  '',
  '';
