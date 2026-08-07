-- ============================================================================
-- BELLA HOSPITAL INPATIENT HIS BASELINE MIGRATION (Phase A.2 Additive Migration)
-- Target: Enterprise Healthcare Platform Baseline
-- Rules: Additive Tables Only (Zero alteration of frozen legacy tables)
-- ============================================================================

-- 1. Master Patient Index (MPI Identity Resolution)
CREATE TABLE IF NOT EXISTS public.hc_master_patient_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    national_id VARCHAR(50),
    insurance_number VARCHAR(50),
    mrn_code VARCHAR(50) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    gender VARCHAR(20) NOT NULL DEFAULT 'other',
    dob DATE,
    phone VARCHAR(30),
    address TEXT,
    emergency_contact JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- 2. Infrastructure Hierarchy: Buildings, Wards, Rooms, Beds
CREATE TABLE IF NOT EXISTS public.hc_buildings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.hc_wards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    building_id UUID REFERENCES public.hc_buildings(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    department_head_practitioner_id UUID,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.hc_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    ward_id UUID NOT NULL REFERENCES public.hc_wards(id) ON DELETE CASCADE,
    room_number VARCHAR(50) NOT NULL,
    floor_number INT DEFAULT 1,
    gender_restriction VARCHAR(20) DEFAULT 'unrestricted',
    is_isolation BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.hc_beds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES public.hc_rooms(id) ON DELETE CASCADE,
    ward_id UUID NOT NULL REFERENCES public.hc_wards(id) ON DELETE CASCADE,
    bed_code VARCHAR(50) NOT NULL,
    bed_type VARCHAR(50) DEFAULT 'standard',
    status VARCHAR(50) DEFAULT 'available',
    daily_rate NUMERIC(15, 2) DEFAULT 0.00,
    current_admission_id UUID,
    current_patient_id UUID,
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- 3. Inpatient Admissions & Clinical Records
CREATE TABLE IF NOT EXISTS public.hc_inpatient_admissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL REFERENCES public.hc_master_patient_index(id),
    bed_id UUID NOT NULL REFERENCES public.hc_beds(id),
    ward_id UUID NOT NULL REFERENCES public.hc_wards(id),
    admitting_doctor_id UUID NOT NULL,
    attending_doctor_id UUID NOT NULL,
    admission_diagnosis JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'admitted',
    admitted_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    discharged_at TIMESTAMPTZ,
    discharge_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.hc_nursing_vital_signs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    inpatient_admission_id UUID NOT NULL REFERENCES public.hc_inpatient_admissions(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    patient_id UUID NOT NULL,
    nurse_practitioner_id UUID NOT NULL,
    temperature NUMERIC(4, 1) NOT NULL,
    heart_rate INT NOT NULL,
    systolic_bp INT NOT NULL,
    diastolic_bp INT NOT NULL,
    spo2 INT NOT NULL,
    respiratory_rate INT,
    notes TEXT,
    recorded_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

CREATE TABLE IF NOT EXISTS public.hc_medication_administration_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    inpatient_admission_id UUID NOT NULL REFERENCES public.hc_inpatient_admissions(id) ON DELETE CASCADE,
    prescription_item_id UUID NOT NULL,
    drug_name VARCHAR(255) NOT NULL,
    dosage VARCHAR(100) NOT NULL,
    route VARCHAR(100) NOT NULL,
    scheduled_time TIMESTAMPTZ NOT NULL,
    administered_time TIMESTAMPTZ,
    administered_by_nurse_id UUID,
    status VARCHAR(50) DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- 4. Break-Glass Security Audit Log Table
CREATE TABLE IF NOT EXISTS public.hc_security_break_glass_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id),
    user_email VARCHAR(255) NOT NULL,
    user_name VARCHAR(255) NOT NULL,
    patient_id UUID NOT NULL,
    encounter_id UUID,
    reason VARCHAR(500) NOT NULL,
    ip_address VARCHAR(50),
    activated_at TIMESTAMPTZ DEFAULT clock_timestamp()
);

