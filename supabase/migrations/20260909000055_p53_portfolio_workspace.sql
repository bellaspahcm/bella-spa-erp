-- Migration: 20260909000055_p53_portfolio_workspace.sql
-- Description: Adds tables for Preschool Learning & Development P5.3 (Versioned Developmental Portfolios, Items, Publications & Consent Guards)

-- 1. Long-term Portfolio Identity per Student
CREATE TABLE IF NOT EXISTS public.edu_dev_portfolios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    student_id UUID NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_edu_dev_student_portfolio UNIQUE (tenant_id, student_id)
);

-- 2. Versioned Portfolio Compilations
CREATE TABLE IF NOT EXISTS public.edu_dev_portfolio_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    portfolio_id UUID NOT NULL REFERENCES public.edu_dev_portfolios(id) ON DELETE CASCADE,
    version_number INT NOT NULL DEFAULT 1,
    period_label VARCHAR(100) NOT NULL, -- e.g. "Term 1 2026", "Spring 2026"
    status VARCHAR(25) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'READY_TO_PUBLISH', 'PUBLISHED')),
    compiled_by UUID NOT NULL,
    compiled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_portfolio_version UNIQUE (portfolio_id, version_number)
);

-- 3. Canonical Item References in Portfolio
CREATE TABLE IF NOT EXISTS public.edu_dev_portfolio_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    portfolio_version_id UUID NOT NULL REFERENCES public.edu_dev_portfolio_versions(id) ON DELETE CASCADE,
    item_type VARCHAR(30) NOT NULL CHECK (item_type IN ('OBSERVATION', 'EVIDENCE', 'MILESTONE_PROGRESS', 'NEXT_STEP')),
    reference_id UUID NOT NULL, -- FK to target canonical entity
    teacher_comment TEXT,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_portfolio_version_ref UNIQUE (portfolio_version_id, item_type, reference_id)
);

-- 4. Publication Record & Parent Provenance Snapshot
CREATE TABLE IF NOT EXISTS public.edu_dev_portfolio_publications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    portfolio_version_id UUID NOT NULL REFERENCES public.edu_dev_portfolio_versions(id) ON DELETE CASCADE,
    publisher_id UUID NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    publication_checksum VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- DB-Level Trigger: Prevent mutation of published portfolio versions and items
CREATE OR REPLACE FUNCTION public.check_portfolio_version_mutable()
RETURNS TRIGGER AS $$
DECLARE
  v_status VARCHAR(25);
BEGIN
  IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
    SELECT status INTO v_status FROM public.edu_dev_portfolio_versions WHERE id = OLD.portfolio_version_id;
  ELSE
    SELECT status INTO v_status FROM public.edu_dev_portfolio_versions WHERE id = NEW.portfolio_version_id;
  END IF;

  IF v_status = 'PUBLISHED' THEN
    RAISE EXCEPTION 'PORTFOLIO_PUBLISHED_IMMUTABLE_ERROR: Cannot modify elements of a published portfolio version.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_portfolio_item_mutable ON public.edu_dev_portfolio_items;
CREATE TRIGGER trg_check_portfolio_item_mutable
BEFORE INSERT OR UPDATE OR DELETE ON public.edu_dev_portfolio_items
FOR EACH ROW EXECUTE FUNCTION public.check_portfolio_version_mutable();

-- Enable RLS & Define Policies
ALTER TABLE public.edu_dev_portfolios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_dev_portfolio_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_dev_portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_dev_portfolio_publications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'edu_dev_portfolios_tenant_policy') THEN
        CREATE POLICY edu_dev_portfolios_tenant_policy ON public.edu_dev_portfolios FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'edu_dev_portfolio_versions_tenant_policy') THEN
        CREATE POLICY edu_dev_portfolio_versions_tenant_policy ON public.edu_dev_portfolio_versions FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'edu_dev_portfolio_items_tenant_policy') THEN
        CREATE POLICY edu_dev_portfolio_items_tenant_policy ON public.edu_dev_portfolio_items FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'edu_dev_portfolio_publications_tenant_policy') THEN
        CREATE POLICY edu_dev_portfolio_publications_tenant_policy ON public.edu_dev_portfolio_publications FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
    END IF;
END $$;
