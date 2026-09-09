-- Migration: 20260909000054_p52_milestone_progress_next_steps.sql
-- Description: Adds tables for Preschool Learning & Development P5.2 (Milestone Progress Interpretation, Evidence Links & Actionable Next Steps)

-- 1. Milestone Progress Interpretation Records
CREATE TABLE IF NOT EXISTS public.edu_dev_milestone_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    student_id UUID NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
    framework_version_id UUID NOT NULL REFERENCES public.edu_dev_framework_versions(id) ON DELETE CASCADE,
    milestone_id UUID NOT NULL REFERENCES public.edu_dev_milestones(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'DEVELOPING',
    interpreted_by UUID NOT NULL,
    interpreted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rationale TEXT NOT NULL,
    is_confirmed BOOLEAN NOT NULL DEFAULT TRUE,
    status_lifecycle VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status_lifecycle IN ('ACTIVE', 'SUPERSEDED')),
    supersedes_progress_id UUID REFERENCES public.edu_dev_milestone_progress(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Mandatory Evidence Linking for Progress Interpretation
CREATE TABLE IF NOT EXISTS public.edu_dev_progress_evidence_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    progress_id UUID NOT NULL REFERENCES public.edu_dev_milestone_progress(id) ON DELETE CASCADE,
    evidence_id UUID NOT NULL REFERENCES public.edu_dev_evidence(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_progress_evidence UNIQUE (progress_id, evidence_id)
);

-- 3. Actionable Next Steps / Teacher & Home Support Plan
CREATE TABLE IF NOT EXISTS public.edu_dev_next_steps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    student_id UUID NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
    milestone_progress_id UUID REFERENCES public.edu_dev_milestone_progress(id) ON DELETE SET NULL,
    milestone_id UUID NOT NULL REFERENCES public.edu_dev_milestones(id) ON DELETE CASCADE,
    context VARCHAR(20) NOT NULL DEFAULT 'CLASSROOM' CHECK (context IN ('CLASSROOM', 'HOME')),
    recommendation TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
    target_review_date DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'COMPLETED', 'CANCELLED')),
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS & Define Policies
ALTER TABLE public.edu_dev_milestone_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_dev_progress_evidence_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_dev_next_steps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'edu_dev_milestone_progress_tenant_policy') THEN
        CREATE POLICY edu_dev_milestone_progress_tenant_policy ON public.edu_dev_milestone_progress FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'edu_dev_progress_evidence_links_tenant_policy') THEN
        CREATE POLICY edu_dev_progress_evidence_links_tenant_policy ON public.edu_dev_progress_evidence_links FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'edu_dev_next_steps_tenant_policy') THEN
        CREATE POLICY edu_dev_next_steps_tenant_policy ON public.edu_dev_next_steps FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
    END IF;
END $$;
