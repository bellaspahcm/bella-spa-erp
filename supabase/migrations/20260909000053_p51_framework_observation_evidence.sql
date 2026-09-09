-- Migration: 20260909000053_p51_framework_observation_evidence.sql
-- Description: Adds tables for Preschool Learning & Development P5.1 with Framework Domains, Immutable DB Version Locks, Supersession Amendment Versioning, Per-child Milestone Ownership, and Consent/Visibility Scopes.

-- 1. Framework Registry
CREATE TABLE IF NOT EXISTS public.edu_dev_frameworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_edu_dev_framework_code UNIQUE (tenant_id, code)
);

-- 2. Framework Version Governance
CREATE TABLE IF NOT EXISTS public.edu_dev_framework_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    framework_id UUID NOT NULL REFERENCES public.edu_dev_frameworks(id) ON DELETE CASCADE,
    version VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ACTIVE', 'ARCHIVED')),
    checksum VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_edu_dev_framework_version UNIQUE (framework_id, version)
);

-- Partial Unique Index: Exactly one ACTIVE version per framework
CREATE UNIQUE INDEX IF NOT EXISTS uq_active_framework_version 
ON public.edu_dev_framework_versions (framework_id) 
WHERE status = 'ACTIVE';

-- 3. Framework-Owned Domains / Outcomes (Preserves exact framework ontology)
CREATE TABLE IF NOT EXISTS public.edu_dev_framework_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    framework_version_id UUID NOT NULL REFERENCES public.edu_dev_framework_versions(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_edu_dev_framework_domain_code UNIQUE (framework_version_id, code)
);

-- 4. Milestone Indicators Mapped to Framework Version & Domain
CREATE TABLE IF NOT EXISTS public.edu_dev_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    framework_version_id UUID NOT NULL REFERENCES public.edu_dev_framework_versions(id) ON DELETE CASCADE,
    framework_domain_id UUID NOT NULL REFERENCES public.edu_dev_framework_domains(id) ON DELETE CASCADE,
    min_age_months INT,
    max_age_months INT,
    code VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    indicator_statement TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_edu_dev_milestone_code UNIQUE (framework_version_id, code)
);

-- DB-Level Invariant Trigger: Prevent DB mutation of domains & milestones if framework version is ACTIVE or ARCHIVED
CREATE OR REPLACE FUNCTION public.check_framework_version_mutable()
RETURNS TRIGGER AS $$
DECLARE
  v_status VARCHAR(20);
BEGIN
  SELECT status INTO v_status FROM public.edu_dev_framework_versions WHERE id = NEW.framework_version_id;
  IF v_status IS NOT NULL AND v_status != 'DRAFT' THEN
    RAISE EXCEPTION 'FRAMEWORK_VERSION_LOCKED_ERROR: Cannot mutate framework elements in % version', v_status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_check_milestone_mutable ON public.edu_dev_milestones;
CREATE TRIGGER trg_check_milestone_mutable
BEFORE INSERT OR UPDATE ON public.edu_dev_milestones
FOR EACH ROW EXECUTE FUNCTION public.check_framework_version_mutable();

DROP TRIGGER IF EXISTS trg_check_domain_mutable ON public.edu_dev_framework_domains;
CREATE TRIGGER trg_check_domain_mutable
BEFORE INSERT OR UPDATE ON public.edu_dev_framework_domains
FOR EACH ROW EXECUTE FUNCTION public.check_framework_version_mutable();

-- 5. Classroom Activities (Planned Context)
CREATE TABLE IF NOT EXISTS public.edu_dev_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    class_id UUID NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    planned_date DATE NOT NULL DEFAULT CURRENT_DATE,
    status VARCHAR(20) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Observation Records (Supports spontaneous observations with activity_id = NULL)
CREATE TABLE IF NOT EXISTS public.edu_dev_observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    activity_id UUID REFERENCES public.edu_dev_activities(id) ON DELETE SET NULL,
    observer_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'RECORDED' CHECK (status IN ('DRAFT', 'RECORDED', 'SUPERSEDED')),
    supersedes_observation_id UUID REFERENCES public.edu_dev_observations(id),
    observation_text TEXT NOT NULL,
    amended_at TIMESTAMPTZ,
    amended_by UUID,
    amendment_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Per-Child Observation Membership (Aggregate Boundary)
CREATE TABLE IF NOT EXISTS public.edu_dev_observation_students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    observation_id UUID NOT NULL REFERENCES public.edu_dev_observations(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(student_id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_edu_dev_obs_student UNIQUE (observation_id, student_id)
);

-- 8. Tagged Milestone Indicators Owned strictly by Per-Child Observation Membership
CREATE TABLE IF NOT EXISTS public.edu_dev_observation_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    observation_student_id UUID NOT NULL REFERENCES public.edu_dev_observation_students(id) ON DELETE CASCADE,
    milestone_id UUID NOT NULL REFERENCES public.edu_dev_milestones(id) ON DELETE CASCADE,
    framework_version_id UUID NOT NULL REFERENCES public.edu_dev_framework_versions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_edu_dev_obs_student_milestone UNIQUE (observation_student_id, milestone_id)
);

-- 9. Evidence Storage with Child/Context Distinction & Separate Consent / Visibility Scopes
CREATE TABLE IF NOT EXISTS public.edu_dev_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    observation_id UUID NOT NULL REFERENCES public.edu_dev_observations(id) ON DELETE CASCADE,
    observation_student_id UUID REFERENCES public.edu_dev_observation_students(id) ON DELETE CASCADE,
    evidence_type VARCHAR(50) NOT NULL DEFAULT 'PHOTO',
    storage_reference VARCHAR(500) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    visibility VARCHAR(30) NOT NULL DEFAULT 'INTERNAL_TEACHER' CHECK (visibility IN ('INTERNAL_TEACHER', 'SCHOOL_STAFF', 'PARENT_SHARED', 'PORTFOLIO_PUBLISHED')),
    consent_scope VARCHAR(100) NOT NULL DEFAULT 'CONSENT_VERIFIED',
    captured_by UUID NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS & Define Policies
ALTER TABLE public.edu_dev_frameworks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_dev_framework_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_dev_framework_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_dev_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_dev_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_dev_observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_dev_observation_students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_dev_observation_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_dev_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY edu_dev_frameworks_tenant_policy ON public.edu_dev_frameworks FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY edu_dev_framework_versions_tenant_policy ON public.edu_dev_framework_versions FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY edu_dev_framework_domains_tenant_policy ON public.edu_dev_framework_domains FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY edu_dev_milestones_tenant_policy ON public.edu_dev_milestones FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY edu_dev_activities_tenant_policy ON public.edu_dev_activities FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY edu_dev_observations_tenant_policy ON public.edu_dev_observations FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY edu_dev_observation_students_tenant_policy ON public.edu_dev_observation_students FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY edu_dev_observation_milestones_tenant_policy ON public.edu_dev_observation_milestones FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
CREATE POLICY edu_dev_evidence_tenant_policy ON public.edu_dev_evidence FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
