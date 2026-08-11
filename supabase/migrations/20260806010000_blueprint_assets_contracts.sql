-- ============================================================================
-- Bella AI Platform — Industry Blueprint Assets & Contracts Schema
-- Migration: 20260806010000_blueprint_assets_contracts.sql
-- ============================================================================

-- 1. ASSET ASSETS (Managed Asset Lifecycle)
CREATE TABLE IF NOT EXISTS public.asset_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    asset_type TEXT NOT NULL, -- 'tooth', 'vehicle', 'apartment_unit', 'medical_device'
    name TEXT NOT NULL,
    description TEXT,
    owner_party_id UUID REFERENCES public.party_parties(id) ON DELETE SET NULL,
    status TEXT NOT NULL, -- 'healthy', 'damaged', 'under_repair', 'active', 'sold'
    metadata JSONB NOT NULL DEFAULT '{}',
    events JSONB NOT NULL DEFAULT '[]', -- List of AssetEvents [{eventType, description, occurredAt}]
    
    -- Auditing & Versioning (Optimistic Locking)
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_asset_assets_tenant ON public.asset_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_asset_assets_owner ON public.asset_assets(owner_party_id);
CREATE INDEX IF NOT EXISTS idx_asset_assets_type ON public.asset_assets(vertical, asset_type);
CREATE INDEX IF NOT EXISTS idx_asset_assets_deleted ON public.asset_assets(deleted_at) WHERE deleted_at IS NULL;

-- 2. CONTRACT CONTRACTS (Commitment & Warranty Lifecycle)
CREATE TABLE IF NOT EXISTS public.contract_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical TEXT NOT NULL,
    contract_type TEXT NOT NULL, -- 'treatment_plan', 'warranty', 'membership', 'spa_package'
    contract_number TEXT,
    parties JSONB NOT NULL DEFAULT '[]', -- [{partyId, role: 'provider'|'client'|'insurer'}]
    journey_id UUID REFERENCES public.journey_journeys(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('draft', 'pending_signature', 'active', 'suspended', 'completed', 'cancelled', 'expired')),
    start_date DATE,
    end_date DATE,
    total_value NUMERIC(15,2),
    currency TEXT NOT NULL DEFAULT 'VND',
    payment_schedule JSONB, -- {frequency, installments, amountPerInstallment, dueDay}
    line_items JSONB NOT NULL DEFAULT '[]', -- [{code, description, quantity, unitPrice, subtotal}]
    terms JSONB NOT NULL DEFAULT '{}',
    signed_at TIMESTAMPTZ,
    signed_by TEXT,
    
    -- Auditing & Versioning
    version INTEGER NOT NULL DEFAULT 1,
    created_by UUID,
    updated_by UUID,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_contract_contracts_tenant ON public.contract_contracts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contract_contracts_journey ON public.contract_contracts(journey_id);
CREATE INDEX IF NOT EXISTS idx_contract_contracts_deleted ON public.contract_contracts(deleted_at) WHERE deleted_at IS NULL;

-- 3. ENABLE ROW LEVEL SECURITY (RLS)
ALTER TABLE public.asset_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_contracts ENABLE ROW LEVEL SECURITY;

-- 4. CREATE RLS TENANT ISOLATION POLICIES
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'asset_assets' 
    AND policyname = 'tenant_isolation_assets'
  ) THEN
    CREATE POLICY tenant_isolation_assets ON public.asset_assets
      FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'contract_contracts' 
    AND policyname = 'tenant_isolation_contracts'
  ) THEN
    CREATE POLICY tenant_isolation_contracts ON public.contract_contracts
      FOR ALL USING (tenant_id = public.get_auth_tenant_id());
  END IF;
END $$;
