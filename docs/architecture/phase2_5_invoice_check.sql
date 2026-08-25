-- Check what finance_invoices exist for orphan tenants
WITH orphan_tenants AS (
    SELECT DISTINCT fcm.tenant_id
    FROM finance_cash_movements fcm
    LEFT JOIN finance_transactions ft 
        ON fcm.f1_transaction_id = ft.id 
        AND fcm.tenant_id = ft.tenant_id
    WHERE ft.id IS NULL
)
SELECT 
    fi.id,
    fi.tenant_id,
    fi.invoice_number,
    fi.status,
    fi.created_at,
    t.name as tenant_name,
    COUNT(*) OVER () as total_invoices
FROM orphan_tenants ot
INNER JOIN finance_invoices fi ON ot.tenant_id = fi.tenant_id
INNER JOIN tenants t ON ot.tenant_id = t.id
ORDER BY fi.created_at
LIMIT 10;
