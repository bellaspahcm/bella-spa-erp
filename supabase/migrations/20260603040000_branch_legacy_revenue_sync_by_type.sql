-- Branch legacy SIMPLE revenue sync by revenue_type.
-- This keeps historical sync aligned with runtime TT133 mappings:
-- package/deposit money -> 3387, direct service revenue -> 5113,
-- refunds -> debit 5113 and credit the payment account.

CREATE OR REPLACE FUNCTION public.sync_legacy_to_ledger_atomic(
    p_tenant_id UUID,
    p_created_by UUID DEFAULT NULL
)
RETURNS TABLE (
    synced_revenue_count INTEGER,
    synced_expense_count INTEGER,
    synced_salary_count INTEGER
) AS $$
DECLARE
    v_total_records INTEGER := 0;
    v_missing_business_event INTEGER := 0;
    v_needs_review INTEGER := 0;
    v_posting_failed INTEGER := 0;
    v_readiness_score INTEGER := 100;

    v_cash_acc UUID;
    v_bank_acc UUID;
    v_service_revenue_acc UUID;
    v_unearned_revenue_acc UUID;
    v_payable_acc UUID;
    v_salary_cost_acc UUID;

    v_entry_id UUID;
    v_payment_account_id UUID;
    v_expense_account_id UUID;
    v_expense_account_code TEXT;
    v_amount NUMERIC(19,4);
    v_inserted_salary BOOLEAN;
    rec RECORD;
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Missing tenant for legacy ledger sync.';
    END IF;

    IF NOT (
        auth.role() = 'service_role'
        OR (
            (public.is_admin() OR public.is_accountant())
            AND (
                public.is_hq_super_admin()
                OR p_tenant_id = public.get_auth_tenant_id()
            )
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: only admin/accountant can sync legacy data to ledger.';
    END IF;

    PERFORM 1
    FROM public.tenants
    WHERE id = p_tenant_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Tenant % not found for legacy ledger sync.', p_tenant_id;
    END IF;

    SELECT
        COALESCE(SUM(total_records), 0)::INTEGER,
        COALESCE(SUM(missing_business_event), 0)::INTEGER,
        COALESCE(SUM(needs_review), 0)::INTEGER,
        COALESCE(SUM(posting_failed), 0)::INTEGER
    INTO
        v_total_records,
        v_missing_business_event,
        v_needs_review,
        v_posting_failed
    FROM (
        SELECT
            COUNT(*)::INTEGER AS total_records,
            COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER AS missing_business_event,
            COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER AS needs_review,
            COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER AS posting_failed
        FROM public.revenue WHERE tenant_id = p_tenant_id
        UNION ALL
        SELECT
            COUNT(*)::INTEGER,
            COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
        FROM public.expenses WHERE tenant_id = p_tenant_id
        UNION ALL
        SELECT
            COUNT(*)::INTEGER,
            COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
        FROM public.salary_records WHERE tenant_id = p_tenant_id
        UNION ALL
        SELECT
            COUNT(*)::INTEGER,
            COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
        FROM public.session_logs WHERE tenant_id = p_tenant_id AND status = 'completed'
        UNION ALL
        SELECT
            COUNT(*)::INTEGER,
            COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
            COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
        FROM public.inventory_logs WHERE tenant_id = p_tenant_id
    ) readiness;

    IF v_total_records > 0 THEN
        v_readiness_score := GREATEST(
            0,
            LEAST(
                100,
                ROUND(
                    (
                        (
                            v_total_records
                            - v_missing_business_event
                            - (v_needs_review * 1.5)
                            - (v_posting_failed * 2)
                        ) / v_total_records::NUMERIC
                    ) * 100
                )::INTEGER
            )
        );
    END IF;

    IF v_readiness_score < 95
       OR v_missing_business_event > 0
       OR v_needs_review > 0
       OR v_posting_failed > 0 THEN
        RAISE EXCEPTION 'Accounting readiness is not clean enough to enable Professional Core. score=%, missing=%, needs_review=%, posting_failed=%',
            v_readiness_score,
            v_missing_business_event,
            v_needs_review,
            v_posting_failed;
    END IF;

    SELECT id INTO v_cash_acc
    FROM public.accounting_accounts
    WHERE tenant_id = p_tenant_id AND account_code = '111' AND is_active = true
    LIMIT 1;

    SELECT id INTO v_bank_acc
    FROM public.accounting_accounts
    WHERE tenant_id = p_tenant_id AND account_code = '112' AND is_active = true
    LIMIT 1;

    SELECT id INTO v_service_revenue_acc
    FROM public.accounting_accounts
    WHERE tenant_id = p_tenant_id AND account_code = '5113' AND is_active = true
    LIMIT 1;

    SELECT id INTO v_unearned_revenue_acc
    FROM public.accounting_accounts
    WHERE tenant_id = p_tenant_id AND account_code = '3387' AND is_active = true
    LIMIT 1;

    SELECT id INTO v_payable_acc
    FROM public.accounting_accounts
    WHERE tenant_id = p_tenant_id AND account_code = '334' AND is_active = true
    LIMIT 1;

    SELECT id INTO v_salary_cost_acc
    FROM public.accounting_accounts
    WHERE tenant_id = p_tenant_id AND account_code = '6421' AND is_active = true
    LIMIT 1;

    IF v_cash_acc IS NULL OR v_bank_acc IS NULL OR v_service_revenue_acc IS NULL OR v_unearned_revenue_acc IS NULL THEN
        RAISE EXCEPTION 'Missing required COA accounts 111, 112, 5113 or 3387 for tenant %.', p_tenant_id;
    END IF;

    IF v_payable_acc IS NULL OR v_salary_cost_acc IS NULL THEN
        RAISE EXCEPTION 'Missing required salary COA accounts 334 or 6421 for tenant %.', p_tenant_id;
    END IF;

    synced_revenue_count := 0;
    synced_expense_count := 0;
    synced_salary_count := 0;

    FOR rec IN
        SELECT
            r.*,
            CASE
                WHEN lower(COALESCE(r.revenue_type, '')) = 'refund' THEN 'REFUND'
                WHEN lower(COALESCE(r.revenue_type, '')) IN ('deposit', 'remaining_payment', 'package_payment', 'package_sale') THEN 'PACKAGE_SALE'
                ELSE 'REVENUE'
            END AS legacy_reference_type
        FROM public.revenue r
        WHERE r.tenant_id = p_tenant_id
          AND r.status = 'confirmed'
          AND COALESCE(r.amount, 0) > 0
          AND NOT EXISTS (
              SELECT 1
              FROM public.journal_entries je
              WHERE je.tenant_id = p_tenant_id
                AND je.reference_type = CASE
                    WHEN lower(COALESCE(r.revenue_type, '')) = 'refund' THEN 'REFUND'
                    WHEN lower(COALESCE(r.revenue_type, '')) IN ('deposit', 'remaining_payment', 'package_payment', 'package_sale') THEN 'PACKAGE_SALE'
                    ELSE 'REVENUE'
                END
                AND je.reference_id = r.id
                AND je.status <> 'CANCELED'
          )
        ORDER BY r.received_date, r.id
    LOOP
        v_amount := rec.amount::NUMERIC(19,4);
        v_payment_account_id := CASE
            WHEN lower(COALESCE(rec.payment_method, '')) = 'cash' THEN v_cash_acc
            ELSE v_bank_acc
        END;

        INSERT INTO public.journal_entries (
            tenant_id, description, reference_type, reference_id, entry_date, status, created_by
        ) VALUES (
            p_tenant_id,
            '[Legacy sync] ' || CASE
                WHEN rec.legacy_reference_type = 'REFUND' THEN COALESCE(rec.notes, 'Customer refund')
                WHEN rec.legacy_reference_type = 'PACKAGE_SALE' THEN COALESCE(rec.notes, 'Prepaid package/deposit revenue')
                ELSE COALESCE(rec.notes, 'Direct service revenue')
            END,
            rec.legacy_reference_type,
            rec.id,
            rec.received_date,
            'DRAFT',
            p_created_by
        )
        RETURNING id INTO v_entry_id;

        IF rec.legacy_reference_type = 'REFUND' THEN
            INSERT INTO public.journal_lines (entry_id, account_id, debit_amount, credit_amount)
            VALUES
                (v_entry_id, v_service_revenue_acc, v_amount, 0),
                (v_entry_id, v_payment_account_id, 0, v_amount);
        ELSIF rec.legacy_reference_type = 'PACKAGE_SALE' THEN
            INSERT INTO public.journal_lines (entry_id, account_id, debit_amount, credit_amount)
            VALUES
                (v_entry_id, v_payment_account_id, v_amount, 0),
                (v_entry_id, v_unearned_revenue_acc, 0, v_amount);
        ELSE
            INSERT INTO public.journal_lines (entry_id, account_id, debit_amount, credit_amount)
            VALUES
                (v_entry_id, v_payment_account_id, v_amount, 0),
                (v_entry_id, v_service_revenue_acc, 0, v_amount);
        END IF;

        UPDATE public.journal_entries
        SET status = 'POSTED', updated_at = NOW()
        WHERE id = v_entry_id;

        synced_revenue_count := synced_revenue_count + 1;
    END LOOP;

    FOR rec IN
        SELECT *
        FROM public.expenses e
        WHERE e.tenant_id = p_tenant_id
          AND e.status = 'approved'
          AND COALESCE(e.amount, 0) > 0
          AND NOT EXISTS (
              SELECT 1
              FROM public.journal_entries je
              WHERE je.tenant_id = p_tenant_id
                AND je.reference_type = 'EXPENSE'
                AND je.reference_id = e.id
                AND je.status <> 'CANCELED'
          )
        ORDER BY e.expense_date, e.id
    LOOP
        v_expense_account_code := CASE lower(COALESCE(rec.category, ''))
            WHEN 'rent' THEN '6423'
            WHEN 'utilities' THEN '6424'
            WHEN 'marketing' THEN '6425'
            WHEN 'materials' THEN '632'
            WHEN 'salary' THEN '6421'
            ELSE '6427'
        END;

        SELECT id INTO v_expense_account_id
        FROM public.accounting_accounts
        WHERE tenant_id = p_tenant_id
          AND account_code = v_expense_account_code
          AND is_active = true
        LIMIT 1;

        IF v_expense_account_id IS NULL THEN
            RAISE EXCEPTION 'Missing expense COA account % for tenant %.', v_expense_account_code, p_tenant_id;
        END IF;

        v_amount := rec.amount::NUMERIC(19,4);
        v_payment_account_id := CASE
            WHEN lower(COALESCE(rec.accounting_metadata ->> 'payment_method', '')) = 'cash' THEN v_cash_acc
            ELSE v_bank_acc
        END;

        INSERT INTO public.journal_entries (
            tenant_id, description, reference_type, reference_id, entry_date, status, created_by
        ) VALUES (
            p_tenant_id,
            '[Legacy sync] ' || COALESCE(rec.description, 'Operating expense'),
            'EXPENSE',
            rec.id,
            rec.expense_date,
            'DRAFT',
            p_created_by
        )
        RETURNING id INTO v_entry_id;

        INSERT INTO public.journal_lines (entry_id, account_id, debit_amount, credit_amount)
        VALUES
            (v_entry_id, v_expense_account_id, v_amount, 0),
            (v_entry_id, v_payment_account_id, 0, v_amount);

        UPDATE public.journal_entries
        SET status = 'POSTED', updated_at = NOW()
        WHERE id = v_entry_id;

        synced_expense_count := synced_expense_count + 1;
    END LOOP;

    FOR rec IN
        SELECT *
        FROM public.salary_records s
        WHERE s.tenant_id = p_tenant_id
          AND s.status = 'paid'
        ORDER BY s.month_year, s.id
    LOOP
        v_amount := COALESCE(
            rec.total_salary,
            COALESCE(rec.base_salary, 0)
            + COALESCE(rec.session_bonus, 0)
            + COALESCE(rec.kpi_bonus, 0)
            + COALESCE(rec.rating_bonus, 0)
            - COALESCE(rec.violations_deduction, 0)
            - COALESCE(rec.service_percentage_bonus, 0)
        )::NUMERIC(19,4);

        IF v_amount <= 0 THEN
            CONTINUE;
        END IF;

        v_inserted_salary := false;
        v_payment_account_id := CASE
            WHEN lower(COALESCE(rec.paid_method, '')) = 'cash' THEN v_cash_acc
            ELSE v_bank_acc
        END;

        IF NOT EXISTS (
            SELECT 1
            FROM public.journal_entries je
            WHERE je.tenant_id = p_tenant_id
              AND je.reference_type = 'SALARY_ACCRUAL'
              AND je.reference_id = rec.id
              AND je.status <> 'CANCELED'
        ) THEN
            INSERT INTO public.journal_entries (
                tenant_id, description, reference_type, reference_id, entry_date, status, created_by
            ) VALUES (
                p_tenant_id,
                '[Legacy sync] Salary accrual - Period ' || rec.month_year,
                'SALARY_ACCRUAL',
                rec.id,
                COALESCE(rec.paid_date, rec.month_year::DATE),
                'DRAFT',
                p_created_by
            )
            RETURNING id INTO v_entry_id;

            INSERT INTO public.journal_lines (entry_id, account_id, debit_amount, credit_amount, ktv_id)
            VALUES
                (v_entry_id, v_salary_cost_acc, v_amount, 0, rec.ktv_id),
                (v_entry_id, v_payable_acc, 0, v_amount, rec.ktv_id);

            UPDATE public.journal_entries
            SET status = 'POSTED', updated_at = NOW()
            WHERE id = v_entry_id;

            v_inserted_salary := true;
        END IF;

        IF NOT EXISTS (
            SELECT 1
            FROM public.journal_entries je
            WHERE je.tenant_id = p_tenant_id
              AND je.reference_type = 'SALARY_PAYMENT'
              AND je.reference_id = rec.id
              AND je.status <> 'CANCELED'
        ) THEN
            INSERT INTO public.journal_entries (
                tenant_id, description, reference_type, reference_id, entry_date, status, created_by
            ) VALUES (
                p_tenant_id,
                '[Legacy sync] Salary payment - Period ' || rec.month_year,
                'SALARY_PAYMENT',
                rec.id,
                COALESCE(rec.paid_date, rec.month_year::DATE),
                'DRAFT',
                p_created_by
            )
            RETURNING id INTO v_entry_id;

            INSERT INTO public.journal_lines (entry_id, account_id, debit_amount, credit_amount, ktv_id)
            VALUES
                (v_entry_id, v_payable_acc, v_amount, 0, rec.ktv_id),
                (v_entry_id, v_payment_account_id, 0, v_amount, rec.ktv_id);

            UPDATE public.journal_entries
            SET status = 'POSTED', updated_at = NOW()
            WHERE id = v_entry_id;

            v_inserted_salary := true;
        END IF;

        IF v_inserted_salary THEN
            synced_salary_count := synced_salary_count + 1;
        END IF;
    END LOOP;

    UPDATE public.tenants
    SET accounting_mode = 'PROFESSIONAL'
    WHERE id = p_tenant_id;

    RETURN NEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.sync_legacy_to_ledger_atomic(UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.sync_legacy_to_ledger_atomic(UUID, UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.preview_legacy_ledger_sync(
    p_tenant_id UUID
)
RETURNS TABLE (
    pending_revenue_count INTEGER,
    pending_expense_count INTEGER,
    pending_salary_count INTEGER,
    journal_entries_to_create INTEGER,
    revenue_amount NUMERIC,
    expense_amount NUMERIC,
    salary_amount NUMERIC
) AS $$
BEGIN
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'Missing tenant for legacy ledger sync preview.';
    END IF;

    IF NOT (
        auth.role() = 'service_role'
        OR (
            (public.is_admin() OR public.is_accountant())
            AND (
                public.is_hq_super_admin()
                OR p_tenant_id = public.get_auth_tenant_id()
            )
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: only admin/accountant can preview legacy ledger sync.';
    END IF;

    RETURN QUERY
    WITH revenue_candidates AS (
        SELECT
            r.*,
            CASE
                WHEN lower(COALESCE(r.revenue_type, '')) = 'refund' THEN 'REFUND'
                WHEN lower(COALESCE(r.revenue_type, '')) IN ('deposit', 'remaining_payment', 'package_payment', 'package_sale') THEN 'PACKAGE_SALE'
                ELSE 'REVENUE'
            END AS legacy_reference_type
        FROM public.revenue r
        WHERE r.tenant_id = p_tenant_id
          AND r.status = 'confirmed'
          AND COALESCE(r.amount, 0) > 0
    ),
    pending_revenue AS (
        SELECT
            COUNT(*)::INTEGER AS row_count,
            COALESCE(SUM(r.amount), 0)::NUMERIC AS amount
        FROM revenue_candidates r
        WHERE NOT EXISTS (
              SELECT 1
              FROM public.journal_entries je
              WHERE je.tenant_id = p_tenant_id
                AND je.reference_type = r.legacy_reference_type
                AND je.reference_id = r.id
                AND je.status <> 'CANCELED'
          )
    ),
    pending_expense AS (
        SELECT
            COUNT(*)::INTEGER AS row_count,
            COALESCE(SUM(e.amount), 0)::NUMERIC AS amount
        FROM public.expenses e
        WHERE e.tenant_id = p_tenant_id
          AND e.status = 'approved'
          AND COALESCE(e.amount, 0) > 0
          AND NOT EXISTS (
              SELECT 1
              FROM public.journal_entries je
              WHERE je.tenant_id = p_tenant_id
                AND je.reference_type = 'EXPENSE'
                AND je.reference_id = e.id
                AND je.status <> 'CANCELED'
          )
    ),
    salary_base AS (
        SELECT
            s.id,
            COALESCE(
                s.total_salary,
                COALESCE(s.base_salary, 0)
                + COALESCE(s.session_bonus, 0)
                + COALESCE(s.kpi_bonus, 0)
                + COALESCE(s.rating_bonus, 0)
                - COALESCE(s.violations_deduction, 0)
                - COALESCE(s.service_percentage_bonus, 0)
            )::NUMERIC AS amount,
            NOT EXISTS (
                SELECT 1
                FROM public.journal_entries je
                WHERE je.tenant_id = p_tenant_id
                  AND je.reference_type = 'SALARY_ACCRUAL'
                  AND je.reference_id = s.id
                  AND je.status <> 'CANCELED'
            ) AS missing_accrual,
            NOT EXISTS (
                SELECT 1
                FROM public.journal_entries je
                WHERE je.tenant_id = p_tenant_id
                  AND je.reference_type = 'SALARY_PAYMENT'
                  AND je.reference_id = s.id
                  AND je.status <> 'CANCELED'
            ) AS missing_payment
        FROM public.salary_records s
        WHERE s.tenant_id = p_tenant_id
          AND s.status = 'paid'
    ),
    pending_salary AS (
        SELECT
            COUNT(*) FILTER (
                WHERE amount > 0 AND (missing_accrual OR missing_payment)
            )::INTEGER AS row_count,
            COALESCE(SUM(amount) FILTER (
                WHERE amount > 0 AND (missing_accrual OR missing_payment)
            ), 0)::NUMERIC AS amount,
            COALESCE(SUM(
                CASE WHEN amount > 0 AND missing_accrual THEN 1 ELSE 0 END
                + CASE WHEN amount > 0 AND missing_payment THEN 1 ELSE 0 END
            ), 0)::INTEGER AS entry_count
        FROM salary_base
    )
    SELECT
        pr.row_count AS pending_revenue_count,
        pe.row_count AS pending_expense_count,
        ps.row_count AS pending_salary_count,
        (pr.row_count + pe.row_count + ps.entry_count)::INTEGER AS journal_entries_to_create,
        pr.amount AS revenue_amount,
        pe.amount AS expense_amount,
        ps.amount AS salary_amount
    FROM pending_revenue pr
    CROSS JOIN pending_expense pe
    CROSS JOIN pending_salary ps;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.preview_legacy_ledger_sync(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.preview_legacy_ledger_sync(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
