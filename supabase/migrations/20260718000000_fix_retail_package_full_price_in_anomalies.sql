-- Fix: get_financial_anomalies now computes effective_price for retail packages.
-- Retail package = package with total_sessions = 1 (đơn giá per session).
-- For such bookings: effective_full_price = unit_price × paid_sessions
-- where paid_sessions = b.total_sessions - COALESCE(b.metadata->>'gift_sessions', '0')::int
-- This ensures debt_alerts and mismatch_alerts reflect the correct booking value.

CREATE OR REPLACE FUNCTION public.get_financial_anomalies(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_debts JSONB := '[]'::JSONB;
    v_orphans JSONB := '[]'::JSONB;
    v_mismatches JSONB := '[]'::JSONB;
BEGIN
    -- 1. Cảnh báo Công nợ (Debt Alerts)
    -- Dùng effective_price = unit_price * paid_sessions cho gói lẻ (package.total_sessions = 1)
    WITH booking_effective_price AS (
        SELECT
            b.id,
            b.customer_id,
            b.package_name,
            b.full_price,
            b.discount_percent,
            b.total_sessions,
            b.metadata,
            b.status,
            CASE
                WHEN p.total_sessions = 1
                     AND b.total_sessions > 1
                THEN
                    p.price * GREATEST(1,
                        b.total_sessions
                        - COALESCE((b.metadata->>'gift_sessions')::int, 0)
                    )
                ELSE b.full_price
            END AS effective_full_price
        FROM public.bookings b
        LEFT JOIN public.packages p ON b.package_id = p.id
        WHERE b.tenant_id = p_tenant_id
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'booking_id', bep.id,
            'customer_name', COALESCE(c.name_mother, c.name_baby, 'Khach hang'),
            'package_name', bep.package_name,
            'full_price', bep.effective_full_price,
            'total_paid', COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = bep.id AND status = 'confirmed'), 0),
            'debt', (bep.effective_full_price * (1 - COALESCE(bep.discount_percent, 0) / 100.0))
                   - COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = bep.id AND status = 'confirmed'), 0)
        )
    ), '[]'::jsonb)
    INTO v_debts
    FROM booking_effective_price bep
    JOIN public.customers c ON bep.customer_id = c.id
    WHERE bep.status NOT IN ('cancelled', 'inquiry')
      AND COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = bep.id AND status = 'confirmed'), 0)
          < (bep.effective_full_price * (1 - COALESCE(bep.discount_percent, 0) / 100.0));

    -- 2. Khoản Thu Bị Treo (Orphaned Revenue) - không thay đổi
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'revenue_id', r.id,
            'amount', r.amount,
            'received_date', r.received_date,
            'notes', r.notes,
            'revenue_type', r.revenue_type
        )
    ), '[]'::jsonb)
    INTO v_orphans
    FROM public.revenue r
    WHERE r.tenant_id = p_tenant_id 
      AND r.booking_id IS NULL;

    -- 3. Chênh Lệch Giá Trị (Mismatch Alerts)
    WITH booking_effective_price AS (
        SELECT
            b.id,
            b.customer_id,
            b.package_name,
            b.full_price,
            b.discount_percent,
            b.total_sessions,
            b.metadata,
            b.status,
            CASE
                WHEN p.total_sessions = 1
                     AND b.total_sessions > 1
                THEN
                    p.price * GREATEST(1,
                        b.total_sessions
                        - COALESCE((b.metadata->>'gift_sessions')::int, 0)
                    )
                ELSE b.full_price
            END AS effective_full_price
        FROM public.bookings b
        LEFT JOIN public.packages p ON b.package_id = p.id
        WHERE b.tenant_id = p_tenant_id
    )
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'booking_id', bep.id,
            'customer_name', COALESCE(c.name_mother, c.name_baby, 'Khach hang'),
            'package_name', bep.package_name,
            'full_price', bep.effective_full_price,
            'total_paid', COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = bep.id AND status = 'confirmed'), 0),
            'mismatch', COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = bep.id AND status = 'confirmed'), 0)
                       - (bep.effective_full_price * (1 - COALESCE(bep.discount_percent, 0) / 100.0)),
            'customer_id', bep.customer_id
        )
    ), '[]'::jsonb)
    INTO v_mismatches
    FROM booking_effective_price bep
    JOIN public.customers c ON bep.customer_id = c.id
    WHERE bep.status != 'cancelled'
      AND COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = bep.id AND status = 'confirmed'), 0)
          > (bep.effective_full_price * (1 - COALESCE(bep.discount_percent, 0) / 100.0));

    RETURN jsonb_build_object(
        'debt_alerts', v_debts,
        'orphaned_revenue', v_orphans,
        'mismatch_alerts', v_mismatches
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_anomalies(UUID) TO authenticated, service_role;
