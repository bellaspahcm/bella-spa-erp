-- Manufacturing OS Canonical Schema
-- Date: 2026-09-05
-- Purpose: Canonical persistence for Manufacturing Industry OS
-- Factory Phase 3: Fresh Industry OS validation

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Core Manufacturing Entities
-- ============================================================================

-- Production Orders: Master manufacturing orders
CREATE TABLE IF NOT EXISTS public.manufacturing_production_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Order Identity
  order_number TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  
  -- Quantities
  quantity_ordered INTEGER NOT NULL CHECK (quantity_ordered > 0),
  quantity_produced INTEGER NOT NULL DEFAULT 0 CHECK (quantity_produced >= 0),
  quantity_scrapped INTEGER NOT NULL DEFAULT 0 CHECK (quantity_scrapped >= 0),
  
  -- Dates
  planned_start_date TIMESTAMPTZ NOT NULL,
  planned_end_date TIMESTAMPTZ NOT NULL,
  actual_start_date TIMESTAMPTZ,
  actual_end_date TIMESTAMPTZ,
  
  -- Priority
  priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD')),
  
  -- Costing
  estimated_cost DECIMAL(12,2) CHECK (estimated_cost >= 0),
  actual_cost DECIMAL(12,2) CHECK (actual_cost >= 0),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  
  UNIQUE(tenant_id, order_number),
  CHECK (planned_end_date >= planned_start_date)
);

-- Work Orders: Individual operations/tasks
CREATE TABLE IF NOT EXISTS public.manufacturing_work_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Work Order Identity
  work_order_number TEXT NOT NULL,
  production_order_id UUID NOT NULL REFERENCES public.manufacturing_production_orders(id) ON DELETE CASCADE,
  
  -- Operation
  operation_name TEXT NOT NULL,
  operation_sequence INTEGER NOT NULL CHECK (operation_sequence > 0),
  workstation TEXT,
  
  -- Labor
  assigned_worker_id UUID,
  estimated_hours DECIMAL(8,2) CHECK (estimated_hours >= 0),
  actual_hours DECIMAL(8,2) CHECK (actual_hours >= 0),
  
  -- Dates
  scheduled_start TIMESTAMPTZ NOT NULL,
  scheduled_end TIMESTAMPTZ NOT NULL,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'PAUSED', 'CANCELLED')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, work_order_number),
  CHECK (scheduled_end >= scheduled_start)
);

-- Bill of Materials (BOM): Product component definitions
CREATE TABLE IF NOT EXISTS public.manufacturing_bom_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- BOM Identity
  parent_product_sku TEXT NOT NULL,
  component_sku TEXT NOT NULL,
  component_name TEXT NOT NULL,
  
  -- Quantity
  quantity_required DECIMAL(10,4) NOT NULL CHECK (quantity_required > 0),
  unit_of_measure TEXT NOT NULL,
  
  -- Scrap
  scrap_factor DECIMAL(5,4) DEFAULT 0 CHECK (scrap_factor >= 0 AND scrap_factor < 1),
  
  -- Costing
  component_cost DECIMAL(10,2) CHECK (component_cost >= 0),
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  effective_date DATE,
  obsolete_date DATE,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, parent_product_sku, component_sku),
  CHECK (parent_product_sku != component_sku)
);

-- Production Runs: Actual manufacturing execution
CREATE TABLE IF NOT EXISTS public.manufacturing_production_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Run Identity
  run_number TEXT NOT NULL,
  production_order_id UUID NOT NULL REFERENCES public.manufacturing_production_orders(id) ON DELETE CASCADE,
  work_order_id UUID REFERENCES public.manufacturing_work_orders(id),
  
  -- Batch
  batch_number TEXT,
  lot_number TEXT,
  
  -- Quantities
  quantity_started INTEGER NOT NULL CHECK (quantity_started > 0),
  quantity_completed INTEGER NOT NULL DEFAULT 0 CHECK (quantity_completed >= 0),
  quantity_rejected INTEGER NOT NULL DEFAULT 0 CHECK (quantity_rejected >= 0),
  
  -- Timing
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER CHECK (duration_minutes >= 0),
  
  -- Quality
  pass_rate DECIMAL(5,2) CHECK (pass_rate >= 0 AND pass_rate <= 100),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABORTED', 'PAUSED')),
  
  -- Notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, run_number)
);

