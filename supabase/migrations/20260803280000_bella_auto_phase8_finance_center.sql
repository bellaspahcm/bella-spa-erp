-- =====================================================================================
-- Bella Auto Phase 8: Finance Center (Nghiệp Vụ Tài Chính Ô Tô)
-- Migration: 20260803280000
-- 
-- Tables:
-- 1. auto_loan_applications - Bank loan applications for vehicle financing
-- 2. auto_insurance_policies - Insurance policies with renewal reminders
-- 
-- Features:
-- - Loan application tracking (submitted → approved → disbursed)
-- - Insurance policy management with auto-renewal alerts
-- - Revenue recognition via Accounting Outbox
-- - Financial analytics & reporting
-- 
-- Zero Regression: All tables prefixed with 'auto_', no core table modifications
-- =====================================================================================

-- =====================================================================================
-- TABLE: auto_loan_applications
-- Purpose: Track bank loan applications for vehicle financing
-- =====================================================================================
CREATE TABLE IF NOT EXISTS auto_loan_applications (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Application Number (unique identifier)
  application_number TEXT NOT NULL,
  application_date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Customer & Vehicle
  customer_id UUID NOT NULL, -- References customers(id)
  vehicle_id UUID, -- References auto_vehicles(id)
  sale_id UUID, -- References auto_sales(id)
  
  -- Loan Details
  loan_amount NUMERIC(15, 2) NOT NULL,
  down_payment NUMERIC(15, 2) NOT NULL,
  loan_term_months INTEGER NOT NULL, -- 12, 24, 36, 48, 60 months
  interest_rate NUMERIC(5, 2) NOT NULL, -- Annual interest rate %
  monthly_payment NUMERIC(12, 2), -- Calculated monthly payment
  
  -- Bank Information
  bank_name TEXT NOT NULL,
  bank_branch TEXT,
  bank_contact_person TEXT,
  bank_contact_phone TEXT,
  
  -- Application Status Workflow
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
    'draft',              -- Initial creation
    'documents_pending',  -- Waiting for customer documents
    'submitted',          -- Submitted to bank
    'under_review',       -- Bank is reviewing
    'approved',           -- Bank approved the loan
    'rejected',           -- Bank rejected the loan
    'disbursed',          -- Loan amount disbursed
    'cancelled',          -- Application cancelled
    'expired'             -- Application expired
  )),
  
  -- Timestamps for workflow
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  disbursed_at TIMESTAMPTZ,
  rejection_date TIMESTAMPTZ,
  
  -- Approval Details
  approved_by UUID, -- Employee who processed approval
  approved_amount NUMERIC(15, 2), -- May differ from requested
  approved_term_months INTEGER,
  approved_interest_rate NUMERIC(5, 2),
  
  -- Rejection Details
  rejection_reason TEXT,
  rejection_notes TEXT,
  
  -- Documents Required
  documents_checklist JSONB DEFAULT '{
    "id_card": false,
    "household_registration": false,
    "income_proof": false,
    "bank_statement": false,
    "employment_certificate": false,
    "vehicle_registration": false,
    "other_documents": []
  }'::jsonb,
  
  -- Additional Information
  customer_income_monthly NUMERIC(12, 2),
  customer_employment_type TEXT,
  customer_credit_score INTEGER,
  
  -- Commission (for referral to bank)
  referral_commission_percentage NUMERIC(5, 2) DEFAULT 0,
  referral_commission_amount NUMERIC(12, 2),
  commission_paid BOOLEAN DEFAULT false,
  commission_paid_date DATE,
  
  -- Notes
  internal_notes TEXT,
  bank_notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Indexes
