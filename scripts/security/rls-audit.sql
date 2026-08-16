-- =========================================================================
-- RLS Global Inventory Script
-- Purpose: Enumerate ALL RLS policies across ALL tables
-- Run: psql -f scripts/security/rls-audit.sql > docs/security/RLS_AUDIT_REPORT.txt
-- =========================================================================

\echo '========================================='
\echo 'RLS GLOBAL INVENTORY - SECURITY AUDIT'
\echo '========================================='
\echo ''

-- =========================================================================
-- 1. TABLES WITH RLS STATUS
-- =========================================================================
\echo '1. RLS STATUS BY TABLE'
\echo '---------------------'

SELECT 
    schemaname,
    tablename,
    CASE 
        WHEN rowsecurity THEN '✓ ENABLED'
        ELSE '✗ DISABLED'
    END as rls_status,
    CASE 
        WHEN rowsecurity AND EXISTS (
            SELECT 1 FROM pg_policies p 
            WHERE p.schemaname = t.schemaname 
            AND p.tablename = t.tablename
        ) THEN '✓ HAS POLICIES'
        WHEN rowsecurity THEN '⚠ NO POLICIES (BLOCKS ALL)'
        ELSE '✗ NO RLS'
    END as policy_status,
    -- Check if table has tenant_id column
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns c
            WHERE c.table_schema = t.schemaname
            AND c.table_name = t.tablename
            AND c.column_name = 'tenant_id'
        ) THEN '✓ HAS tenant_id'
        ELSE '✗ NO tenant_id'
    END as tenant_column
FROM pg_tables t
WHERE schemaname = 'public'
  AND tablename NOT LIKE 'pg_%'
  AND tablename NOT LIKE 'sql_%'
ORDER BY 
    CASE WHEN rowsecurity THEN 0 ELSE 1 END,
    tablename;

\echo ''
\echo '========================================='
\echo ''

-- =========================================================================
-- 2. ALL POLICIES WITH FULL DETAILS
-- =========================================================================
\echo '2. ALL POLICIES INVENTORY'
\echo '------------------------'

SELECT 
    schemaname as schema,
    tablename as table,
    policyname as policy,
    CASE cmd
        WHEN '*' THEN 'ALL'
        ELSE cmd
    END as command,
    roles::text as roles,
    CASE permissive
        WHEN 'PERMISSIVE' THEN 'PERMISSIVE'
        ELSE 'RESTRICTIVE'
    END as type,
    -- Highlight USING (true)
    CASE 
        WHEN qual = 'true'::text THEN '🚨 USING (true)'
        WHEN qual LIKE '%true%' THEN '⚠ CONTAINS true'
        ELSE LEFT(qual, 80)
    END as using_clause,
    -- Highlight WITH CHECK (true)
    CASE 
        WHEN with_check = 'true'::text THEN '🚨 WITH CHECK (true)'
        WHEN with_check LIKE '%true%' THEN '⚠ CONTAINS true'
        WHEN with_check IS NULL THEN '(none)'
        ELSE LEFT(with_check, 80)
    END as with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY 
    tablename,
    policyname;

\echo ''
\echo '========================================='
\echo ''

-- =========================================================================
-- 3. CRITICAL FINDINGS - USING (true) VIOLATIONS
-- =========================================================================
\echo '3. 🚨 CRITICAL: USING (true) VIOLATIONS'
\echo '--------------------------------------'

SELECT 
    tablename as "🚨 TABLE",
    policyname as "POLICY",
    CASE cmd WHEN '*' THEN 'ALL' ELSE cmd END as "COMMAND",
    roles::text as "ROLES",
    '⚠ BYPASS TENANT ISOLATION' as "SEVERITY"
FROM pg_policies
WHERE schemaname = 'public'
  AND qual = 'true'::text
ORDER BY tablename;

\echo ''
\echo '========================================='
\echo ''

-- =========================================================================
-- 4. CRITICAL FINDINGS - WITH CHECK (true) VIOLATIONS
-- =========================================================================
\echo '4. 🚨 CRITICAL: WITH CHECK (true) VIOLATIONS'
\echo '------------------------------------------'

SELECT 
    tablename as "🚨 TABLE",
    policyname as "POLICY",
    CASE cmd WHEN '*' THEN 'ALL' ELSE cmd END as "COMMAND",
    roles::text as "ROLES",
    '⚠ ALLOWS CROSS-TENANT WRITES' as "SEVERITY"
FROM pg_policies
WHERE schemaname = 'public'
  AND with_check = 'true'::text
ORDER BY tablename;

\echo ''
\echo '========================================='
\echo ''

-- =========================================================================
-- 5. TABLES WITH TENANT_ID BUT NO RLS
-- =========================================================================
\echo '5. ⚠ TABLES WITH tenant_id BUT NO RLS'
\echo '------------------------------------'

SELECT 
    t.tablename as "⚠ TABLE",
    '✓ HAS tenant_id' as "TENANT_COLUMN",
    '✗ NO RLS' as "RLS_STATUS",
    'P0 VIOLATION' as "SEVERITY"
FROM pg_tables t
WHERE t.schemaname = 'public'
  AND NOT t.rowsecurity
  AND EXISTS (
      SELECT 1 FROM information_schema.columns c
      WHERE c.table_schema = t.schemaname
      AND c.table_name = t.tablename
      AND c.column_name = 'tenant_id'
  )
ORDER BY t.tablename;

\echo ''
\echo '========================================='
\echo ''

-- =========================================================================
-- 6. HEALTHCARE TABLES AUDIT
-- =========================================================================
\echo '6. HEALTHCARE TABLES (hc_* prefix)'
\echo '---------------------------------'

SELECT 
    t.tablename as "TABLE",
    CASE WHEN t.rowsecurity THEN '✓' ELSE '✗' END as "RLS",
    COUNT(p.policyname) as "POLICIES",
    STRING_AGG(
        CASE 
            WHEN p.qual = 'true'::text THEN '🚨 USING(true)'
            WHEN p.with_check = 'true'::text THEN '🚨 WITH CHECK(true)'
            ELSE '✓ OK'
        END, 
        ', '
    ) as "STATUS"
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
WHERE t.schemaname = 'public'
  AND t.tablename LIKE 'hc_%'
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

\echo ''
\echo '========================================='
\echo ''

-- =========================================================================
-- 7. REAL ESTATE TABLES AUDIT
-- =========================================================================
\echo '7. REAL ESTATE TABLES (re_* / rm_* prefix)'
\echo '-----------------------------------------'

SELECT 
    t.tablename as "TABLE",
    CASE WHEN t.rowsecurity THEN '✓' ELSE '✗' END as "RLS",
    COUNT(p.policyname) as "POLICIES",
    STRING_AGG(
        CASE 
            WHEN p.qual = 'true'::text THEN '🚨 USING(true)'
            WHEN p.with_check = 'true'::text THEN '🚨 WITH CHECK(true)'
            ELSE '✓ OK'
        END, 
        ', '
    ) as "STATUS"
FROM pg_tables t
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = t.schemaname
WHERE t.schemaname = 'public'
  AND (t.tablename LIKE 're_%' OR t.tablename LIKE 'rm_%')
GROUP BY t.tablename, t.rowsecurity
ORDER BY t.tablename;

\echo ''
\echo '========================================='
\echo 'END OF AUDIT'
\echo '========================================='
