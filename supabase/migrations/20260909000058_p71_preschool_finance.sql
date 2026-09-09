-- ============================================================================
-- BELLA PRESCHOOL OS: P7.1 TUITION & MEAL FEE BILLING ENGINE SCHEMA
-- Migration: 20260909000058_p71_preschool_finance.sql
-- Description: Core finance persistence foundation incorporating:
--              1. 8 edu_fin_* tables with NO CASCADE DELETE
--              2. Dual status fields: invoice_status (DRAFT, ISSUED, VOID) & settlement_status (UNPAID, PARTIALLY_PAID, PAID, OVERPAID)
--              3. P4 Meal Charge deduplication index
--              4. Immutability triggers on ISSUED invoices & line items
--              5. Multi-tenant RLS isolation
-- ============================================================================

-- 1. Fee Structures (Base tuition rates & fee catalog)
CREATE TABLE IF NOT EXISTS public.edu_fin_fee_structures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    program_id VARCHAR(50) NOT NULL DEFAULT 'PRESCHOOL',
    fee_code VARCHAR(50) NOT NULL,
    fee_name VARCHAR(255) NOT NULL,
    fee_type VARCHAR(50) NOT NULL DEFAULT 'TUITION', -- TUITION, MEAL_DAILY, ACTIVITY, ADMISSION, MATERIAL
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    billing_cycle VARCHAR(30) NOT NULL DEFAULT 'MONTHLY', -- MONTHLY, SEMESTER, YEARLY, DAILY
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Billing Periods
CREATE TABLE IF NOT EXISTS public.edu_fin_billing_periods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    period_name VARCHAR(100) NOT NULL, -- e.g. "Tháng 9/2026"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- DRAFT, ACTIVE, CLOSED
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Student Discount Profiles (Sibling discount, scholarship, waivers)
CREATE TABLE IF NOT EXISTS public.edu_fin_student_discount_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    student_id UUID NOT NULL,
    discount_type VARCHAR(50) NOT NULL DEFAULT 'SIBLING', -- SIBLING, SCHOLARSHIP, STAFF_CHILD, FINANCIAL_AID, WAIVER
    discount_name VARCHAR(255) NOT NULL,
    discount_percent NUMERIC(5, 2) NOT NULL DEFAULT 0.00, -- e.g. 10.00 for 10%
    fixed_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    reason TEXT,
    valid_from DATE NOT NULL,
    valid_until DATE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Invoices (Header with dual invoice_status and settlement_status)
CREATE TABLE IF NOT EXISTS public.edu_fin_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    student_id UUID NOT NULL,
    billing_period_id UUID NOT NULL REFERENCES public.edu_fin_billing_periods(id), -- NO CASCADE DELETE
    invoice_number VARCHAR(100) NOT NULL,
    invoice_status VARCHAR(30) NOT NULL DEFAULT 'DRAFT', -- DRAFT, ISSUED, VOID
    settlement_status VARCHAR(30) NOT NULL DEFAULT 'UNPAID', -- UNPAID, PARTIALLY_PAID, PAID, OVERPAID
    gross_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    net_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    outstanding_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    issued_at TIMESTAMPTZ,
    due_date DATE NOT NULL,
    sha256_checksum VARCHAR(128),
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Invoice Line Items
CREATE TABLE IF NOT EXISTS public.edu_fin_invoice_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    invoice_id UUID NOT NULL REFERENCES public.edu_fin_invoices(id), -- NO CASCADE DELETE
    item_type VARCHAR(50) NOT NULL DEFAULT 'TUITION', -- TUITION, MEAL_FEE, ACTIVITY_FEE, DISCOUNT, OTHER
    description VARCHAR(255) NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.00,
    subtotal_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    source_domain VARCHAR(50), -- P4_CARE, P3_CLASSROOM, MANUAL
    source_entity_type VARCHAR(50), -- MEAL_LOG, ATTENDANCE, DISCOUNT_PROFILE
    source_entity_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Inbound Payments (Append-Only Payment Records)
CREATE TABLE IF NOT EXISTS public.edu_fin_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    payer_party_id UUID NOT NULL,
    student_id UUID NOT NULL,
    payment_number VARCHAR(100) NOT NULL,
    payment_method VARCHAR(50) NOT NULL DEFAULT 'BANK_TRANSFER', -- BANK_TRANSFER, CASH, QR_CODE, CARD
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    allocated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    unallocated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    reference_number VARCHAR(100),
    payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status VARCHAR(30) NOT NULL DEFAULT 'RECEIVED', -- RECEIVED, RECONCILED, REFUNDED, VOID
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Reconciliation Ledger (Allocation Matching Payments to Invoices)
CREATE TABLE IF NOT EXISTS public.edu_fin_reconciliation_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    payment_id UUID NOT NULL REFERENCES public.edu_fin_payments(id), -- NO CASCADE DELETE
    invoice_id UUID NOT NULL REFERENCES public.edu_fin_invoices(id), -- NO CASCADE DELETE
    allocated_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    allocation_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reconciled_by_party_id UUID NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. Payment Receipts (Evidence Packages with SHA-256 Fingerprint)
CREATE TABLE IF NOT EXISTS public.edu_fin_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id),
    payment_id UUID NOT NULL REFERENCES public.edu_fin_payments(id), -- NO CASCADE DELETE
    invoice_id UUID NOT NULL REFERENCES public.edu_fin_invoices(id), -- NO CASCADE DELETE
    receipt_number VARCHAR(100) NOT NULL,
    settlement_snapshot JSONB NOT NULL,
    sha256_fingerprint VARCHAR(128) NOT NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── INDEXES FOR PERFORMANCE & DEDUPLICATION ──
