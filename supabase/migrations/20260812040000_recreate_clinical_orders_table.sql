-- ============================================================================
-- DESTRUCTIVE: Drop and recreate hc_clinical_orders
-- Reason: Old table has wrong schema (customer_id, status) vs migration (order_status, patient_party_id)
-- Safe: Test environment only, healthcare test data
-- ============================================================================

-- Drop existing policies first
DROP POLICY IF EXISTS tenant_isolation_clinical_orders ON public.hc_clinical_orders;

-- Drop existing table (CASCADE removes dependent objects)
DROP TABLE IF EXISTS public.hc_clinical_orders CASCADE;

-- Drop stub tables if they exist
DROP TABLE IF EXISTS public.hc_drugs CASCADE;
DROP TABLE IF EXISTS public.hc_clinical_calculations CASCADE;

-- ============================================================================
-- Recreate stub dependencies (for FK constraints)
-- ============================================================================

CREATE TABLE public.hc_drugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  drug_code TEXT NOT NULL UNIQUE,
  drug_name TEXT NOT NULL,
  generic_name TEXT,
  drug_class TEXT NOT NULL,
  atc_code TEXT,
  max_daily_dose_mg NUMERIC,
  weight_based_dosing BOOLEAN NOT NULL DEFAULT false,
  pediatric_contraindicated BOOLEAN NOT NULL DEFAULT false,
  pregnancy_category TEXT CHECK (pregnancy_category IN ('A', 'B', 'C', 'D', 'X')),
  kb_version TEXT NOT NULL DEFAULT '2026-08-01',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.hc_clinical_calculations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  algorithm_id TEXT NOT NULL,
  input_data JSONB NOT NULL,
  output_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Create hc_clinical_orders with CORRECT schema
-- Combines base (20260808000006) + extensions (20260812030000)
-- ============================================================================

CREATE TABLE public.hc_clinical_orders (
  -- Identity
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
  
  -- Order classification
  order_type TEXT NOT NULL CHECK (
    order_type IN ('MEDICATION', 'LAB', 'IMAGING', 'PROCEDURE', 'DIET', 'NURSING')
  ),
  order_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (
    order_status IN ('PENDING', 'VALIDATED', 'APPROVED', 'ACTIVE', 'COMPLETED', 'DISCONTINUED', 'REJECTED')
  ),
  priority TEXT NOT NULL DEFAULT 'ROUTINE' CHECK (priority IN ('STAT', 'URGENT', 'ROUTINE')),
  
  -- Ordering workflow
  ordered_by TEXT NOT NULL,
  ordered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  discontinued_by TEXT,
  discontinued_at TIMESTAMPTZ,
  discontinue_reason TEXT,
  
  -- CDS integration
  cds_check_id UUID REFERENCES public.hc_clinical_calculations(id) ON DELETE SET NULL,
  cds_check_status TEXT CHECK (cds_check_status IN ('PASSED', 'WARNED', 'BLOCKED')),
  
  -- Order payload
  order_details JSONB NOT NULL DEFAULT '{}',
  notes TEXT,
  
  -- Phase 0 extensions (from 20260812030000)
  patient_party_id UUID NOT NULL,
  request_id TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- Composite FK constraint (encounter_id + patient_party_id)
  CONSTRAINT fk_hc_clinical_orders_encounter_patient
    FOREIGN KEY (encounter_id, patient_party_id)
    REFERENCES public.hc_encounters(id, patient_party_id)
    ON DELETE CASCADE
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX idx_hc_clinical_orders_encounter 
  ON public.hc_clinical_orders(tenant_id, encounter_id);

CREATE INDEX idx_hc_clinical_orders_patient 
  ON public.hc_clinical_orders(tenant_id, patient_party_id);

CREATE INDEX idx_hc_clinical_orders_status 
  ON public.hc_clinical_orders(tenant_id, order_status);

CREATE INDEX idx_hc_clinical_orders_type_status 
  ON public.hc_clinical_orders(tenant_id, order_type, order_status);

CREATE INDEX idx_hc_clinical_orders_ordered_at 
  ON public.hc_clinical_orders(tenant_id, ordered_at DESC);

CREATE INDEX idx_hc_clinical_orders_version 
  ON public.hc_clinical_orders(tenant_id, id, version);

CREATE UNIQUE INDEX idx_hc_clinical_orders_request_id
  ON public.hc_clinical_orders(tenant_id, request_id)
  WHERE request_id IS NOT NULL;

-- ============================================================================
-- Row-Level Security
-- ============================================================================

ALTER TABLE public.hc_clinical_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_clinical_orders ON public.hc_clinical_orders
  FOR ALL TO authenticated 
  USING (tenant_id = public.get_auth_tenant_id())
  WITH CHECK (tenant_id = public.get_auth_tenant_id());
