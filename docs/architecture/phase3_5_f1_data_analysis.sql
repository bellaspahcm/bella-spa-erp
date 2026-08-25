-- =============================================================================
-- PHASE 3.5: F1 TRANSACTION DATA ANALYSIS
-- Purpose: Analyze existing F1 transactions for backfill policy design
-- Date: 2026-08-24
-- Status: ANALYSIS ONLY (READ-ONLY queries)
-- =============================================================================

-- Query 1: Total F1 transaction count
SELECT 
    'Total F1 Transactions' as metric,
    COUNT(*) as count
FROM finance_transactions;

-- Query 2: F1 distribution by status
SELECT 
    'F1 by Status' as metric,
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM finance_transactions
GROUP BY status
ORDER BY count DESC;

-- Query 3: F1 distribution by source_type
SELECT 
    'F1 by Source Type' as metric,
    source_type,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM finance_transactions
WHERE status = 'POSTED'
GROUP BY source_type
ORDER BY count DESC;

-- Query 4: F1 posted_at distribution (check if NULL exists)
SELECT 
    'F1 posted_at Status' as metric,
    CASE 
        WHEN posted_at IS NULL THEN 'NULL'
        ELSE 'NOT NULL'
    END as posted_at_status,
    COUNT(*) as count
FROM finance_transactions
WHERE status = 'POSTED'
GROUP BY posted_at_status;

-- Query 5: F1 posted_at vs created_at correlation (are they similar?)
SELECT 
    'posted_at vs created_at Analysis' as metric,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE ABS(EXTRACT(EPOCH FROM (posted_at - created_at))) < 60) as within_1min,
    COUNT(*) FILTER (WHERE ABS(EXTRACT(EPOCH FROM (posted_at - created_at))) < 300) as within_5min,
    COUNT(*) FILTER (WHERE ABS(EXTRACT(EPOCH FROM (posted_at - created_at))) > 86400) as more_than_1day,
    ROUND(AVG(EXTRACT(EPOCH FROM (posted_at - created_at))) / 3600, 2) as avg_hours_diff
FROM finance_transactions
WHERE status = 'POSTED' 
  AND posted_at IS NOT NULL 
  AND created_at IS NOT NULL;

-- Query 6: Sample F1 transactions with source details
SELECT 
    'Sample F1 Records' as metric,
    id,
    source_type,
    source_id,
    status,
    posted_at,
    created_at,
    EXTRACT(EPOCH FROM (posted_at - created_at)) / 3600 as hours_diff
FROM finance_transactions
WHERE status = 'POSTED'
LIMIT 20;

-- Query 7: F1 source_type provenance check (do source records exist?)
-- (This requires knowledge of source tables per source_type)
-- Example for INVOICE source_type:
SELECT 
    'INVOICE Provenance Check' as metric,
    COUNT(DISTINCT ft.id) as f1_count,
    COUNT(DISTINCT fi.id) as source_found,
    COUNT(DISTINCT ft.id) - COUNT(DISTINCT fi.id) as orphan_count,
    ROUND(COUNT(DISTINCT fi.id) * 100.0 / NULLIF(COUNT(DISTINCT ft.id), 0), 2) as provenance_pct
FROM finance_transactions ft
LEFT JOIN finance_invoices fi 
    ON ft.source_id = fi.id::TEXT 
    AND ft.tenant_id = fi.tenant_id
WHERE ft.source_type = 'INVOICE'
  AND ft.status = 'POSTED';

-- Query 8: Check if finance_invoices has issue_date
SELECT 
    'Invoice Date Fields' as metric,
    COUNT(*) as total_invoices,
    COUNT(issue_date) as has_issue_date,
    ROUND(COUNT(issue_date) * 100.0 / COUNT(*), 2) as completeness_pct
FROM finance_invoices;

-- Query 9: F1 tenant distribution (test vs production)
SELECT 
    'F1 by Tenant' as metric,
    tenant_id,
    COUNT(*) as transaction_count
FROM finance_transactions
WHERE status = 'POSTED'
GROUP BY tenant_id
ORDER BY transaction_count DESC
LIMIT 10;

-- Query 10: F1 transaction_type distribution
SELECT 
    'F1 by Transaction Type' as metric,
    transaction_type,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM finance_transactions
WHERE status = 'POSTED'
GROUP BY transaction_type
ORDER BY count DESC;
