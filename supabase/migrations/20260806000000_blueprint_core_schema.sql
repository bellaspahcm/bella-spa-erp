-- ============================================================================
-- Bella AI Platform — Industry Blueprint Core Schema
-- Migration: 20260806000000_blueprint_core_schema.sql
-- ============================================================================

-- 1. PARTY PARTIES (Identity Aggregate)
CREATE TABLE IF NOT EXISTS public.party_parties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    party_type TEXT NOT NULL CHECK (party_type IN ('person', 'organization')),
    display_name TEXT NOT NULL,
    legal_name TEXT,
    tax_code TEXT,
    dob DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    blood_type TEXT,
    
    -- Auditing & Optimistic Locking
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

-- Indexes for Party Parties
CREATE INDEX IF NOT EXISTS idx_party_parties_tenant ON public.party_parties(tenant_id);
CREATE INDEX IF NOT EXISTS idx_party_parties_type ON public.party_parties(party_type);
CREATE INDEX IF NOT EXISTS idx_party_parties_deleted ON public.party_parties(deleted_at) WHERE deleted_at IS NULL;

-- 2. PARTY DYNAMIC IDENTIFIERS (CCCD, Passport, BHYT, external HIS ID...)
CREATE TABLE IF NOT EXISTS public.party_identifiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    identifier_type TEXT NOT NULL, -- 'cccd', 'passport', 'bhyt', 'tax_id', 'external_his_id', 'crm_id', 'license_number'
    identifier_value TEXT NOT NULL,
    issued_at DATE,
    expires_at DATE,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, identifier_type, identifier_value)
);

CREATE INDEX IF NOT EXISTS idx_party_identifiers_party ON public.party_identifiers(party_id);
CREATE INDEX IF NOT EXISTS idx_party_identifiers_lookup ON public.party_identifiers(tenant_id, identifier_type, identifier_value);

-- 3. PARTY RELATIONSHIPS (Guardian, structures, memberships...)
CREATE TABLE IF NOT EXISTS public.party_relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    source_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    target_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    relationship_type TEXT NOT NULL, -- 'parent_of', 'guardian_of', 'works_for', 'referred_by', 'member_of'
    attributes JSONB NOT NULL DEFAULT '{}',
    active_from DATE DEFAULT CURRENT_DATE,
    active_to DATE,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, source_party_id, target_party_id, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_party_relationships_source ON public.party_relationships(source_party_id);
CREATE INDEX IF NOT EXISTS idx_party_relationships_target ON public.party_relationships(target_party_id);

-- 4. PARTY ROLES (Context-aware dynamic roles)
CREATE TABLE IF NOT EXISTS public.party_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL, -- 'healthcare', 'auto', 'real_estate'
    role_type TEXT NOT NULL, -- 'patient', 'doctor', 'buyer', 'technician'...
    attributes JSONB NOT NULL DEFAULT '{}',
    active_from DATE DEFAULT CURRENT_DATE,
    active_to DATE,
    UNIQUE (tenant_id, party_id, vertical, role_type)
);

CREATE INDEX IF NOT EXISTS idx_party_roles_lookup ON public.party_roles(tenant_id, vertical, role_type);

-- 5. JOURNEY JOURNEYS (Business Aggregate Root)
CREATE TABLE IF NOT EXISTS public.journey_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    journey_type TEXT NOT NULL, -- 'implant_care', 'car_repair', 'buying_process'
    primary_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    completed_at TIMESTAMPTZ,
    ai_summary TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_journey_journeys_tenant ON public.journey_journeys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_journey_journeys_party ON public.journey_journeys(primary_party_id);

-- 6. JOURNEY SUB-JOURNEYS (Distinct phases with their own lifecycle)
CREATE TABLE IF NOT EXISTS public.journey_sub_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    journey_id UUID NOT NULL REFERENCES public.journey_journeys(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- 'implant_surgery_stage', 'prosthetic_stage'
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journey_sub_journeys_journey ON public.journey_sub_journeys(journey_id);

-- 7. JOURNEY MILESTONES (Progress markers with AI validation)
CREATE TABLE IF NOT EXISTS public.journey_milestones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    journey_id UUID NOT NULL REFERENCES public.journey_journeys(id) ON DELETE CASCADE,
    sub_journey_id UUID REFERENCES public.journey_sub_journeys(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- 'implant_placement', 'healing_complete', 'crown_fitting'
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped')),
    target_date DATE,
    completed_at TIMESTAMPTZ,
    ai_validation_details JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (journey_id, name)
);

CREATE INDEX IF NOT EXISTS idx_journey_milestones_sub ON public.journey_milestones(sub_journey_id);

-- 8. TIMELINE EVENTS (Platform Event Store - Append-only)
CREATE TABLE IF NOT EXISTS public.timeline_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    primary_party_id UUID NOT NULL REFERENCES public.party_parties(id) ON DELETE CASCADE,
    journey_id UUID REFERENCES public.journey_journeys(id) ON DELETE SET NULL,
    correlation_id UUID NOT NULL,
    causation_id UUID,
    event_category TEXT NOT NULL CHECK (event_category IN ('business', 'audit', 'ai', 'system')),
    event_type TEXT NOT NULL,
    event_version TEXT NOT NULL DEFAULT 'v1',
    schema_version TEXT NOT NULL DEFAULT '1.0.0',
    aggregate_id UUID NOT NULL,
    aggregate_type TEXT NOT NULL,
    sequence_number INTEGER NOT NULL,
    event_hash TEXT NOT NULL,
    reference_table TEXT,
    reference_id UUID,
    summary TEXT NOT NULL,
    ai_insight TEXT,
    event_data JSONB NOT NULL DEFAULT '{}',
    recorded_by UUID REFERENCES public.party_parties(id),
    occurred_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, aggregate_type, aggregate_id, sequence_number)
);

CREATE INDEX IF NOT EXISTS idx_timeline_events_party ON public.timeline_events(primary_party_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_events_correlation ON public.timeline_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_aggregate ON public.timeline_events(aggregate_type, aggregate_id);

-- Enforce Timeline Immutability (no UPDATE or DELETE at DB level)
CREATE OR REPLACE RULE timeline_events_no_update AS ON UPDATE TO public.timeline_events DO INSTEAD NOTHING;
CREATE OR REPLACE RULE timeline_events_no_delete AS ON DELETE TO public.timeline_events DO INSTEAD NOTHING;

-- 9. ENABLE ROW LEVEL SECURITY (RLS) FOR CORE TABLES
ALTER TABLE public.party_parties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_identifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.party_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_sub_journeys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journey_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

-- 10. CREATE STANDARD TENANT ISOLATION RLS POLICIES
CREATE POLICY tenant_isolation_parties ON public.party_parties
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_party_identifiers ON public.party_identifiers
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_party_relationships ON public.party_relationships
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_party_roles ON public.party_roles
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_journeys ON public.journey_journeys
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_sub_journeys ON public.journey_sub_journeys
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_milestones ON public.journey_milestones
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY tenant_isolation_timeline ON public.timeline_events
    FOR ALL USING (tenant_id = public.get_auth_tenant_id());
