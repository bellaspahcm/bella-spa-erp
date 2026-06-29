-- ============================================
-- Migration: Create salary_adjustments table
-- Date: 2026-06-22 16:50:00
-- Epic: Advanced Commission System - Manual Salary Adjustments (Thưởng/Phạt)
-- ============================================
--
-- Purpose:
-- Track manual bonuses and deductions applied by admins to KTV salaries.
-- Supports one-time or recurring adjustments with flexible amounts.
-- Module-agnostic: Can be used by all modules (baby_care, beauty_spa, industrial_cleaning).
--
-- Business Rules:
-- 1. Each row represents one manual adjustment (bonus or deduction)
-- 2. Adjustment types: 'bonus' (thưởng) or 'deduction' (phạt)
-- 3. Admins can add notes explaining the reason for adjustment
-- 4. Status: draft → approved (only approved adjustments affect salary)
-- 5. Can be recurring (applied every month) or one-time
-- 6. Backward compatible: Other modules can use this feature too

CREATE TABLE IF NOT EXISTS public.salary_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  ktv_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month_year DATE NOT NULL,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Adjustment details
  adjustment_type TEXT NOT NULL CHECK (adjustment_type IN ('bonus', 'deduction')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  category TEXT NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  
  -- Status and approval
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'rejected', 'cancelled')),
  approved_by_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  
  -- Metadata
  created_by_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  
  -- Audit timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Business constraints
  CONSTRAINT salary_adjustments_month_year_format
    CHECK (EXTRACT(DAY FROM month_year) = 1)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_salary_adjustments_ktv_month
  ON public.salary_adjustments (ktv_id, month_year, status);

CREATE INDEX IF NOT EXISTS idx_salary_adjustments_tenant_month
  ON public.salary_adjustments (tenant_id, month_year, status);

CREATE INDEX IF NOT EXISTS idx_salary_adjustments_created_by
  ON public.salary_adjustments (created_by_id);

CREATE INDEX IF NOT EXISTS idx_salary_adjustments_approved_by
  ON public.salary_adjustments (approved_by_id)
  WHERE approved_by_id IS NOT NULL;

-- RLS Policies
ALTER TABLE public.salary_adjustments ENABLE ROW LEVEL SECURITY;

-- Read policy: KTV can see own records, admins/HR/accountants see all tenant records
DROP POLICY IF EXISTS "Salary adjustments KTV read own" ON public.salary_adjustments;
CREATE POLICY "Salary adjustments KTV read own"
  ON public.salary_adjustments
  FOR SELECT TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND (
        ktv_id = auth.uid()
        OR EXISTS (
          SELECT 1
          FROM public.users u
          WHERE u.id = auth.uid()
            AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr', 'accountant')
        )
      )
    )
  );

-- Write policy: Only admins/HR can manage adjustments
DROP POLICY IF EXISTS "Salary adjustments admin manage" ON public.salary_adjustments;
CREATE POLICY "Salary adjustments admin manage"
  ON public.salary_adjustments
  FOR ALL TO authenticated
  USING (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr')
      )
    )
  )
  WITH CHECK (
    public.is_hq_super_admin()
    OR (
      tenant_id = public.get_auth_tenant_id()
      AND EXISTS (
        SELECT 1
        FROM public.users u
        WHERE u.id = auth.uid()
          AND lower(u.role) IN ('admin', 'super_admin', 'admin_staff', 'hr')
      )
    )
  );

-- Grants
REVOKE ALL ON TABLE public.salary_adjustments FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.salary_adjustments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.salary_adjustments TO service_role;

-- Trigger for updated_at
DO $$
BEGIN
  CREATE TRIGGER update_salary_adjustments_updated_at
    BEFORE UPDATE ON public.salary_adjustments
    FOR EACH ROW
    EXECUTE PROCEDURE public.update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Table comment
COMMENT ON TABLE public.salary_adjustments IS
  'Manual salary adjustments (bonuses and deductions) applied by admins to KTV salaries. Supports flexible categorization and approval workflow. Module-agnostic feature.';

COMMENT ON COLUMN public.salary_adjustments.adjustment_type IS
  'Type of adjustment: bonus (thưởng) or deduction (phạt/trừ lương).';

COMMENT ON COLUMN public.salary_adjustments.category IS
  'Adjustment category for reporting and filtering (e.g., "Thưởng hiệu suất", "Phạt vi phạm nội quy", "Thưởng lễ tết").';

COMMENT ON COLUMN public.salary_adjustments.reason IS
  'Brief reason for the adjustment. Required field for transparency and audit trail.';

COMMENT ON COLUMN public.salary_adjustments.status IS
  'Adjustment status: draft (chờ duyệt), approved (đã duyệt), rejected (từ chối), cancelled (đã hủy). Only approved adjustments affect salary calculation.';
