-- Check if the 18 orphan tenants have "Test Tenant F5" prefix
SELECT 
    t.id,
    t.name,
    t.status,
    CASE 
        WHEN t.name LIKE 'Test Tenant F5%' THEN 'TEST_TENANT_CONFIRMED'
        WHEN t.name IS NULL THEN 'NAME_NULL'
        ELSE 'NOT_TEST_TENANT'
    END as tenant_classification
FROM tenants t
WHERE t.id IN (
    SELECT DISTINCT fcm.tenant_id
    FROM finance_cash_movements fcm
    LEFT JOIN finance_transactions ft 
        ON fcm.f1_transaction_id = ft.id 
        AND fcm.tenant_id = ft.tenant_id
    WHERE ft.id IS NULL
)
ORDER BY t.name;
