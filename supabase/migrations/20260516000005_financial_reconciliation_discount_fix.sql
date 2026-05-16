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
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'booking_id', b.id,
            'customer_name', COALESCE(c.name_mother, c.full_name, 'Khách hàng'),
            'package_name', b.package_name,
            'full_price', b.full_price,
            'total_paid', COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = b.id AND status = 'confirmed'), 0),
            'debt', (b.full_price * (1 - COALESCE(b.discount_percent, 0) / 100.0)) - COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = b.id AND status = 'confirmed'), 0)
        )
    ), '[]'::jsonb)
    INTO v_debts
    FROM public.bookings b
    JOIN public.customers c ON b.customer_id = c.id
    WHERE b.tenant_id = p_tenant_id 
      AND b.status NOT IN ('cancelled', 'inquiry')
      AND COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = b.id AND status = 'confirmed'), 0) < (b.full_price * (1 - COALESCE(b.discount_percent, 0) / 100.0));

    -- 2. Khoản Thu Bị Treo (Orphaned Revenue)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'revenue_id', r.id,
            'amount', r.amount,
            'received_date', COALESCE(r.received_date, r.revenue_date),
            'notes', r.notes,
            'revenue_type', r.revenue_type
        )
    ), '[]'::jsonb)
    INTO v_orphans
    FROM public.revenue r
    WHERE r.tenant_id = p_tenant_id 
      AND r.booking_id IS NULL;

    -- 3. Chênh Lệch Giá Trị (Mismatch Alerts)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'booking_id', b.id,
            'customer_name', COALESCE(c.name_mother, c.full_name, 'Khách hàng'),
            'package_name', b.package_name,
            'full_price', b.full_price,
            'total_paid', COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = b.id AND status = 'confirmed'), 0),
            'mismatch', COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = b.id AND status = 'confirmed'), 0) - (b.full_price * (1 - COALESCE(b.discount_percent, 0) / 100.0))
        )
    ), '[]'::jsonb)
    INTO v_mismatches
    FROM public.bookings b
    JOIN public.customers c ON b.customer_id = c.id
    WHERE b.tenant_id = p_tenant_id 
      AND b.status != 'cancelled'
      AND COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = b.id AND status = 'confirmed'), 0) > (b.full_price * (1 - COALESCE(b.discount_percent, 0) / 100.0));

    RETURN jsonb_build_object(
        'debt_alerts', v_debts,
        'orphaned_revenue', v_orphans,
        'mismatch_alerts', v_mismatches
    );
END;
$$;
