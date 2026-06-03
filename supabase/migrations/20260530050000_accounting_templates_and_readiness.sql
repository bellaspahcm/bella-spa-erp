-- =============================================================================
-- Accounting templates + SIMPLE readiness foundation
--
-- Goal:
--   Keep SIMPLE data entry operationally friendly while attaching enough
--   accounting metadata for a safe upgrade to PROFESSIONAL ledger mode.
--
-- Default standard profile: TT133 (Vietnam SME accounting regime).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.accounting_event_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
    standard_profile TEXT NOT NULL DEFAULT 'TT133'
        CHECK (standard_profile IN ('TT133', 'TT200')),
    business_event_type TEXT NOT NULL,
    template_name TEXT NOT NULL,
    description TEXT,
    source_module TEXT NOT NULL DEFAULT 'finance'
        CHECK (source_module IN ('finance', 'booking', 'salary', 'inventory', 'franchise', 'clearing', 'manual')),
    template_lines JSONB NOT NULL DEFAULT '[]'::JSONB,
    required_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    auto_post_allowed BOOLEAN NOT NULL DEFAULT true,
    requires_review BOOLEAN NOT NULL DEFAULT false,
    is_system BOOLEAN NOT NULL DEFAULT false,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT accounting_event_templates_lines_array
        CHECK (jsonb_typeof(template_lines) = 'array')
);

CREATE UNIQUE INDEX IF NOT EXISTS accounting_event_templates_unique_active
    ON public.accounting_event_templates (
        COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::UUID),
        standard_profile,
        business_event_type
    )
    WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_accounting_event_templates_tenant_profile
    ON public.accounting_event_templates (tenant_id, standard_profile, is_active);

CREATE TABLE IF NOT EXISTS public.accounting_review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    business_event_type TEXT,
    source_table TEXT NOT NULL,
    source_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'NEEDS_REVIEW'
        CHECK (status IN ('AUTO_POSTED', 'NEEDS_REVIEW', 'APPROVED_FOR_POSTING', 'REJECTED', 'POSTING_FAILED')),
    severity TEXT NOT NULL DEFAULT 'medium'
        CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    reason_code TEXT NOT NULL,
    message TEXT NOT NULL,
    missing_fields TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    suggested_template_id UUID REFERENCES public.accounting_event_templates(id) ON DELETE SET NULL,
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    resolved_by UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS accounting_review_queue_unique_open_source
    ON public.accounting_review_queue (tenant_id, source_table, source_id, COALESCE(business_event_type, 'UNCLASSIFIED'))
    WHERE status IN ('NEEDS_REVIEW', 'POSTING_FAILED');

CREATE INDEX IF NOT EXISTS idx_accounting_review_queue_tenant_status
    ON public.accounting_review_queue (tenant_id, status, severity, created_at DESC);

-- Attach accounting metadata to SIMPLE source tables. These columns do not
-- change current behavior; they provide classification + migration readiness.
ALTER TABLE public.revenue
    ADD COLUMN IF NOT EXISTS business_event_type TEXT,
    ADD COLUMN IF NOT EXISTS accounting_template_id UUID REFERENCES public.accounting_event_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS accounting_review_status TEXT NOT NULL DEFAULT 'UNREVIEWED'
        CHECK (accounting_review_status IN ('UNREVIEWED', 'AUTO_POSTED', 'NEEDS_REVIEW', 'APPROVED', 'POSTING_FAILED')),
    ADD COLUMN IF NOT EXISTS accounting_metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.expenses
    ADD COLUMN IF NOT EXISTS business_event_type TEXT,
    ADD COLUMN IF NOT EXISTS accounting_template_id UUID REFERENCES public.accounting_event_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS accounting_review_status TEXT NOT NULL DEFAULT 'UNREVIEWED'
        CHECK (accounting_review_status IN ('UNREVIEWED', 'AUTO_POSTED', 'NEEDS_REVIEW', 'APPROVED', 'POSTING_FAILED')),
    ADD COLUMN IF NOT EXISTS accounting_metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.salary_records
    ADD COLUMN IF NOT EXISTS business_event_type TEXT,
    ADD COLUMN IF NOT EXISTS accounting_template_id UUID REFERENCES public.accounting_event_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS accounting_review_status TEXT NOT NULL DEFAULT 'UNREVIEWED'
        CHECK (accounting_review_status IN ('UNREVIEWED', 'AUTO_POSTED', 'NEEDS_REVIEW', 'APPROVED', 'POSTING_FAILED')),
    ADD COLUMN IF NOT EXISTS accounting_metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.session_logs
    ADD COLUMN IF NOT EXISTS business_event_type TEXT,
    ADD COLUMN IF NOT EXISTS accounting_template_id UUID REFERENCES public.accounting_event_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS accounting_review_status TEXT NOT NULL DEFAULT 'UNREVIEWED'
        CHECK (accounting_review_status IN ('UNREVIEWED', 'AUTO_POSTED', 'NEEDS_REVIEW', 'APPROVED', 'POSTING_FAILED')),
    ADD COLUMN IF NOT EXISTS accounting_metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

