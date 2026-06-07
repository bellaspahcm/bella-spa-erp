-- Add business idempotency for manual remaining-payment collection.
-- A retry/double-submit with the same manual_payment_idempotency_key must not
-- create another revenue row or another accounting outbox event.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.revenue
    WHERE COALESCE(accounting_metadata->>'manual_payment_idempotency_key', '') <> ''
    GROUP BY tenant_id, accounting_metadata->>'manual_payment_idempotency_key'
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot install manual payment idempotency: duplicate manual payment keys exist in revenue.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_revenue_manual_payment_idempotency_key
ON public.revenue (tenant_id, (accounting_metadata->>'manual_payment_idempotency_key'))
WHERE COALESCE(accounting_metadata->>'manual_payment_idempotency_key', '') <> '';

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
    v_existing_revenue public.revenue%ROWTYPE;
    v_target_price NUMERIC := 0;
    v_current_debt NUMERIC := 0;
    v_new_total_paid NUMERIC := 0;
    v_new_status TEXT;
    v_revenue_id UUID;
    v_revenue_status TEXT;
    v_note TEXT;
    v_outbox_payload JSONB;
    v_outbox_id UUID;
    v_accounting_metadata JSONB;
    v_payment_key TEXT;
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

    v_accounting_metadata := COALESCE(p_accounting_metadata, '{}'::JSONB);
    v_payment_key := NULLIF(v_accounting_metadata->>'manual_payment_idempotency_key', '');

    IF v_payment_key IS NOT NULL THEN
        SELECT *
        INTO v_existing_revenue
        FROM public.revenue
        WHERE tenant_id = v_booking.tenant_id
          AND booking_id = p_booking_id
          AND accounting_metadata->>'manual_payment_idempotency_key' = v_payment_key
        LIMIT 1;

        IF v_existing_revenue.id IS NOT NULL THEN
            IF ABS(COALESCE(v_existing_revenue.amount, 0) - p_amount) > 0.01 THEN
                RAISE EXCEPTION 'Manual payment idempotency key % is already used for a different amount.', v_payment_key;
            END IF;

            IF v_existing_revenue.status = 'confirmed' THEN
                v_outbox_payload := CASE
                    WHEN COALESCE(p_outbox_payload, '{}'::JSONB) = '{}'::JSONB THEN JSONB_BUILD_OBJECT(
                        'totalAmount', v_existing_revenue.amount,
                        'vatRate', 0,
                        'description', COALESCE(v_existing_revenue.notes, 'Manual remaining payment.'),
                        'branchId', v_booking.tenant_id,
                        'idempotencyKey', v_payment_key
                    )
                    ELSE p_outbox_payload
                END;

                v_outbox_id := public.enqueue_accounting_event(
                    v_booking.tenant_id,
                    'PACKAGE_SALE',
                    'REVENUE',
                    v_existing_revenue.id,
                    v_outbox_payload
                );

                IF v_outbox_id IS NULL THEN
                    RAISE EXCEPTION 'Failed to enqueue accounting outbox event for existing revenue %.', v_existing_revenue.id;
                END IF;
            END IF;

            RETURN JSONB_BUILD_OBJECT(
                'booking_id', p_booking_id,
                'revenue_id', v_existing_revenue.id,
                'booking_status', v_booking.status,
                'deposit_amount', v_booking.deposit_amount,
                'revenue_status', v_existing_revenue.status,
                'idempotent', TRUE,
                'outbox_id', v_outbox_id
            );
        END IF;
    END IF;

    v_target_price := COALESCE(v_booking.full_price, 0) * (1 - COALESCE(v_booking.discount_percent, 0) / 100);
    v_current_debt := v_target_price - COALESCE(v_booking.deposit_amount, 0);

    IF p_amount > v_current_debt THEN
        RAISE EXCEPTION 'Payment amount exceeds remaining booking debt (%).', v_current_debt;
    END IF;

    PERFORM public.ensure_open_period(v_booking.tenant_id, p_received_date);

    v_note := COALESCE(NULLIF(p_notes, ''), 'Manual remaining payment.');
    v_revenue_status := COALESCE(NULLIF(p_status, ''), 'pending');

    BEGIN
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
            v_accounting_metadata
        )
        RETURNING id INTO v_revenue_id;
    EXCEPTION WHEN unique_violation THEN
        IF v_payment_key IS NOT NULL THEN
            SELECT *
            INTO v_existing_revenue
            FROM public.revenue
            WHERE tenant_id = v_booking.tenant_id
              AND booking_id = p_booking_id
              AND accounting_metadata->>'manual_payment_idempotency_key' = v_payment_key
            LIMIT 1;

            IF v_existing_revenue.id IS NOT NULL THEN
                IF v_existing_revenue.status = 'confirmed' THEN
                    v_outbox_payload := CASE
                        WHEN COALESCE(p_outbox_payload, '{}'::JSONB) = '{}'::JSONB THEN JSONB_BUILD_OBJECT(
                            'totalAmount', v_existing_revenue.amount,
                            'vatRate', 0,
                            'description', COALESCE(v_existing_revenue.notes, 'Manual remaining payment.'),
                            'branchId', v_booking.tenant_id,
                            'idempotencyKey', v_payment_key
                        )
                        ELSE p_outbox_payload
                    END;

                    v_outbox_id := public.enqueue_accounting_event(
                        v_booking.tenant_id,
                        'PACKAGE_SALE',
                        'REVENUE',
                        v_existing_revenue.id,
                        v_outbox_payload
                    );

                    IF v_outbox_id IS NULL THEN
                        RAISE EXCEPTION 'Failed to enqueue accounting outbox event for raced revenue %.', v_existing_revenue.id;
                    END IF;
                END IF;

                RETURN JSONB_BUILD_OBJECT(
                    'booking_id', p_booking_id,
                    'revenue_id', v_existing_revenue.id,
                    'booking_status', v_booking.status,
                    'deposit_amount', v_booking.deposit_amount,
                    'revenue_status', v_existing_revenue.status,
                    'idempotent', TRUE,
                    'outbox_id', v_outbox_id
                );
            END IF;
        END IF;

        RAISE;
    END;

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
            WHEN COALESCE(p_outbox_payload, '{}'::JSONB) = '{}'::JSONB THEN JSONB_BUILD_OBJECT(
                'totalAmount', p_amount,
                'vatRate', 0,
                'description', v_note,
                'branchId', v_booking.tenant_id,
                'idempotencyKey', v_payment_key
            )
            ELSE p_outbox_payload
        END;

        v_outbox_id := public.enqueue_accounting_event(
            v_booking.tenant_id,
            'PACKAGE_SALE',
            'REVENUE',
            v_revenue_id,
            v_outbox_payload
        );

        IF v_outbox_id IS NULL THEN
            RAISE EXCEPTION 'Failed to enqueue accounting outbox event for revenue %.', v_revenue_id;
        END IF;
    END IF;

    RETURN JSONB_BUILD_OBJECT(
        'booking_id', p_booking_id,
        'revenue_id', v_revenue_id,
        'booking_status', v_new_status,
        'deposit_amount', v_new_total_paid,
        'revenue_status', v_revenue_status,
        'idempotent', FALSE,
        'outbox_id', v_outbox_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.record_remaining_payment_atomic(
    UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, JSONB, JSONB
) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

COMMIT;
