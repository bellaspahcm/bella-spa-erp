-- ============================================
-- REAL ESTATE MODULE DEPLOYMENT
-- Timestamp: 2026-08-02 15:00:00
-- ============================================

-- This script deploys ONLY Real Estate migrations
-- Skips conflicting 20260622 migrations

\echo '🚀 Starting Real Estate module deployment...'
\echo ''

-- ============================================
-- MIGRATION: 20260802150000_real_estate_core_schema.sql
-- ============================================
\echo '📦 Deploying Real Estate core schema...'

-- Read and execute the core schema migration
\i supabase/migrations/20260802150000_real_estate_core_schema.sql

\echo '✓ Core schema deployed'
\echo ''

-- ============================================
-- MIGRATION: 20260802151000_real_estate_rpc_functions.sql
-- ============================================
\echo '⚙️  Deploying Real Estate RPC functions...'

-- Read and execute the RPC functions migration
\i supabase/migrations/20260802151000_real_estate_rpc_functions.sql

\echo '✓ RPC functions deployed'
\echo ''

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
\echo '🔍 Verifying deployment...'
\echo ''

-- Check tables exist
SELECT 
  'real_estate_properties' as table_name,
  COUNT(*) as exists
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'real_estate_properties'
UNION ALL
SELECT 'real_estate_units', COUNT(*)
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'real_estate_units'
UNION ALL
SELECT 'real_estate_leads', COUNT(*)
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name = 'real_estate_leads';

-- Check RPCs exist
SELECT 
  routine_name as rpc_name
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name LIKE 'rpc_real_estate%'
ORDER BY routine_name;

\echo ''
\echo '✅ Real Estate module deployment complete!'
\echo ''
\echo 'Next steps:'
\echo '1. Run seed data: \\i scripts/seed-real-estate-demo.sql'
\echo '2. Test application: npm run dev'
\echo '3. Verify UI: http://localhost:3000/dashboard/real-estate'
