-- PHASE 2.5: Source ID Verification
-- Check if 18 orphan source_ids exist in business domain tables

-- Get the 18 orphan source_ids
WITH orphan_sources AS (
    SELECT DISTINCT
        fcm.source_id::uuid as source_uuid,
        fcm.source_type,
        fcm.id as movement_id
    FROM finance_cash_movements fcm
    LEFT JOIN finance_transactions ft 
        ON fcm.f1_transaction_id = ft.id 
        AND fcm.tenant_id = ft.tenant_id
    WHERE ft.id IS NULL
)
-- Check various business domain tables
SELECT 
    os.source_uuid,
    os.source_type,
    CASE 
        WHEN fi.id IS NOT NULL THEN 'FOUND_IN_FINANCE_INVOICES'
        ELSE NULL
    END as invoice_status,
    CASE 
        WHEN b.id IS NOT NULL THEN 'FOUND_IN_BOOKINGS'
        ELSE NULL
    END as booking_status,
    CASE 
        WHEN reb.id IS NOT NULL THEN 'FOUND_IN_RE_BOOKINGS'
        ELSE NULL
    END as re_booking_status,
    CASE 
        WHEN ab.id IS NOT NULL THEN 'FOUND_IN_AUTO_BOOKINGS'
        ELSE NULL
    END as auto_booking_status,
    CASE 
        WHEN stp.id IS NOT NULL THEN 'FOUND_IN_STUDENT_TUITION_PAYMENTS'
        ELSE NULL
    END as student_payment_status,
    CASE 
        WHEN fi.id IS NULL 
            AND b.id IS NULL 
            AND reb.id IS NULL 
            AND ab.id IS NULL 
            AND stp.id IS NULL 
        THEN 'NOT_FOUND_IN_ANY_BUSINESS_TABLE'
        ELSE 'FOUND'
    END as overall_status
FROM orphan_sources os
LEFT JOIN finance_invoices fi ON os.source_uuid = fi.id
LEFT JOIN bookings b ON os.source_uuid = b.id
LEFT JOIN re_bookings reb ON os.source_uuid = reb.id
LEFT JOIN auto_bookings ab ON os.source_uuid = ab.id
LEFT JOIN student_tuition_payments stp ON os.source_uuid = stp.id
ORDER BY os.source_uuid;
