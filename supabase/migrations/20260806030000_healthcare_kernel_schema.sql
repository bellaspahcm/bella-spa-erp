-- ============================================================================
-- Bella Healthcare Platform — Healthcare Kernel Schema (Vertical Specific)
-- Migration: 20260806030000_healthcare_kernel_schema.sql
-- ============================================================================

-- 1. HEALTHCARE ENCOUNTERS (Clinical visits/interactions)
CREATE TABLE IF NOT EXISTS public.hc_encounters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    care_journey_id UUID NOT NULL REFERENCES public.journey_journeys(id) ON DELETE CASCADE,
    patient_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    doctor_party_id UUID REFERENCES public.party_parties(id) ON DELETE SET NULL,
    encounter_class TEXT NOT NULL CHECK (encounter_class IN ('walk_in', 'scheduled', 'emergency', 'telemedicine', 'follow_up', 'homecare')),
    status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'arrived', 'triaged', 'in_progress', 'finished', 'cancelled')),
    scheduled_at TIMESTAMPTZ,
    arrived_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    queue_number INTEGER,
    chief_complaint TEXT,
    notes TEXT,
    
    -- Auditing & Versioning
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hc_encounters_tenant ON public.hc_encounters(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_encounters_journey ON public.hc_encounters(care_journey_id);
CREATE INDEX IF NOT EXISTS idx_hc_encounters_patient ON public.hc_encounters(patient_party_id);
CREATE INDEX IF NOT EXISTS idx_hc_encounters_doctor ON public.hc_encounters(doctor_party_id);
CREATE INDEX IF NOT EXISTS idx_hc_encounters_deleted ON public.hc_encounters(deleted_at) WHERE deleted_at IS NULL;

-- 2. CLINICAL PRESCRIPTIONS (Linked to Encounters)
CREATE TABLE IF NOT EXISTS public.hc_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    encounter_id UUID NOT NULL REFERENCES public.hc_encounters(id) ON DELETE CASCADE,
    patient_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    doctor_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    drugs JSONB NOT NULL DEFAULT '[]', -- List of prescribed drugs: [{code, label, dose, frequency, duration_days}]
    diagnosis TEXT, -- Summary of diagnoses (ICD-10 codes)
    notes TEXT,
    
    -- Auditing & Versioning
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_hc_prescriptions_tenant ON public.hc_prescriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hc_prescriptions_encounter ON public.hc_prescriptions(encounter_id);
CREATE INDEX IF NOT EXISTS idx_hc_prescriptions_patient ON public.hc_prescriptions(patient_party_id);

-- 3. DENTAL ODONTOGRAMS (Specialty-specific schema for Odontogram UI)
CREATE TABLE IF NOT EXISTS public.den_odontograms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    patient_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    tooth_data JSONB NOT NULL DEFAULT '{}', -- { "11": { "status": "decayed", "notes": "sâu men răng" }, "12": { "status": "missing" } }
    updated_by UUID REFERENCES public.party_parties(id) ON DELETE SET NULL,
    
    -- Auditing & Versioning
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_den_odontograms_tenant ON public.den_odontograms(tenant_id);
CREATE INDEX IF NOT EXISTS idx_den_odontograms_patient ON public.den_odontograms(patient_party_id);

-- 4. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.hc_encounters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hc_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.den_odontograms ENABLE ROW LEVEL SECURITY;

-- 5. CREATE RLS TENANT ISOLATION POLICIES
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_encounters' AND policyname = 'tenant_isolation_hc_encounters') THEN
    CREATE POLICY tenant_isolation_hc_encounters ON public.hc_encounters FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'hc_prescriptions' AND policyname = 'tenant_isolation_hc_prescriptions') THEN
    CREATE POLICY tenant_isolation_hc_prescriptions ON public.hc_prescriptions FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'den_odontograms' AND policyname = 'tenant_isolation_den_odontograms') THEN
    CREATE POLICY tenant_isolation_den_odontograms ON public.den_odontograms FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;
