-- PHASE 2.5: Business Domain Check
-- Check if business domain tables exist for source_id verification

-- Check for payment/business domain tables
SELECT 
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
    AND (
        table_name LIKE '%payment%'
        OR table_name LIKE '%invoice%'
        OR table_name LIKE '%booking%'
        OR table_name LIKE '%transaction%'
        OR table_name LIKE '%order%'
    )
ORDER BY table_name;