ALTER TABLE public.inventory_logs
    ADD COLUMN IF NOT EXISTS business_event_type TEXT,
    ADD COLUMN IF NOT EXISTS accounting_template_id UUID REFERENCES public.accounting_event_templates(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS accounting_review_status TEXT NOT NULL DEFAULT 'UNREVIEWED'
        CHECK (accounting_review_status IN ('UNREVIEWED', 'AUTO_POSTED', 'NEEDS_REVIEW', 'APPROVED', 'POSTING_FAILED')),
    ADD COLUMN IF NOT EXISTS accounting_metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE INDEX IF NOT EXISTS idx_revenue_business_event
    ON public.revenue (tenant_id, business_event_type, accounting_review_status);
CREATE INDEX IF NOT EXISTS idx_expenses_business_event
    ON public.expenses (tenant_id, business_event_type, accounting_review_status);
CREATE INDEX IF NOT EXISTS idx_salary_records_business_event
    ON public.salary_records (tenant_id, business_event_type, accounting_review_status);
CREATE INDEX IF NOT EXISTS idx_session_logs_business_event
    ON public.session_logs (tenant_id, business_event_type, accounting_review_status);
CREATE INDEX IF NOT EXISTS idx_inventory_logs_business_event
    ON public.inventory_logs (tenant_id, business_event_type, accounting_review_status);

ALTER TABLE public.accounting_event_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounting_review_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read accounting event templates" ON public.accounting_event_templates;
CREATE POLICY "Read accounting event templates"
    ON public.accounting_event_templates
    FOR SELECT TO authenticated
    USING (
        is_active = true
        AND (
            tenant_id IS NULL
            OR public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    );

DROP POLICY IF EXISTS "Tenant admins manage accounting event templates" ON public.accounting_event_templates;
CREATE POLICY "Tenant admins manage accounting event templates"
    ON public.accounting_event_templates
    FOR ALL TO authenticated
    USING (
        (public.is_admin() OR public.is_accountant())
        AND tenant_id = public.get_auth_tenant_id()
        AND is_system = false
    )
    WITH CHECK (
        (public.is_admin() OR public.is_accountant())
        AND tenant_id = public.get_auth_tenant_id()
        AND is_system = false
    );

DROP POLICY IF EXISTS "Read accounting review queue" ON public.accounting_review_queue;
CREATE POLICY "Read accounting review queue"
    ON public.accounting_review_queue
    FOR SELECT TO authenticated
    USING (
        (public.is_admin() OR public.is_accountant())
        AND (
            public.is_hq_super_admin()
            OR tenant_id = public.get_auth_tenant_id()
        )
    );

DROP POLICY IF EXISTS "Tenant admins update accounting review queue" ON public.accounting_review_queue;
CREATE POLICY "Tenant admins update accounting review queue"
    ON public.accounting_review_queue
    FOR UPDATE TO authenticated
    USING (
        (public.is_admin() OR public.is_accountant())
        AND tenant_id = public.get_auth_tenant_id()
    )
    WITH CHECK (
        (public.is_admin() OR public.is_accountant())
        AND tenant_id = public.get_auth_tenant_id()
    );

-- Insert is intentionally service-role/app-server only. No INSERT policy for
-- authenticated users prevents client-side spoofing of review evidence.

GRANT SELECT ON public.accounting_event_templates TO authenticated;
GRANT SELECT, UPDATE ON public.accounting_review_queue TO authenticated;
GRANT ALL ON public.accounting_event_templates TO service_role, postgres;
GRANT ALL ON public.accounting_review_queue TO service_role, postgres;

-- System TT133 templates. Tenant-specific overrides can be created later by
-- accountants/CFO without changing operational forms.
INSERT INTO public.accounting_event_templates (
    tenant_id, standard_profile, business_event_type, template_name, description,
    source_module, template_lines, required_fields, auto_post_allowed, requires_review, is_system
) VALUES
    (NULL, 'TT133', 'CUSTOMER_DEPOSIT', 'Thu cọc gói liệu trình', 'Khách trả tiền trước, ghi nhận doanh thu chưa thực hiện.',
     'finance',
     '[
        {"side":"DEBIT","account_code":"111_OR_112","amount_source":"gross_amount"},
        {"side":"CREDIT","account_code":"3387","amount_source":"net_amount"},
        {"side":"CREDIT","account_code":"3331","amount_source":"vat_amount","optional":true}
      ]'::JSONB,
     ARRAY['amount','payment_method','booking_id'], true, false, true),
    (NULL, 'TT133', 'CUSTOMER_REMAINING_PAYMENT', 'Thu phần còn lại của gói', 'Thu nốt công nợ/tiền còn lại cho gói đã bán.',
     'finance',
     '[
        {"side":"DEBIT","account_code":"111_OR_112","amount_source":"gross_amount"},
        {"side":"CREDIT","account_code":"3387","amount_source":"net_amount"},
        {"side":"CREDIT","account_code":"3331","amount_source":"vat_amount","optional":true}
      ]'::JSONB,
     ARRAY['amount','payment_method','booking_id'], true, false, true),
    (NULL, 'TT133', 'CUSTOMER_FULL_PAYMENT', 'Thu trọn gói liệu trình', 'Thu trọn gói; mặc định treo 3387 rồi ghi nhận theo buổi.',
     'finance',
     '[
        {"side":"DEBIT","account_code":"111_OR_112","amount_source":"gross_amount"},
        {"side":"CREDIT","account_code":"3387","amount_source":"net_amount"},
        {"side":"CREDIT","account_code":"3331","amount_source":"vat_amount","optional":true}
      ]'::JSONB,
     ARRAY['amount','payment_method','booking_id'], true, false, true),
    (NULL, 'TT133', 'SESSION_REVENUE_RECOGNIZED', 'Ghi nhận doanh thu buổi đã hoàn thành', 'Kết chuyển doanh thu chưa thực hiện sang doanh thu dịch vụ.',
     'booking',
     '[
        {"side":"DEBIT","account_code":"3387","amount_source":"earned_revenue"},
        {"side":"CREDIT","account_code":"5113","amount_source":"earned_revenue"}
      ]'::JSONB,
     ARRAY['session_log_id','booking_id','earned_revenue'], true, false, true),
    (NULL, 'TT133', 'REFUND_TO_CUSTOMER', 'Hoàn tiền khách hàng', 'Hoàn tiền/giảm trừ doanh thu theo tình huống được kế toán rà soát.',
     'finance',
     '[
        {"side":"DEBIT","account_code":"521","amount_source":"amount"},
        {"side":"CREDIT","account_code":"111_OR_112","amount_source":"amount"}
      ]'::JSONB,
     ARRAY['amount','payment_method','reason'], false, true, true),
    (NULL, 'TT133', 'EXPENSE_RENT', 'Chi phí thuê mặt bằng', 'Chi phí thuê mặt bằng chi nhánh.',
     'finance',
     '[
        {"side":"DEBIT","account_code":"6423","amount_source":"amount"},
        {"side":"CREDIT","account_code":"111_OR_112","amount_source":"amount"}
      ]'::JSONB,
     ARRAY['amount','payment_method','expense_date'], true, false, true),
    (NULL, 'TT133', 'EXPENSE_UTILITIES', 'Chi phí điện nước/internet', 'Chi phí tiện ích vận hành.',
     'finance',
     '[
        {"side":"DEBIT","account_code":"6424","amount_source":"amount"},
        {"side":"CREDIT","account_code":"111_OR_112","amount_source":"amount"}
      ]'::JSONB,
     ARRAY['amount','payment_method','expense_date'], true, false, true),
    (NULL, 'TT133', 'EXPENSE_MARKETING', 'Chi phí marketing', 'Chi phí quảng cáo/Zalo/khuyến mại.',
     'finance',
     '[
        {"side":"DEBIT","account_code":"6425","amount_source":"amount"},
        {"side":"CREDIT","account_code":"111_OR_112","amount_source":"amount"}
      ]'::JSONB,
     ARRAY['amount','payment_method','expense_date'], true, false, true),
    (NULL, 'TT133', 'EXPENSE_MATERIALS', 'Chi phí vật tư tiêu hao mua trực tiếp', 'Chi vật tư không qua kho hoặc mua dùng ngay.',
     'finance',
     '[
        {"side":"DEBIT","account_code":"632","amount_source":"amount"},
        {"side":"CREDIT","account_code":"111_OR_112","amount_source":"amount"}
      ]'::JSONB,
     ARRAY['amount','payment_method','expense_date'], true, false, true),
    (NULL, 'TT133', 'EXPENSE_OTHER', 'Chi phí vận hành khác', 'Khoản chi chưa map rõ, cần kế toán rà soát khi giá trị lớn.',
     'finance',
     '[
        {"side":"DEBIT","account_code":"6427","amount_source":"amount"},
        {"side":"CREDIT","account_code":"111_OR_112","amount_source":"amount"}
      ]'::JSONB,
     ARRAY['amount','payment_method','expense_date','description'], true, true, true),
    (NULL, 'TT133', 'INVENTORY_PURCHASE', 'Mua vật tư nhập kho', 'Nhập kho vật tư massage/chăm sóc.',
     'inventory',
     '[
        {"side":"DEBIT","account_code":"152","amount_source":"amount"},
        {"side":"CREDIT","account_code":"111_OR_112","amount_source":"amount"}
      ]'::JSONB,
     ARRAY['amount','payment_method','item_id'], true, false, true),
    (NULL, 'TT133', 'INVENTORY_CONSUMED', 'Tiêu hao vật tư theo buổi', 'Xuất kho vật tư dùng cho ca trị liệu.',
     'inventory',
     '[
        {"side":"DEBIT","account_code":"632","amount_source":"amount"},
        {"side":"CREDIT","account_code":"152","amount_source":"amount"}
      ]'::JSONB,
     ARRAY['amount','item_id','session_log_id'], true, false, true),
    (NULL, 'TT133', 'SALARY_ACCRUAL', 'Ghi nhận lương phải trả', 'Ghi nhận chi phí lương/KTV phải trả.',
     'salary',
     '[
        {"side":"DEBIT","account_code":"6421","amount_source":"amount"},
        {"side":"CREDIT","account_code":"334","amount_source":"amount"}
      ]'::JSONB,
     ARRAY['amount','ktv_id','month_year'], true, false, true),
    (NULL, 'TT133', 'SALARY_PAYMENT', 'Chi trả lương', 'Thanh toán khoản lương đã ghi nhận phải trả.',
     'salary',
     '[
        {"side":"DEBIT","account_code":"334","amount_source":"amount"},
        {"side":"CREDIT","account_code":"111_OR_112","amount_source":"amount"}
      ]'::JSONB,
     ARRAY['amount','payment_method','ktv_id','month_year'], true, false, true),
    (NULL, 'TT133', 'KTV_COMMISSION_ACCRUAL', 'Ghi nhận hoa hồng KTV', 'Hoa hồng theo buổi phát sinh khi hoàn thành dịch vụ.',
     'salary',
     '[
        {"side":"DEBIT","account_code":"6421","amount_source":"commission_amount"},
        {"side":"CREDIT","account_code":"334","amount_source":"commission_amount"}
      ]'::JSONB,
     ARRAY['commission_amount','ktv_id','session_log_id'], true, false, true),
    (NULL, 'TT133', 'INTER_BRANCH_CLEARING', 'Đối soát/bù trừ liên chi nhánh', 'Nghiệp vụ nội bộ cần kế toán xác nhận trước khi hạch toán.',
     'clearing',
     '[]'::JSONB,
     ARRAY['amount','debtor_tenant_id','creditor_tenant_id'], false, true, true),
    (NULL, 'TT133', 'FRANCHISE_ROYALTY', 'Royalty nhượng quyền', 'Phí nhượng quyền/royalty giữa chi nhánh và HQ.',
     'franchise',
     '[]'::JSONB,
     ARRAY['amount','invoice_number','tenant_id'], false, true, true)
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_accounting_readiness(p_tenant_id UUID)
RETURNS TABLE (
    source_table TEXT,
    total_records INTEGER,
    classified_records INTEGER,
    missing_business_event INTEGER,
    needs_review INTEGER,
    posting_failed INTEGER
) AS $$
BEGIN
    IF NOT (
        (public.is_admin() OR public.is_accountant())
        AND (
            public.is_hq_super_admin()
            OR p_tenant_id = public.get_auth_tenant_id()
        )
    ) THEN
        RAISE EXCEPTION 'Unauthorized: chỉ admin/kế toán được xem readiness kế toán của tenant hiện tại.';
    END IF;

    RETURN QUERY
    SELECT 'revenue'::TEXT,
           COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NOT NULL)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
    FROM public.revenue WHERE tenant_id = p_tenant_id
    UNION ALL
    SELECT 'expenses'::TEXT,
           COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NOT NULL)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
    FROM public.expenses WHERE tenant_id = p_tenant_id
    UNION ALL
    SELECT 'salary_records'::TEXT,
           COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NOT NULL)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
    FROM public.salary_records WHERE tenant_id = p_tenant_id
    UNION ALL
    SELECT 'session_logs'::TEXT,
           COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NOT NULL)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
    FROM public.session_logs WHERE tenant_id = p_tenant_id AND status = 'completed'
    UNION ALL
    SELECT 'inventory_logs'::TEXT,
           COUNT(*)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NOT NULL)::INTEGER,
           COUNT(*) FILTER (WHERE business_event_type IS NULL)::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'NEEDS_REVIEW')::INTEGER,
           COUNT(*) FILTER (WHERE accounting_review_status = 'POSTING_FAILED')::INTEGER
    FROM public.inventory_logs WHERE tenant_id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE EXECUTE ON FUNCTION public.get_accounting_readiness(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_accounting_readiness(UUID) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
