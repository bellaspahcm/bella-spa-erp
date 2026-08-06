-- ============================================================================
-- Bella Healthcare Platform — Extended Canonical Domain Schema
-- Migration: 20260806050000_healthcare_platform_extended_schema.sql
-- Governance: Bella Healthcare Constitution v1.0 & Product Manifests
-- ============================================================================

-- 1. PATIENT PROFILES (1-1 Extension of Core `customers` Table)
CREATE TABLE IF NOT EXISTS public.patient_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE UNIQUE,
    blood_type TEXT DEFAULT 'UNKNOWN' CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'UNKNOWN')),
    rh_factor TEXT,
    known_allergies JSONB DEFAULT '[]'::jsonb,
    medical_history JSONB DEFAULT '[]'::jsonb,
    family_medical_history JSONB DEFAULT '[]'::jsonb,
    bhyt_code TEXT,
    bhyt_benefit_rate INTEGER DEFAULT 80,
    bhyt_initial_facility TEXT,
    bhyt_valid_from DATE,
    bhyt_valid_to DATE,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    emergency_contact_relationship TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_patient_profiles_tenant ON public.patient_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_customer ON public.patient_profiles(customer_id);
CREATE INDEX IF NOT EXISTS idx_patient_profiles_bhyt ON public.patient_profiles(bhyt_code);

-- 2. CLINICAL ORDERS TABLE
CREATE TABLE IF NOT EXISTS public.hc_clinical_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
    ordering_practitioner_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    order_type TEXT NOT NULL CHECK (order_type IN ('laboratory', 'imaging', 'medication', 'procedure', 'diet', 'rehabilitation')),
    status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('draft', 'placed', 'in_progress', 'completed', 'cancelled')),
    priority TEXT DEFAULT 'routine' CHECK (priority IN ('routine', 'urgent', 'emergency')),
    notes TEXT,
    ordered_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_clinical_orders_tenant ON public.hc_clinical_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_clinical_orders_encounter ON public.hc_clinical_orders(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hc_clinical_orders_customer ON public.hc_clinical_orders(customer_id);

-- 3. LABORATORY ORDERS & ITEMS (LIS Foundation)
CREATE TABLE IF NOT EXISTS public.hc_lab_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    clinical_order_id UUID NOT NULL REFERENCES public.hc_clinical_orders(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    test_code TEXT NOT NULL,
    test_name TEXT NOT NULL,
    sample_type TEXT,
    tube_color TEXT,
    result_value TEXT,
    result_unit TEXT,
    reference_range TEXT,
    is_abnormal BOOLEAN DEFAULT false,
    is_panic_value BOOLEAN DEFAULT false,
    verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_lab_orders_tenant ON public.hc_lab_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_lab_orders_clinical ON public.hc_lab_orders(clinical_order_id);
CREATE INDEX IF NOT EXISTS idx_hc_lab_orders_encounter ON public.hc_lab_orders(encounter_id);

-- 4. IMAGING ORDERS & DICOM LINKS (RIS Foundation)
CREATE TABLE IF NOT EXISTS public.hc_imaging_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    clinical_order_id UUID NOT NULL REFERENCES public.hc_clinical_orders(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    modality TEXT NOT NULL CHECK (modality IN ('XRAY', 'CT', 'MRI', 'ULTRASOUND', 'ENDOSCOPY')),
    body_site TEXT NOT NULL,
    dcm_study_uid TEXT,
    viewer_link TEXT,
    radiologist_report TEXT,
    radiologist_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_imaging_orders_tenant ON public.hc_imaging_orders(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_imaging_orders_clinical ON public.hc_imaging_orders(clinical_order_id);

-- 5. DRUG PROFILES (Healthcare Extension for `inventory_items`)
CREATE TABLE IF NOT EXISTS public.hc_drug_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    inventory_item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE UNIQUE,
    drug_code TEXT NOT NULL,
    active_ingredient TEXT NOT NULL,
    atc_code TEXT,
    dosage_form TEXT, -- e.g., Viên nén, Dung dịch
    strength TEXT, -- e.g., 500mg, 10mg/ml
    route_of_administration TEXT,
    is_controlled_drug BOOLEAN DEFAULT false,
    is_cold_storage BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_drug_profiles_tenant ON public.hc_drug_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_drug_profiles_item ON public.hc_drug_profiles(inventory_item_id);

-- 6. PATIENT JOURNEY WORKFLOW QUEUE
CREATE TABLE IF NOT EXISTS public.hc_patient_queues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    ticket_number TEXT NOT NULL,
    queue_type TEXT DEFAULT 'service' CHECK (queue_type IN ('bhyt', 'service', 'followup', 'priority')),
    current_station TEXT DEFAULT 'registration' CHECK (current_station IN ('registration', 'vitals', 'consultation', 'lab', 'imaging', 'review', 'billing', 'pharmacy')),
    status TEXT DEFAULT 'waiting' CHECK (status IN ('waiting', 'called', 'in_service', 'completed', 'skipped')),
    called_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hc_patient_queues_tenant ON public.hc_patient_queues(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_patient_queues_encounter ON public.hc_patient_queues(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hc_patient_queues_station ON public.hc_patient_queues(tenant_id, current_station, status);

-- 7. ENABLE RLS
ALTER TABLE public.patient_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_clinical_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_lab_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_imaging_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_drug_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_patient_queues ENABLE ROW LEVEL SECURITY;

-- 8. CREATE RLS POLICIES (Tenant Isolation)
CREATE POLICY tenant_isolation_patient_profiles ON public.patient_profiles
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_hc_clinical_orders ON public.hc_clinical_orders
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_hc_lab_orders ON public.hc_lab_orders
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_hc_imaging_orders ON public.hc_imaging_orders
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_hc_drug_profiles ON public.hc_drug_profiles
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_hc_patient_queues ON public.hc_patient_queues
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());