CREATE INDEX idx_auto_loan_applications_tenant ON auto_loan_applications(tenant_id);
CREATE INDEX idx_auto_loan_applications_customer ON auto_loan_applications(customer_id);
CREATE INDEX idx_auto_loan_applications_vehicle ON auto_loan_applications(vehicle_id);
CREATE INDEX idx_auto_loan_applications_sale ON auto_loan_applications(sale_id);
CREATE INDEX idx_auto_loan_applications_status ON auto_loan_applications(tenant_id, status);
CREATE INDEX idx_auto_loan_applications_bank ON auto_loan_applications(tenant_id, bank_name);
CREATE UNIQUE INDEX idx_auto_loan_applications_number ON auto_loan_applications(tenant_id, application_number);

-- RLS Policies
ALTER TABLE auto_loan_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_loan_applications_tenant_isolation ON auto_loan_applications
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Trigger for updated_at
CREATE TRIGGER trg_auto_loan_applications_updated_at
  BEFORE UPDATE ON auto_loan_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- TABLE: auto_insurance_policies
-- Purpose: Track insurance policies with auto-renewal reminders
-- =====================================================================================
CREATE TABLE IF NOT EXISTS auto_insurance_policies (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  
  -- Policy Number (unique identifier)
  policy_number TEXT NOT NULL,
  
  -- Customer & Vehicle
  customer_id UUID NOT NULL, -- References customers(id)
  vehicle_id UUID NOT NULL, -- References auto_vehicles(id)
  sale_id UUID, -- References auto_sales(id) if purchased with vehicle
  
  -- Insurance Company
  insurance_company TEXT NOT NULL,
  insurance_branch TEXT,
  insurance_agent_name TEXT,
  insurance_agent_phone TEXT,
  
  -- Policy Type
  policy_type TEXT NOT NULL CHECK (policy_type IN (
    'compulsory',        -- Bảo hiểm bắt buộc (TNDS)
    'voluntary',         -- Bảo hiểm tự nguyện (Vật chất)
    'comprehensive',     -- Bảo hiểm toàn diện
    'combined'          -- Kết hợp bắt buộc + tự nguyện
  )),
  
  -- Coverage Details
  coverage_amount NUMERIC(15, 2), -- Số tiền bảo hiểm
  deductible_amount NUMERIC(12, 2), -- Mức miễn thường
  
  -- Coverage Items (for comprehensive)
  coverage_items JSONB DEFAULT '{
    "collision": false,
    "theft": false,
    "fire": false,
    "flood": false,
    "third_party_liability": false,
    "personal_accident": false,
    "passenger_accident": false
  }'::jsonb,
  
  -- Premium
  premium_amount NUMERIC(12, 2) NOT NULL, -- Phí bảo hiểm
  premium_payment_frequency TEXT CHECK (premium_payment_frequency IN ('annual', 'semi_annual', 'quarterly', 'monthly')),
  
  -- Policy Period
  effective_date DATE NOT NULL,
  expiry_date DATE NOT NULL,
  
  -- Renewal
  is_active BOOLEAN DEFAULT true,
  auto_renewal BOOLEAN DEFAULT false,
  renewal_reminder_sent BOOLEAN DEFAULT false,
  renewal_reminder_date DATE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN (
    'draft',
    'active',
    'expired',
    'cancelled',
    'renewed'
  )),
  
  -- Cancellation
  cancelled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Commission (for referral to insurance company)
  referral_commission_percentage NUMERIC(5, 2) DEFAULT 0,
  referral_commission_amount NUMERIC(12, 2),
  commission_paid BOOLEAN DEFAULT false,
  commission_paid_date DATE,
  
  -- Documents
  policy_document_url TEXT,
  certificate_url TEXT,
  
  -- Beneficiary (if different from customer)
  beneficiary_name TEXT,
  beneficiary_relationship TEXT,
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

-- Indexes
CREATE INDEX idx_auto_insurance_policies_tenant ON auto_insurance_policies(tenant_id);
CREATE INDEX idx_auto_insurance_policies_customer ON auto_insurance_policies(customer_id);
CREATE INDEX idx_auto_insurance_policies_vehicle ON auto_insurance_policies(vehicle_id);
CREATE INDEX idx_auto_insurance_policies_sale ON auto_insurance_policies(sale_id);
CREATE INDEX idx_auto_insurance_policies_status ON auto_insurance_policies(tenant_id, status);
CREATE INDEX idx_auto_insurance_policies_expiry ON auto_insurance_policies(tenant_id, expiry_date);
CREATE INDEX idx_auto_insurance_policies_company ON auto_insurance_policies(tenant_id, insurance_company);
CREATE UNIQUE INDEX idx_auto_insurance_policies_number ON auto_insurance_policies(tenant_id, policy_number);

