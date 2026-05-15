-- ==========================================
-- TÍNH NĂNG ĐỐI SOÁT TÀI CHÍNH (FINANCIAL RECONCILIATION)
-- Mốc 1: Tạo RPC phát hiện sai lệch dữ liệu tài chính
-- ==========================================

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
    -- Tìm các booking có tổng số tiền đã thu (trong revenue) < giá trị gói (full_price)
    -- Chỉ tính các booking đang diễn ra hoặc đã hoàn thành, bỏ qua inquiry và cancelled
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'booking_id', b.id,
            'customer_name', COALESCE(c.name_mother, c.full_name, 'Khách hàng'),
            'package_name', b.package_name,
            'full_price', b.full_price,
            'total_paid', COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = b.id), 0),
            'debt', b.full_price - COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = b.id), 0)
        )
    ), '[]'::jsonb)
    INTO v_debts
    FROM public.bookings b
    JOIN public.customers c ON b.customer_id = c.id
    WHERE b.tenant_id = p_tenant_id 
      AND b.status NOT IN ('cancelled', 'inquiry')
      AND COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = b.id), 0) < b.full_price;

    -- 2. Khoản Thu Bị Treo (Orphaned Revenue)
    -- Tìm các bản ghi doanh thu không được gắn với bất kỳ booking nào
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
    -- Tìm các booking có tổng số tiền đã thu > giá trị gói (full_price)
    SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
            'booking_id', b.id,
            'customer_name', COALESCE(c.name_mother, c.full_name, 'Khách hàng'),
            'package_name', b.package_name,
            'full_price', b.full_price,
            'total_paid', COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = b.id), 0),
            'mismatch', COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = b.id), 0) - b.full_price
        )
    ), '[]'::jsonb)
    INTO v_mismatches
    FROM public.bookings b
    JOIN public.customers c ON b.customer_id = c.id
    WHERE b.tenant_id = p_tenant_id 
      AND b.status != 'cancelled'
      AND COALESCE((SELECT SUM(amount) FROM public.revenue WHERE booking_id = b.id), 0) > b.full_price;

    RETURN jsonb_build_object(
        'debt_alerts', v_debts,
        'orphaned_revenue', v_orphans,
        'mismatch_alerts', v_mismatches
    );
END;
$$;
