-- ============================================================================
-- Bella AI Platform — Industry Blueprint Knowledge, Policies & Resource Skills
-- Migration: 20260806020000_blueprint_knowledge_policies_resources.sql
-- ============================================================================

-- 0. ENABLE VECTOR EXTENSION FOR RAG EMBEDDINGS
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. KNOWLEDGE ENTRIES (5-Layer AI RAG Facts)
CREATE TABLE IF NOT EXISTS public.knowledge_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    domain TEXT NOT NULL, -- 'icd10', 'drug_atc', 'sop', 'clinical_rule'
    code TEXT NOT NULL,
    label TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL DEFAULT '1.0.0',
    effective_from TIMESTAMPTZ DEFAULT now() NOT NULL,
    effective_to TIMESTAMPTZ,
    source TEXT,
    approved_by UUID REFERENCES public.party_parties(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    embedding_vector VECTOR(1536), -- Vector index (1536-dim for openai text-embedding-3-large/ada-002)
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, vertical, domain, code, version)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_entries_lookup ON public.knowledge_entries(tenant_id, vertical, domain, code);
-- Cosine index for vector semantic search
CREATE INDEX IF NOT EXISTS idx_knowledge_vector_cosine ON public.knowledge_entries USING ivfflat (embedding_vector vector_cosine_ops) WITH (lists = 100);

-- 2. KNOWLEDGE GRAPH EDGES (Semantic Relations)
CREATE TABLE IF NOT EXISTS public.knowledge_graph_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    source_code TEXT NOT NULL,
    source_type TEXT NOT NULL,
    target_code TEXT NOT NULL,
    target_type TEXT NOT NULL,
    relationship_type TEXT NOT NULL, -- 'contraindicated_with', 'requires', 'treats', 'causes'
    strength NUMERIC(3,2) DEFAULT 1.00,
    evidence_source TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, source_code, source_type, target_code, target_type, relationship_type)
);

CREATE INDEX IF NOT EXISTS idx_knowledge_graph_src ON public.knowledge_graph_edges(tenant_id, source_code, source_type);
CREATE INDEX IF NOT EXISTS idx_knowledge_graph_dst ON public.knowledge_graph_edges(tenant_id, target_code, target_type);

-- 3. KNOWLEDGE INFERENCE RULES (Facts -> Reasoning)
CREATE TABLE IF NOT EXISTS public.knowledge_inference_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    trigger_type TEXT NOT NULL, -- 'if_then', 'risk_score', 'constraint'
    conditions JSONB NOT NULL DEFAULT '[]', -- conditions AST [{field, operator, value}]
    action JSONB NOT NULL DEFAULT '{}', -- {type: 'block'|'warn', payload}
    version TEXT NOT NULL DEFAULT '1.0.0',
    effective_from TIMESTAMPTZ DEFAULT now() NOT NULL,
    effective_to TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, vertical, code, version)
);

-- 4. WORKFLOW DEFINITIONS & INSTANCES
CREATE TABLE IF NOT EXISTS public.workflow_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    name TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    steps_bpmn JSONB NOT NULL DEFAULT '{}', -- Node-edge BPMN definitions
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, vertical, name, version)
);

CREATE TABLE IF NOT EXISTS public.workflow_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    definition_id UUID NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
    journey_id UUID REFERENCES public.journey_journeys(id) ON DELETE CASCADE,
    current_step TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'completed', 'suspended', 'terminated')),
    step_entered_at TIMESTAMPTZ DEFAULT now(),
    completed_at TIMESTAMPTZ,
    step_log JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 5. RESOURCE SKILLS (Enabling AI scheduling & matching)
CREATE TABLE IF NOT EXISTS public.resource_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    resource_id UUID NOT NULL, -- Points to Platform Resource (which is stored in generic resources table)
    skill_code TEXT NOT NULL, -- 'implant_level_3', 'invisalign_expert'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE (tenant_id, resource_id, skill_code)
);

CREATE INDEX IF NOT EXISTS idx_resource_skills_lookup ON public.resource_skills(tenant_id, resource_id);

-- 6. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.knowledge_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_inference_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resource_skills ENABLE ROW LEVEL SECURITY;

-- 7. CREATE RLS TENANT ISOLATION POLICIES
CREATE POLICY tenant_isolation_knowledge ON public.knowledge_entries
    FOR ALL USING (tenant_id = auth.jwt()->>'tenant_id'::text::uuid);

CREATE POLICY tenant_isolation_graph ON public.knowledge_graph_edges
    FOR ALL USING (tenant_id = auth.jwt()->>'tenant_id'::text::uuid);

CREATE POLICY tenant_isolation_inference ON public.knowledge_inference_rules
    FOR ALL USING (tenant_id = auth.jwt()->>'tenant_id'::text::uuid);

CREATE POLICY tenant_isolation_wf_defs ON public.workflow_definitions
    FOR ALL USING (tenant_id = auth.jwt()->>'tenant_id'::text::uuid);

CREATE POLICY tenant_isolation_wf_insts ON public.workflow_instances
    FOR ALL USING (tenant_id = auth.jwt()->>'tenant_id'::text::uuid);

CREATE POLICY tenant_isolation_skills ON public.resource_skills
    FOR ALL USING (tenant_id = auth.jwt()->>'tenant_id'::text::uuid);
