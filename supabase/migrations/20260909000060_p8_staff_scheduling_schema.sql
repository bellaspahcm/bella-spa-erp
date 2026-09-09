-- ============================================================================
-- Bella Preschool OS — Phase P8.1 Staff Scheduling & Caregiver Ratio Schema
-- Migration: 20260909000060_p8_staff_scheduling_schema.sql
-- ============================================================================

-- 1. Shift Templates Table
CREATE TABLE IF NOT EXISTS public.edu_sched_shift_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Ratio Policies Table
CREATE TABLE IF NOT EXISTS public.edu_sched_ratio_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    age_group TEXT NOT NULL,
    max_children_per_caregiver INTEGER NOT NULL CHECK (max_children_per_caregiver > 0),
    min_lead_teachers INTEGER NOT NULL DEFAULT 1 CHECK (min_lead_teachers >= 0),
    activity_context TEXT NOT NULL DEFAULT 'CLASSROOM_STANDARD',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT edu_sched_ratio_unique_tenant_group_context UNIQUE (tenant_id, age_group, activity_context)
);

-- 3. Staff Availability Table
CREATE TABLE IF NOT EXISTS public.edu_sched_staff_availability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    staff_party_id UUID NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
    shift_template_id UUID REFERENCES public.edu_sched_shift_templates(id) ON DELETE RESTRICT,
    is_available BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Shift Assignments Table (Supports Append-Only Amendments)
CREATE TABLE IF NOT EXISTS public.edu_sched_shift_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    classroom_id UUID NOT NULL,
    shift_template_id UUID NOT NULL REFERENCES public.edu_sched_shift_templates(id) ON DELETE RESTRICT,
    staff_party_id UUID NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('LEAD_TEACHER', 'ASSISTANT_TEACHER', 'CAREGIVER')),
    assignment_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'REPLACED')),
    amendment_version INTEGER NOT NULL DEFAULT 1 CHECK (amendment_version >= 1),
    superseded_assignment_id UUID REFERENCES public.edu_sched_shift_assignments(id) ON DELETE NO ACTION,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Leave Requests Table
CREATE TABLE IF NOT EXISTS public.edu_sched_leave_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    staff_party_id UUID NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    leave_type TEXT NOT NULL CHECK (leave_type IN ('SICK_LEAVE', 'ANNUAL_LEAVE', 'EMERGENCY_LEAVE')),
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    approved_by_party_id UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT edu_sched_leave_dates_check CHECK (end_date >= start_date)
);

-- 6. Substitutions Table
CREATE TABLE IF NOT EXISTS public.edu_sched_substitutions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    original_assignment_id UUID NOT NULL REFERENCES public.edu_sched_shift_assignments(id) ON DELETE NO ACTION,
    leave_request_id UUID REFERENCES public.edu_sched_leave_requests(id) ON DELETE NO ACTION,
    substitute_staff_party_id UUID NOT NULL,
    assigned_by_party_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Compliance Snapshots Table
CREATE TABLE IF NOT EXISTS public.edu_sched_compliance_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
    classroom_id UUID NOT NULL,
    snapshot_date DATE NOT NULL,
    shift_template_id UUID REFERENCES public.edu_sched_shift_templates(id) ON DELETE RESTRICT,
    enrolled_children INTEGER NOT NULL DEFAULT 0,
    expected_children INTEGER NOT NULL DEFAULT 0,
    present_children INTEGER NOT NULL DEFAULT 0,
    assigned_caregivers INTEGER NOT NULL DEFAULT 0,
    required_caregivers INTEGER NOT NULL DEFAULT 0,
    compliance_state TEXT NOT NULL CHECK (compliance_state IN ('COMPLIANT', 'SHORTAGE_VIOLATION')),
    shortage_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for Fast Tenant & Classroom Queries
CREATE INDEX IF NOT EXISTS idx_edu_sched_shift_assignments_tenant_class_date 
    ON public.edu_sched_shift_assignments(tenant_id, classroom_id, assignment_date);

CREATE INDEX IF NOT EXISTS idx_edu_sched_leave_requests_tenant_staff 
    ON public.edu_sched_leave_requests(tenant_id, staff_party_id, status);

CREATE INDEX IF NOT EXISTS idx_edu_sched_compliance_snapshots_tenant_class 
    ON public.edu_sched_compliance_snapshots(tenant_id, classroom_id, snapshot_date);

-- Enable RLS on all P8 Scheduling Tables
ALTER TABLE public.edu_sched_shift_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_sched_ratio_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_sched_staff_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_sched_shift_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_sched_leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_sched_substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edu_sched_compliance_snapshots ENABLE ROW LEVEL SECURITY;

-- Permissive Multi-Tenant RLS Policies
CREATE POLICY edu_sched_shift_templates_tenant_isolation ON public.edu_sched_shift_templates
    FOR ALL USING (tenant_id IS NOT NULL);

CREATE POLICY edu_sched_ratio_policies_tenant_isolation ON public.edu_sched_ratio_policies
    FOR ALL USING (tenant_id IS NOT NULL);

CREATE POLICY edu_sched_staff_availability_tenant_isolation ON public.edu_sched_staff_availability
    FOR ALL USING (tenant_id IS NOT NULL);

CREATE POLICY edu_sched_shift_assignments_tenant_isolation ON public.edu_sched_shift_assignments
    FOR ALL USING (tenant_id IS NOT NULL);

CREATE POLICY edu_sched_leave_requests_tenant_isolation ON public.edu_sched_leave_requests
    FOR ALL USING (tenant_id IS NOT NULL);

CREATE POLICY edu_sched_substitutions_tenant_isolation ON public.edu_sched_substitutions
    FOR ALL USING (tenant_id IS NOT NULL);

CREATE POLICY edu_sched_compliance_snapshots_tenant_isolation ON public.edu_sched_compliance_snapshots
    FOR ALL USING (tenant_id IS NOT NULL);

-- Grant privileges
GRANT ALL ON public.edu_sched_shift_templates TO anon, authenticated, service_role;
GRANT ALL ON public.edu_sched_ratio_policies TO anon, authenticated, service_role;
GRANT ALL ON public.edu_sched_staff_availability TO anon, authenticated, service_role;
GRANT ALL ON public.edu_sched_shift_assignments TO anon, authenticated, service_role;
GRANT ALL ON public.edu_sched_leave_requests TO anon, authenticated, service_role;
GRANT ALL ON public.edu_sched_substitutions TO anon, authenticated, service_role;
GRANT ALL ON public.edu_sched_compliance_snapshots TO anon, authenticated, service_role;
