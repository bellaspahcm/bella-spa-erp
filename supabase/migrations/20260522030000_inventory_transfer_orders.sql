-- Migration to create the Inventory Transfer Orders table, enable RLS, and set policies.

-- 1. Create the inventory_transfer_orders table
CREATE TABLE IF NOT EXISTS public.inventory_transfer_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,
    requester_tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE NOT NULL,
    status VARCHAR(30) DEFAULT 'pending' NOT NULL, -- 'pending', 'approved', 'shipped', 'completed', 'cancelled'
    items JSONB NOT NULL, -- Array of objects: [{"name": "...", "sku": "...", "qty": 10, "unit": "..."}]
    shipping_carrier VARCHAR(100),
    tracking_number VARCHAR(100),
    notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    approved_at TIMESTAMPTZ,
    shipped_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ
);

-- 2. Enable Row-Level Security
ALTER TABLE public.inventory_transfer_orders ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies if any
DROP POLICY IF EXISTS "HQ Admin có toàn quyền quản lý chuyển kho" ON public.inventory_transfer_orders;
DROP POLICY IF EXISTS "Branch Admin chỉ được xem chuyển kho của mình" ON public.inventory_transfer_orders;
DROP POLICY IF EXISTS "Branch Admin chỉ được tạo chuyển kho cho mình" ON public.inventory_transfer_orders;
DROP POLICY IF EXISTS "Branch Admin chỉ được cập nhật chuyển kho của mình" ON public.inventory_transfer_orders;

-- 4. Establish recursive-free RLS Policies
-- HQ Admin has global access to all transfer orders
CREATE POLICY "HQ Admin có toàn quyền quản lý chuyển kho" 
ON public.inventory_transfer_orders 
FOR ALL 
USING (public.is_hq_admin());

-- Branch Admin can read their own transfer orders
CREATE POLICY "Branch Admin chỉ được xem chuyển kho của mình" 
ON public.inventory_transfer_orders 
FOR SELECT 
USING (requester_tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Branch Admin can create transfer orders for their own branch
CREATE POLICY "Branch Admin chỉ được tạo chuyển kho cho mình" 
ON public.inventory_transfer_orders 
FOR INSERT 
WITH CHECK (requester_tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));

-- Branch Admin can update transfer orders for their own branch (for cancelling or confirming receipt)
CREATE POLICY "Branch Admin chỉ được cập nhật chuyển kho của mình" 
ON public.inventory_transfer_orders 
FOR UPDATE 
USING (requester_tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()))
WITH CHECK (requester_tenant_id = (SELECT tenant_id FROM public.users WHERE id = auth.uid()));
