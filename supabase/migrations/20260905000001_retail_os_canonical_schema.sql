-- Retail OS Canonical Schema
-- Date: 2026-09-05
-- Purpose: Canonical persistence for Retail Industry OS
-- Factory: Production Output Gate validation

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- Core Retail Entities
-- ============================================================================

-- Products: Items for sale
CREATE TABLE IF NOT EXISTS public.retail_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Product Identity
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  
  -- Pricing
  base_price DECIMAL(10,2) NOT NULL CHECK (base_price >= 0),
  cost_price DECIMAL(10,2) CHECK (cost_price >= 0),
  
  -- Inventory
  track_inventory BOOLEAN NOT NULL DEFAULT true,
  current_stock INTEGER DEFAULT 0 CHECK (current_stock >= 0),
  reorder_point INTEGER CHECK (reorder_point >= 0),
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'DISCONTINUED', 'OUT_OF_STOCK')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  
  UNIQUE(tenant_id, sku)
);

-- Customers: Retail customers
CREATE TABLE IF NOT EXISTS public.retail_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Identity
  email TEXT,
  phone TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  
  -- Loyalty
  loyalty_points INTEGER DEFAULT 0 CHECK (loyalty_points >= 0),
  loyalty_tier TEXT CHECK (loyalty_tier IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM')),
  
  -- Status
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'BLOCKED')),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT email_or_phone_required CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Sales: Retail transactions
CREATE TABLE IF NOT EXISTS public.retail_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Sale Identity
  sale_number TEXT NOT NULL,
  customer_id UUID REFERENCES public.retail_customers(id),
  
  -- Amounts
  subtotal DECIMAL(10,2) NOT NULL CHECK (subtotal >= 0),
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
  
  -- Payment
  payment_method TEXT NOT NULL CHECK (payment_method IN ('CASH', 'CARD', 'MOBILE', 'LOYALTY_POINTS')),
  payment_status TEXT NOT NULL CHECK (payment_status IN ('PENDING', 'COMPLETED', 'REFUNDED', 'FAILED')),
  
  -- Status
  status TEXT NOT NULL CHECK (status IN ('DRAFT', 'COMPLETED', 'CANCELLED', 'REFUNDED')),
  
  -- Transaction
  sale_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  
  -- Staff
  cashier_id UUID,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(tenant_id, sale_number)
);

-- Sale Items: Line items in sales
CREATE TABLE IF NOT EXISTS public.retail_sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- References
  sale_id UUID NOT NULL REFERENCES public.retail_sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.retail_products(id),
  
  -- Item Details
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
  discount_amount DECIMAL(10,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  line_total DECIMAL(10,2) NOT NULL CHECK (line_total >= 0),
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inventory Movements: Stock changes
CREATE TABLE IF NOT EXISTS public.retail_inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  
  -- Movement Identity
  product_id UUID NOT NULL REFERENCES public.retail_products(id),
  movement_type TEXT NOT NULL CHECK (movement_type IN ('RESTOCK', 'SALE', 'ADJUSTMENT', 'RETURN', 'DAMAGE', 'TRANSFER')),
  
  -- Quantity
  quantity_change INTEGER NOT NULL, -- Can be negative
  previous_stock INTEGER NOT NULL CHECK (previous_stock >= 0),
  new_stock INTEGER NOT NULL CHECK (new_stock >= 0),
  
  -- References
  reference_type TEXT, -- 'SALE', 'PURCHASE_ORDER', 'MANUAL'
  reference_id UUID,
  
  -- Context
  reason TEXT,
  performed_by UUID,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- RLS Policies (Tenant Isolation)
-- ============================================================================

-- Products
ALTER TABLE public.retail_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_retail_products ON public.retail_products
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Customers
ALTER TABLE public.retail_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_retail_customers ON public.retail_customers
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Sales
ALTER TABLE public.retail_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_retail_sales ON public.retail_sales
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Sale Items
ALTER TABLE public.retail_sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_retail_sale_items ON public.retail_sale_items
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- Inventory Movements
ALTER TABLE public.retail_inventory_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_retail_inventory_movements ON public.retail_inventory_movements
  USING (tenant_id = current_setting('app.current_tenant_id')::UUID);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX idx_retail_products_tenant ON public.retail_products(tenant_id);
CREATE INDEX idx_retail_products_sku ON public.retail_products(tenant_id, sku);
CREATE INDEX idx_retail_products_category ON public.retail_products(tenant_id, category);
CREATE INDEX idx_retail_products_status ON public.retail_products(tenant_id, status);

CREATE INDEX idx_retail_customers_tenant ON public.retail_customers(tenant_id);
CREATE INDEX idx_retail_customers_email ON public.retail_customers(tenant_id, email);
CREATE INDEX idx_retail_customers_phone ON public.retail_customers(tenant_id, phone);

CREATE INDEX idx_retail_sales_tenant ON public.retail_sales(tenant_id);
CREATE INDEX idx_retail_sales_number ON public.retail_sales(tenant_id, sale_number);
CREATE INDEX idx_retail_sales_customer ON public.retail_sales(customer_id);
CREATE INDEX idx_retail_sales_date ON public.retail_sales(sale_date);
CREATE INDEX idx_retail_sales_status ON public.retail_sales(tenant_id, status);

CREATE INDEX idx_retail_sale_items_tenant ON public.retail_sale_items(tenant_id);
CREATE INDEX idx_retail_sale_items_sale ON public.retail_sale_items(sale_id);
CREATE INDEX idx_retail_sale_items_product ON public.retail_sale_items(product_id);

CREATE INDEX idx_retail_inventory_movements_tenant ON public.retail_inventory_movements(tenant_id);
CREATE INDEX idx_retail_inventory_movements_product ON public.retail_inventory_movements(product_id);
CREATE INDEX idx_retail_inventory_movements_created ON public.retail_inventory_movements(created_at);

-- ============================================================================
-- Updated At Triggers
-- ============================================================================

-- Function may already exist from Platform Core - skip if exists
DO $$ 
BEGIN
  CREATE OR REPLACE FUNCTION update_updated_at_column()
  RETURNS TRIGGER AS $func$
  BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
  END;
  $func$ LANGUAGE plpgsql;
EXCEPTION
  WHEN insufficient_privilege THEN
    -- Function already exists and owned by different role, skip
    NULL;
END $$;

DROP TRIGGER IF EXISTS update_retail_products_updated_at ON public.retail_products;
CREATE TRIGGER update_retail_products_updated_at
  BEFORE UPDATE ON public.retail_products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_retail_sales_updated_at ON public.retail_sales;
CREATE TRIGGER update_retail_sales_updated_at
  BEFORE UPDATE ON public.retail_sales
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE public.retail_products IS 'Retail products catalog with inventory tracking';
COMMENT ON TABLE public.retail_customers IS 'Retail customers with loyalty program support';
COMMENT ON TABLE public.retail_sales IS 'Retail sales transactions (POS)';
COMMENT ON TABLE public.retail_sale_items IS 'Line items in retail sales';
COMMENT ON TABLE public.retail_inventory_movements IS 'Inventory movement audit trail';
