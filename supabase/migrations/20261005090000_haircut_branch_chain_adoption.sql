-- ============================================================================
-- Haircut Branch Chain Adoption
-- ============================================================================
-- Scope: bella_haircut operational records only.
-- Purpose:
--   - Persist Platform Org Unit branch ownership on Haircut booking/session/payment
--     records.
--   - Enforce branch access for Haircut tenants through user_org_unit_access.
--   - Preserve legacy tenant-scoped behavior for non-Haircut tenants.
--   - Do not backfill branch_id for historical records without deterministic branch
--     ownership evidence.
-- ============================================================================

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS branch_id UUID;

ALTER TABLE public.revenue
  ADD COLUMN IF NOT EXISTS branch_id UUID;

ALTER TABLE public.session_logs
  ADD COLUMN IF NOT EXISTS branch_id UUID;

ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS branch_id UUID;

ALTER TABLE public.salary_records
  ADD COLUMN IF NOT EXISTS branch_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_branch_id_fkey'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.org_units(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'revenue_branch_id_fkey'
  ) THEN
    ALTER TABLE public.revenue
      ADD CONSTRAINT revenue_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.org_units(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'session_logs_branch_id_fkey'
  ) THEN
    ALTER TABLE public.session_logs
      ADD CONSTRAINT session_logs_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.org_units(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'attendance_branch_id_fkey'
  ) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.org_units(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'salary_records_branch_id_fkey'
  ) THEN
    ALTER TABLE public.salary_records
      ADD CONSTRAINT salary_records_branch_id_fkey
      FOREIGN KEY (branch_id) REFERENCES public.org_units(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_tenant_branch
  ON public.bookings (tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_revenue_tenant_branch
  ON public.revenue (tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_session_logs_tenant_branch
  ON public.session_logs (tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_attendance_tenant_branch
  ON public.attendance (tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_salary_records_tenant_branch
  ON public.salary_records (tenant_id, branch_id);

CREATE OR REPLACE FUNCTION public.haircut_branch_access_allowed(
  p_tenant_id UUID,
  p_branch_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    NOT EXISTS (
      SELECT 1
      FROM public.tenants t
      WHERE t.id = p_tenant_id
        AND t.product_key = 'bella_haircut'
    )
    OR (
      p_branch_id IS NOT NULL
      AND p_branch_id IN (
        SELECT access.org_unit_id
        FROM public.user_org_unit_access access
        WHERE access.user_id = COALESCE(
          auth.uid(),
          NULLIF(current_setting('app.current_user_id', TRUE), '')::UUID
        )
          AND access.tenant_id = COALESCE(
            public.get_auth_tenant_id(),
            NULLIF(current_setting('app.current_tenant_id', TRUE), '')::UUID
          )
          AND access.tenant_id = p_tenant_id
      )
    );
$$;

DROP POLICY IF EXISTS haircut_bookings_branch_guard ON public.bookings;
CREATE POLICY haircut_bookings_branch_guard
  ON public.bookings
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (public.haircut_branch_access_allowed(tenant_id, branch_id))
  WITH CHECK (public.haircut_branch_access_allowed(tenant_id, branch_id));

DROP POLICY IF EXISTS haircut_revenue_branch_guard ON public.revenue;
CREATE POLICY haircut_revenue_branch_guard
  ON public.revenue
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (public.haircut_branch_access_allowed(tenant_id, branch_id))
  WITH CHECK (public.haircut_branch_access_allowed(tenant_id, branch_id));

DROP POLICY IF EXISTS haircut_session_logs_branch_guard ON public.session_logs;
CREATE POLICY haircut_session_logs_branch_guard
  ON public.session_logs
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (public.haircut_branch_access_allowed(tenant_id, branch_id))
  WITH CHECK (public.haircut_branch_access_allowed(tenant_id, branch_id));

DROP POLICY IF EXISTS haircut_attendance_branch_guard ON public.attendance;
CREATE POLICY haircut_attendance_branch_guard
  ON public.attendance
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (public.haircut_branch_access_allowed(tenant_id, branch_id))
  WITH CHECK (public.haircut_branch_access_allowed(tenant_id, branch_id));

DROP POLICY IF EXISTS haircut_salary_records_branch_guard ON public.salary_records;
CREATE POLICY haircut_salary_records_branch_guard
  ON public.salary_records
  AS RESTRICTIVE
  FOR ALL
  TO public
  USING (public.haircut_branch_access_allowed(tenant_id, branch_id))
  WITH CHECK (public.haircut_branch_access_allowed(tenant_id, branch_id));

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
        branch_id,
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
        v_booking.branch_id,
        p_business_event_type,
        p_accounting_review_status,
        CASE
          WHEN v_booking.branch_id IS NULL THEN p_accounting_metadata
          ELSE p_accounting_metadata || JSONB_BUILD_OBJECT('branch_id', v_booking.branch_id)
        END
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
                'branchId', COALESCE(v_booking.branch_id, v_booking.tenant_id)
            )
            ELSE p_outbox_payload || JSONB_BUILD_OBJECT(
                'branchId',
                COALESCE(p_outbox_payload->>'branchId', v_booking.branch_id::TEXT, v_booking.tenant_id::TEXT)
            )
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
        ON CONFLICT (tenant_id, event_type, reference_type, reference_id) DO NOTHING;
    END IF;

    RETURN JSONB_BUILD_OBJECT(
        'booking_id', p_booking_id,
        'revenue_id', v_revenue_id,
        'booking_status', v_new_status,
        'deposit_amount', v_new_total_paid,
        'revenue_status', v_revenue_status,
        'branch_id', v_booking.branch_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.record_remaining_payment_atomic(
    UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, JSONB, JSONB
) TO authenticated, service_role;