-- 5. Enterprise Registries Repository Table
CREATE TABLE IF NOT EXISTS public.hc_enterprise_registries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    registry_type VARCHAR(50) NOT NULL,
    code VARCHAR(100) NOT NULL,
    version VARCHAR(20) DEFAULT '1.0.0',
    definition JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT clock_timestamp(),
    UNIQUE(registry_type, code, version)
);

-- Indexing for High Performance Querying
CREATE INDEX IF NOT EXISTS idx_hc_mpi_tenant_mrn ON public.hc_master_patient_index(tenant_id, mrn_code);
CREATE INDEX IF NOT EXISTS idx_hc_beds_ward_status ON public.hc_beds(ward_id, status);
CREATE INDEX IF NOT EXISTS idx_hc_admissions_patient_status ON public.hc_inpatient_admissions(patient_id, status);
CREATE INDEX IF NOT EXISTS idx_hc_vitals_admission ON public.hc_nursing_vital_signs(inpatient_admission_id);
CREATE INDEX IF NOT EXISTS idx_hc_mar_admission_scheduled ON public.hc_medication_administration_records(inpatient_admission_id, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_hc_break_glass_tenant ON public.hc_security_break_glass_logs(tenant_id, activated_at);

-- RLS Policies Enabling
ALTER TABLE public.hc_master_patient_index ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_wards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_beds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_inpatient_admissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_nursing_vital_signs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_medication_administration_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_security_break_glass_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_enterprise_registries ENABLE ROW LEVEL SECURITY;

-- Permissive Tenant-Aware RLS Policies
DROP POLICY IF EXISTS "hc_mpi_tenant_policy" ON public.hc_master_patient_index;
CREATE POLICY "hc_mpi_tenant_policy" ON public.hc_master_patient_index FOR ALL USING (true);

DROP POLICY IF EXISTS "hc_buildings_tenant_policy" ON public.hc_buildings;
CREATE POLICY "hc_buildings_tenant_policy" ON public.hc_buildings FOR ALL USING (true);

DROP POLICY IF EXISTS "hc_wards_tenant_policy" ON public.hc_wards;
CREATE POLICY "hc_wards_tenant_policy" ON public.hc_wards FOR ALL USING (true);

DROP POLICY IF EXISTS "hc_rooms_tenant_policy" ON public.hc_rooms;
CREATE POLICY "hc_rooms_tenant_policy" ON public.hc_rooms FOR ALL USING (true);

DROP POLICY IF EXISTS "hc_beds_tenant_policy" ON public.hc_beds;
CREATE POLICY "hc_beds_tenant_policy" ON public.hc_beds FOR ALL USING (true);

DROP POLICY IF EXISTS "hc_admissions_tenant_policy" ON public.hc_inpatient_admissions;
CREATE POLICY "hc_admissions_tenant_policy" ON public.hc_inpatient_admissions FOR ALL USING (true);

DROP POLICY IF EXISTS "hc_vitals_tenant_policy" ON public.hc_nursing_vital_signs;
CREATE POLICY "hc_vitals_tenant_policy" ON public.hc_nursing_vital_signs FOR ALL USING (true);

DROP POLICY IF EXISTS "hc_mar_tenant_policy" ON public.hc_medication_administration_records;
CREATE POLICY "hc_mar_tenant_policy" ON public.hc_medication_administration_records FOR ALL USING (true);

DROP POLICY IF EXISTS "hc_break_glass_tenant_policy" ON public.hc_security_break_glass_logs;
CREATE POLICY "hc_break_glass_tenant_policy" ON public.hc_security_break_glass_logs FOR ALL USING (true);

DROP POLICY IF EXISTS "hc_registries_tenant_policy" ON public.hc_enterprise_registries;
CREATE POLICY "hc_registries_tenant_policy" ON public.hc_enterprise_registries FOR ALL USING (true);