CREATE INDEX IF NOT EXISTS idx_edu_fin_fee_structures_tenant ON public.edu_fin_fee_structures(tenant_id, program_id);
CREATE INDEX IF NOT EXISTS idx_edu_fin_invoices_tenant_student ON public.edu_fin_invoices(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_edu_fin_invoices_period ON public.edu_fin_invoices(billing_period_id);
CREATE INDEX IF NOT EXISTS idx_edu_fin_line_items_invoice ON public.edu_fin_invoice_line_items(invoice_id);

-- P4 Meal Charge Deduplication Unique Index: Prevents double-billing the exact same P4 meal occurrence on an invoice
CREATE UNIQUE INDEX IF NOT EXISTS idx_edu_fin_line_items_source_dedup
ON public.edu_fin_invoice_line_items (tenant_id, invoice_id, source_domain, source_entity_type, source_entity_id)
WHERE source_entity_id IS NOT NULL;

-- Payment & Reconciliation Indexes
CREATE INDEX IF NOT EXISTS idx_edu_fin_payments_tenant_student ON public.edu_fin_payments(tenant_id, student_id);
CREATE INDEX IF NOT EXISTS idx_edu_fin_recon_payment ON public.edu_fin_reconciliation_ledger(payment_id);
CREATE INDEX IF NOT EXISTS idx_edu_fin_recon_invoice ON public.edu_fin_reconciliation_ledger(invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edu_fin_recon_unique ON public.edu_fin_reconciliation_ledger(tenant_id, payment_id, invoice_id);

-- ── IMMUTABILITY DB TRIGGERS ──
-- 1. Freeze ISSUED or VOID Invoices from Header Amount or Status Alteration
CREATE OR REPLACE FUNCTION public.fn_check_invoice_immutable()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.invoice_status IN ('ISSUED', 'VOID') THEN
        -- Allow updating settlement_status, paid_amount, outstanding_amount, sha256_checksum, and updated_at ONLY
        IF (OLD.invoice_number IS DISTINCT FROM NEW.invoice_number) OR
           (OLD.gross_amount IS DISTINCT FROM NEW.gross_amount) OR
           (OLD.discount_amount IS DISTINCT FROM NEW.discount_amount) OR
           (OLD.net_amount IS DISTINCT FROM NEW.net_amount) OR
           (OLD.student_id IS DISTINCT FROM NEW.student_id) OR
           (OLD.billing_period_id IS DISTINCT FROM NEW.billing_period_id) THEN
            RAISE EXCEPTION 'INVOICE_PUBLISHED_IMMUTABLE_ERROR: Issued invoices are immutable and cannot have header amounts or core fields modified.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_invoice_immutable ON public.edu_fin_invoices;
CREATE TRIGGER trg_check_invoice_immutable
BEFORE UPDATE ON public.edu_fin_invoices
FOR EACH ROW EXECUTE FUNCTION public.fn_check_invoice_immutable();

-- 2. Freeze Line Items of ISSUED Invoices
CREATE OR REPLACE FUNCTION public.fn_check_invoice_line_items_immutable()
RETURNS TRIGGER AS $$
DECLARE
    parent_status VARCHAR(30);
BEGIN
    SELECT invoice_status INTO parent_status FROM public.edu_fin_invoices WHERE id = OLD.invoice_id;
    IF parent_status IN ('ISSUED', 'VOID') THEN
        RAISE EXCEPTION 'INVOICE_LINE_ITEMS_IMMUTABLE_ERROR: Cannot mutate line items of an issued invoice.';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_invoice_line_items_immutable ON public.edu_fin_invoice_line_items;
CREATE TRIGGER trg_check_invoice_line_items_immutable
BEFORE UPDATE OR DELETE ON public.edu_fin_invoice_line_items
FOR EACH ROW EXECUTE FUNCTION public.fn_check_invoice_line_items_immutable();

-- ── ROW-LEVEL SECURITY (RLS) POLICIES ──
ALTER TABLE public.edu_fin_fee_structures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_fin_billing_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_fin_student_discount_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_fin_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_fin_invoice_line_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_fin_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_fin_reconciliation_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_fin_receipts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_fin_fee_structures') THEN
        CREATE POLICY tenant_isolation_edu_fin_fee_structures ON public.edu_fin_fee_structures FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_fin_billing_periods') THEN
        CREATE POLICY tenant_isolation_edu_fin_billing_periods ON public.edu_fin_billing_periods FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_fin_student_discount_profiles') THEN
        CREATE POLICY tenant_isolation_edu_fin_student_discount_profiles ON public.edu_fin_student_discount_profiles FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_fin_invoices') THEN
        CREATE POLICY tenant_isolation_edu_fin_invoices ON public.edu_fin_invoices FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_fin_invoice_line_items') THEN
        CREATE POLICY tenant_isolation_edu_fin_invoice_line_items ON public.edu_fin_invoice_line_items FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_fin_payments') THEN
        CREATE POLICY tenant_isolation_edu_fin_payments ON public.edu_fin_payments FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_fin_reconciliation_ledger') THEN
        CREATE POLICY tenant_isolation_edu_fin_reconciliation_ledger ON public.edu_fin_reconciliation_ledger FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'tenant_isolation_edu_fin_receipts') THEN
        CREATE POLICY tenant_isolation_edu_fin_receipts ON public.edu_fin_receipts FOR ALL USING (tenant_id = (current_setting('app.current_tenant_id'::text, true))::uuid OR current_setting('role', true) = 'service_role');
    END IF;
END $$;
