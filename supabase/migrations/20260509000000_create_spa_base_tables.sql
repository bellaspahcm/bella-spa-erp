-- =====================================================================================
-- Migration: Create Bella Spa Base Tables (Structure Only)
-- =====================================================================================
-- Purpose: Establish base table structures for core Bella Spa operational tables.
--          This is Part 1 of 2-part migration split.
--
-- Historical Context:
--   These tables existed in production from seed data before migration history began.
--   This migration restores their canonical CREATE TABLE statements to enable fresh
--   database initialization.
--
-- Split Rationale:
--   Original migration (20260510) created forward references to:
--   - tenants/users/session_logs (created 20260511)
--   - update_updated_at_column() (created 20260511)
--   - log_audit_event() (created 20260516)
--
--   Split resolves dependency cycle while preserving downstream migrations:
--   - Part 1 (20260509): Base tables with NO FK constraints, NO triggers
--   - Part 2 (20260517): Constraints and triggers after dependencies exist
--
-- Tables Created:
--   1. packages - Service packages/products (structure only, constraints in 20260517)
--   2. inventory_items - Inventory master (structure only, constraints in 20260517)
--   3. inventory_logs - Inventory movements (structure only, constraints in 20260517)
--
-- Dependencies: NONE (zero external dependencies - platform functions not yet required)
--
-- Downstream Impact: Multiple migrations 20260512+ assume these tables exist.
--                    This migration makes them available at correct chronological position.
--
-- Intermediate State Note:
--   Between this migration (20260509) and Part 2 (20260517), tables exist WITHOUT
--   FK enforcement and audit triggers. This intermediate state is SAFE because:
--   - Migration 20260512: GRANT ALL (permissive, no FK requirement)
--   - Migration 20260515: ALTER TABLE + UPDATE (no FK columns modified, see audit note)
--   - No seed/bootstrap data execution in interval
--
-- Audit Gap Note (20260515):
--   Migration 20260515 performs schema normalization UPDATE (price, duration encoding).
--   This UPDATE executes BEFORE audit trigger application (20260517).
--   Decision: ACCEPTED per architectural policy - schema migration operations are
--   infrastructure changes, not business transactions, and do not require audit trail.
--   Historical execution already had same gap (tables existed before audit infrastructure).
--
-- Date: 2026-09-05
-- Type: Schema restoration - Part 1 (Base Structure)
-- Related: 20260517000000_add_spa_constraints.sql (Part 2)
-- =====================================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================================
-- TABLE 1: packages (BASE STRUCTURE)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.packages (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant Isolation (FK constraint added in 20260517)
  tenant_id UUID,
  
  -- Package Identity
  name TEXT NOT NULL,
  description TEXT,
  offer TEXT,
  
  -- Module & Classification
  module_key TEXT NOT NULL,
  service_kind TEXT NOT NULL,
  service_category TEXT,
  
  -- Pricing (bigint for VND integer currency)
  full_price NUMERIC NOT NULL,
  price BIGINT,
  price_floor BIGINT,
  price_cap BIGINT,
  allowed_franchise_override BOOLEAN,
  
  -- Sessions & Duration
  total_sessions INTEGER NOT NULL DEFAULT 1,
  session_multiplier NUMERIC,
  default_duration_minutes INTEGER NOT NULL,
  duration TEXT,
  estimated_duration INTEGER,
  
  -- Resources
  requires_resource BOOLEAN NOT NULL DEFAULT false,
  default_resource_type TEXT,
  required_workers INTEGER,
  
  -- Service Requirements
  before_after_required BOOLEAN NOT NULL DEFAULT false,
  care_note_template TEXT,
  details TEXT[],
  
  -- Template System
  is_hq_template BOOLEAN,
  template_id UUID,  -- Self-reference FK constraint added in 20260517
  
  -- Inventory Integration
  product_usage JSONB,
  
  -- Commission (bigint for VND integer)
  ktv_commission BIGINT,
  
  -- Status
  status TEXT,
  
  -- Metadata
  metadata JSONB,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic Indexes (non-FK indexes)
CREATE INDEX IF NOT EXISTS idx_packages_module_kind_status
  ON public.packages (module_key, service_kind, status);

CREATE INDEX IF NOT EXISTS idx_packages_is_hq_template
  ON public.packages(is_hq_template)
  WHERE is_hq_template = true;

CREATE INDEX IF NOT EXISTS idx_packages_product_usage
  ON public.packages USING GIN (product_usage)
  WHERE product_usage IS NOT NULL;

-- Comments
COMMENT ON TABLE public.packages IS 
  'Core Bella Spa packages table. Service packages, treatment packages, and retail products. BASE STRUCTURE - constraints and triggers added in 20260517.';

COMMENT ON COLUMN public.packages.price IS
  'Actual/discounted price in VND (bigint integer, no fractional currency). NULL if using full_price only.';

COMMENT ON COLUMN public.packages.ktv_commission IS
  'KTV commission amount in VND (bigint integer). Null if not applicable.';

COMMENT ON COLUMN public.packages.module_key IS
  'Industry module identifier. Canonical values: ''babycare'', ''beauty_spa'', ''industrial_cleaning'', ''student_training''. Note: Production may contain legacy ''baby_care'' (with underscore) - application layer performs translation.';

-- =====================================================================================
-- TABLE 2: inventory_items (BASE STRUCTURE)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.inventory_items (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant Isolation (FK constraint added in 20260517)
  tenant_id UUID NOT NULL,
  
  -- Item Identity
  name TEXT NOT NULL,
  sku TEXT,
  category TEXT,
  
  -- Pricing & Units
  price_per_unit NUMERIC NOT NULL DEFAULT 0,
  unit TEXT NOT NULL DEFAULT 'unit',
  
  -- Stock Levels (numeric allows fractional quantities)
  stock_level NUMERIC NOT NULL DEFAULT 0,
  min_stock_level NUMERIC NOT NULL DEFAULT 0,
  
  -- Metadata
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Basic Constraints (non-FK constraints)
  CONSTRAINT inventory_items_stock_nonnegative CHECK (stock_level >= 0),
  CONSTRAINT inventory_items_min_stock_nonnegative CHECK (min_stock_level >= 0),
  CONSTRAINT inventory_items_price_nonnegative CHECK (price_per_unit >= 0)
);

-- Basic Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_items_tenant_base
  ON public.inventory_items(tenant_id);

CREATE INDEX IF NOT EXISTS idx_inventory_items_sku_base
  ON public.inventory_items(tenant_id, sku)
  WHERE sku IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_inventory_items_category_base
  ON public.inventory_items(tenant_id, category)
  WHERE category IS NOT NULL;

-- Unique constraint on SKU per tenant
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_tenant_sku_unique
  ON public.inventory_items(tenant_id, sku)
  WHERE sku IS NOT NULL AND sku != '';

-- Comments
COMMENT ON TABLE public.inventory_items IS
  'Inventory master table. Stores product/supply catalog with stock levels. BASE STRUCTURE - FK constraints and triggers added in 20260517.';

COMMENT ON COLUMN public.inventory_items.stock_level IS
  'Current stock on hand (numeric allows fractional for measured supplies). Contract permits fractional quantities though current data may be integer-only.';

-- =====================================================================================
-- TABLE 3: inventory_logs (BASE STRUCTURE)
-- =====================================================================================

CREATE TABLE IF NOT EXISTS public.inventory_logs (
  -- Primary Key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Tenant Isolation (FK constraint added in 20260517)
  tenant_id UUID NOT NULL,
  
  -- Inventory Movement (FK constraint added in 20260517)
  item_id UUID NOT NULL,
  change_amount NUMERIC NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  
  -- Context (FK constraints added in 20260517)
  session_log_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Accounting Integration
  business_event_type TEXT,
  accounting_review_status TEXT NOT NULL DEFAULT 'UNREVIEWED',
  accounting_template_id UUID,
  accounting_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Basic Constraints (non-FK constraints)
  CONSTRAINT inventory_logs_accounting_review_status_check
    CHECK (accounting_review_status IN ('UNREVIEWED', 'AUTO_POSTED', 'NEEDS_REVIEW', 'APPROVED', 'POSTING_FAILED'))
);

-- Basic Indexes
CREATE INDEX IF NOT EXISTS idx_inventory_logs_tenant_base
  ON public.inventory_logs(tenant_id);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_item_base
  ON public.inventory_logs(item_id);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_business_event_base
  ON public.inventory_logs(tenant_id, business_event_type, accounting_review_status);

CREATE INDEX IF NOT EXISTS idx_inventory_logs_created_at_base
  ON public.inventory_logs(tenant_id, created_at DESC);

-- Comments
COMMENT ON TABLE public.inventory_logs IS
  'Inventory movement audit trail. BASE STRUCTURE - FK constraints and triggers added in 20260517.';

COMMENT ON COLUMN public.inventory_logs.accounting_review_status IS
  'Accounting review status. UPPERCASE convention matches Finance Kernel.';

-- =====================================================================================
-- Grants (Basic Access)
-- =====================================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.packages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_logs TO authenticated;

GRANT ALL ON public.packages TO service_role;
GRANT ALL ON public.inventory_items TO service_role;
GRANT ALL ON public.inventory_logs TO service_role;

-- =====================================================================================
-- Migration Complete - Part 1
-- =====================================================================================
-- Base table structures created with zero external dependencies.
-- Part 2 (20260517) will add FK constraints, triggers, RLS policies, and CHECK constraints
-- after required functions (update_updated_at_column, log_audit_event) are available.
-- =====================================================================================