-- Quality Inspections: Quality control records
CREATE TABLE IF NOT EXISTS public.manufacturing_quality_inspections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Inspection Identity
  inspection_number TEXT NOT NULL,
  production_run_id UUID REFERENCES public.manufacturing_production_runs(id) ON DELETE CASCADE,
  production_order_id UUID REFERENCES public.manufacturing_production_orders(id),
  
  -- Inspection
  inspection_type TEXT NOT NULL CHECK (inspection_type IN ('INCOMING', 'IN_PROCESS', 'FINAL', 'AUDIT')),
  inspection_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  inspector_id UUID,
  
  -- Sampling
  sample_size INTEGER NOT NULL CHECK (sample_size > 0),
  units_passed INTEGER NOT NULL DEFAULT 0 CHECK (units_passed >= 0),
  units_failed INTEGER NOT NULL DEFAULT 0 CHECK (units_failed >= 0),
  
  -- Results
  result TEXT NOT NULL CHECK (result IN ('PASS', 'FAIL', 'CONDITIONAL_PASS', 'PENDING')),
  defect_codes TEXT[], -- Array of defect codes
  severity TEXT CHECK (severity IN ('MINOR', 'MAJOR', 'CRITICAL')),
  
  -- Actions
  disposition TEXT CHECK (disposition IN ('ACCEPT', 'REJECT', 'REWORK', 'SCRAP', 'HOLD')),
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, inspection_number),
  CHECK (units_passed + units_failed <= sample_size)
);

-- Material Consumption: Material usage tracking
CREATE TABLE IF NOT EXISTS public.manufacturing_material_consumption (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Consumption Identity
  production_run_id UUID NOT NULL REFERENCES public.manufacturing_production_runs(id) ON DELETE CASCADE,
  material_sku TEXT NOT NULL,
  material_name TEXT NOT NULL,
  
  -- Quantities
  quantity_planned DECIMAL(10,4) NOT NULL CHECK (quantity_planned >= 0),
  quantity_consumed DECIMAL(10,4) NOT NULL CHECK (quantity_consumed >= 0),
  quantity_wasted DECIMAL(10,4) NOT NULL DEFAULT 0 CHECK (quantity_wasted >= 0),
  unit_of_measure TEXT NOT NULL,
  
  -- Costing
  unit_cost DECIMAL(10,2) CHECK (unit_cost >= 0),
  total_cost DECIMAL(12,2) CHECK (total_cost >= 0),
  
  -- Traceability
  batch_number TEXT,
  lot_number TEXT,
  
  -- Metadata
  consumed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, production_run_id, material_sku, batch_number)
);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.manufacturing_production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_production_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manufacturing_material_consumption ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Tenant isolation
CREATE POLICY manufacturing_production_orders_tenant_isolation ON public.manufacturing_production_orders
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY manufacturing_work_orders_tenant_isolation ON public.manufacturing_work_orders
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY manufacturing_bom_items_tenant_isolation ON public.manufacturing_bom_items
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY manufacturing_production_runs_tenant_isolation ON public.manufacturing_production_runs
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY manufacturing_quality_inspections_tenant_isolation ON public.manufacturing_quality_inspections
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

CREATE POLICY manufacturing_material_consumption_tenant_isolation ON public.manufacturing_material_consumption
  FOR ALL USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX idx_manufacturing_production_orders_tenant ON public.manufacturing_production_orders(tenant_id);
CREATE INDEX idx_manufacturing_production_orders_status ON public.manufacturing_production_orders(status);
CREATE INDEX idx_manufacturing_production_orders_dates ON public.manufacturing_production_orders(planned_start_date, planned_end_date);

CREATE INDEX idx_manufacturing_work_orders_tenant ON public.manufacturing_work_orders(tenant_id);
CREATE INDEX idx_manufacturing_work_orders_production_order ON public.manufacturing_work_orders(production_order_id);
CREATE INDEX idx_manufacturing_work_orders_status ON public.manufacturing_work_orders(status);

CREATE INDEX idx_manufacturing_bom_items_tenant ON public.manufacturing_bom_items(tenant_id);
CREATE INDEX idx_manufacturing_bom_items_parent ON public.manufacturing_bom_items(parent_product_sku);
CREATE INDEX idx_manufacturing_bom_items_component ON public.manufacturing_bom_items(component_sku);

CREATE INDEX idx_manufacturing_production_runs_tenant ON public.manufacturing_production_runs(tenant_id);
CREATE INDEX idx_manufacturing_production_runs_production_order ON public.manufacturing_production_runs(production_order_id);
CREATE INDEX idx_manufacturing_production_runs_status ON public.manufacturing_production_runs(status);

CREATE INDEX idx_manufacturing_quality_inspections_tenant ON public.manufacturing_quality_inspections(tenant_id);
CREATE INDEX idx_manufacturing_quality_inspections_production_run ON public.manufacturing_quality_inspections(production_run_id);
CREATE INDEX idx_manufacturing_quality_inspections_result ON public.manufacturing_quality_inspections(result);

CREATE INDEX idx_manufacturing_material_consumption_tenant ON public.manufacturing_material_consumption(tenant_id);
CREATE INDEX idx_manufacturing_material_consumption_production_run ON public.manufacturing_material_consumption(production_run_id);