-- RLS Policies
ALTER TABLE auto_insurance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY auto_insurance_policies_tenant_isolation ON auto_insurance_policies
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);

-- Trigger for updated_at
CREATE TRIGGER trg_auto_insurance_policies_updated_at
  BEFORE UPDATE ON auto_insurance_policies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================================
-- RPC FUNCTIONS
-- =====================================================================================

-- Generate unique loan application number: LOAN{YYYYMMDD}-{sequence}
CREATE OR REPLACE FUNCTION generate_loan_application_number(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_date_prefix TEXT;
  v_sequence INTEGER;
  v_application_number TEXT;
BEGIN
  -- Format: LOAN{YYYYMMDD}-{sequence}
  v_date_prefix := 'LOAN' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD');
  
  -- Get next sequence for today
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(application_number FROM '\d+$') AS INTEGER)
  ), 0) + 1
  INTO v_sequence
  FROM auto_loan_applications
  WHERE tenant_id = p_tenant_id
    AND application_number LIKE v_date_prefix || '%';
  
  -- Format: LOAN20260803-0001
  v_application_number := v_date_prefix || '-' || LPAD(v_sequence::TEXT, 4, '0');
  
  RETURN v_application_number;
END;
$$;

-- GRANT EXECUTE
GRANT EXECUTE ON FUNCTION generate_loan_application_number TO authenticated;

-- Check for expiring insurance policies (for cron job / reminder service)
CREATE OR REPLACE FUNCTION check_expiring_insurance_policies(
  p_tenant_id UUID,
  p_days_before INTEGER DEFAULT 30
)
RETURNS TABLE (
  policy_id UUID,
  policy_number TEXT,
  customer_id UUID,
  customer_name TEXT,
  vehicle_id UUID,
  expiry_date DATE,
  days_until_expiry INTEGER,
  insurance_company TEXT,
  premium_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id AS policy_id,
    p.policy_number,
    p.customer_id,
    c.name AS customer_name,
    p.vehicle_id,
    p.expiry_date,
    (p.expiry_date - CURRENT_DATE) AS days_until_expiry,
    p.insurance_company,
    p.premium_amount
  FROM auto_insurance_policies p
  INNER JOIN customers c ON c.id = p.customer_id
  WHERE p.tenant_id = p_tenant_id
    AND p.status = 'active'
    AND p.expiry_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + p_days_before)
    AND (p.renewal_reminder_sent = false OR p.renewal_reminder_sent IS NULL)
  ORDER BY p.expiry_date ASC;
END;
$$;

-- GRANT EXECUTE
GRANT EXECUTE ON FUNCTION check_expiring_insurance_policies TO authenticated;

-- =====================================================================================
-- COMMENTS
-- =====================================================================================

COMMENT ON TABLE auto_loan_applications IS 'Phase 8: Bank loan applications for vehicle financing';
COMMENT ON TABLE auto_insurance_policies IS 'Phase 8: Insurance policies with auto-renewal reminders';

COMMENT ON COLUMN auto_loan_applications.documents_checklist IS 'JSONB checklist for required documents';
COMMENT ON COLUMN auto_insurance_policies.coverage_items IS 'JSONB list of coverage items for comprehensive insurance';

COMMENT ON FUNCTION generate_loan_application_number IS 'Generate unique loan application number: LOAN{YYYYMMDD}-{sequence}';
COMMENT ON FUNCTION check_expiring_insurance_policies IS 'Check for insurance policies expiring within specified days (default 30)';

-- =====================================================================================
-- END OF MIGRATION
-- =====================================================================================
