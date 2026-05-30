-- Atomic remaining-payment recording.
-- Keeps revenue insert, booking balance/status update, audit log, and accounting outbox
-- in one database transaction.

CREATE OR REPLACE FUNCTION public.record_remaining_payment_atomic(
    p_booking_id UUID,
    p_amount NUMERIC,
    p_payment_method TEXT,
    p_received_date DATE,
    p_status TEXT DEFAULT 'pending',
    p_revenue_type TEXT DEFAULT 'remaining_payment',
    p_notes TEXT DEFAULT NULL,
    p_receipt_url TEXT DEFAULT NULL,
    p_actor_id UUID DEFAULT NULL,
    p_business_event_type TEXT DEFAULT NULL,
    p_accounting_review_status TEXT DEFAULT 'NEEDS_REVIEW',
    p_accounting_metadata JSONB DEFAULT '{}'::JSONB,
    p_outbox_payload JSONB DEFAULT '{}'::JSONB
) RETURNS JSONB AS $$
DECLARE
    v_booking public.bookings%ROWTYPE;
    v_target_price NUMERIC := 0;
    v_current_debt NUMERIC := 0;
    v_new_total_paid NUMERIC := 0;
    v_new_status TEXT;
    v_revenue_id UUID;
    v_revenue_status TEXT;
    v_note TEXT;
    v_outbox_payload JSONB;
BEGIN
    SELECT *
    INTO v_booking
    FROM public.bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF v_booking.id IS NULL THEN
        RAISE EXCEPTION 'Booking % not found.', p_booking_id;
    END IF;

    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Payment amount must be greater than 0.';
    END IF;

    v_target_price := COALESCE(v_booking.full_price, 0) * (1 - COALESCE(v_booking.discount_percent, 0) / 100);
    v_current_debt := v_target_price - COALESCE(v_booking.deposit_amount, 0);

    IF p_amount > v_current_debt THEN
        RAISE EXCEPTION 'Payment amount exceeds remaining booking debt (%).', v_current_debt;
    END IF;

    PERFORM public.ensure_open_period(v_booking.tenant_id, p_received_date);

    v_note := COALESCE(NULLIF(p_notes, ''), 'Thanh toán nốt phần còn lại.');
    v_revenue_status := COALESCE(NULLIF(p_status, ''), 'pending');

    INSERT INTO public.revenue (
        booking_id,
        amount,
        revenue_type,
        payment_method,
        received_date,
        status,
        notes,
        receipt_url,
        tenant_id,
        business_event_type,
        accounting_review_status,
        accounting_metadata
    ) VALUES (
        p_booking_id,
        p_amount,
        COALESCE(NULLIF(p_revenue_type, ''), 'remaining_payment'),
        p_payment_method,
        p_received_date,
        v_revenue_status,
        v_note,
        p_receipt_url,
        v_booking.tenant_id,
        p_business_event_type,
        p_accounting_review_status,
        p_accounting_metadata
    )
    RETURNING id INTO v_revenue_id;

    v_new_total_paid := COALESCE(v_booking.deposit_amount, 0) + p_amount;
    v_new_status := v_booking.status;

    IF v_new_total_paid >= v_target_price
       AND v_booking.status IN ('deposit_pending', 'deposit') THEN
        v_new_status := 'booked';
    END IF;

    UPDATE public.bookings
    SET deposit_amount = v_new_total_paid,
        status = v_new_status,
        updated_at = NOW()
    WHERE id = p_booking_id;

    IF v_revenue_status = 'confirmed' OR v_new_status = 'booked' THEN
        UPDATE public.revenue
        SET status = 'confirmed'
        WHERE booking_id = p_booking_id
          AND status = 'pending';
        v_revenue_status := 'confirmed';
    END IF;

    INSERT INTO public.audit_logs (
        action,
        table_name,
        record_id,
        old_data,
        new_data,
        tenant_id,
        changed_by_id
    ) VALUES (
        'UPDATE',
        'bookings',
        p_booking_id,
        TO_JSONB(v_booking),
        JSONB_BUILD_OBJECT('deposit_amount', v_new_total_paid, 'status', v_new_status),
        v_booking.tenant_id,
        p_actor_id
    );

    IF v_revenue_status = 'confirmed' THEN
        v_outbox_payload := CASE
            WHEN p_outbox_payload = '{}'::JSONB THEN JSONB_BUILD_OBJECT(
                'totalAmount', p_amount,
                'vatRate', 0,
                'description', v_note,
                'branchId', v_booking.tenant_id
            )
            ELSE p_outbox_payload
        END;

        INSERT INTO public.accounting_outbox (
            tenant_id,
            event_type,
            reference_type,
            reference_id,
            payload
        ) VALUES (
            v_booking.tenant_id,
            'PACKAGE_SALE',
            'REVENUE',
            v_revenue_id,
            v_outbox_payload
        )
        ON CONFLICT (event_type, reference_id) DO NOTHING;
    END IF;

    RETURN JSONB_BUILD_OBJECT(
        'booking_id', p_booking_id,
        'revenue_id', v_revenue_id,
        'booking_status', v_new_status,
        'deposit_amount', v_new_total_paid,
        'revenue_status', v_revenue_status
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.record_remaining_payment_atomic(
    UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, JSONB, JSONB
) TO authenticated, service_role;
