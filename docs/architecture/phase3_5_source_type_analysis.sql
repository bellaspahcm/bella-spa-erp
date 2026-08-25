-- Source type distribution for backfill policy
SELECT 
    source_type,
    COUNT(*) as f1_count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM finance_transactions
WHERE status = 'POSTED'
GROUP BY source_type
ORDER BY f1_count DESC;
