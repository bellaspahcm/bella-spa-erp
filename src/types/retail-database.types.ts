/**
 * Retail OS Database Types
 * Generated from: supabase/migrations/20260905000001_retail_os_canonical_schema.sql
 * 
 * CANONICAL AUTHORITY: This file is derived from authoritative DB schema
 */

export interface RetailProduct {
  id: string;
  tenant_id: string;
  
  // Product Identity
  sku: string;
  name: string;
  description: string | null;
  category: string;
  
  // Pricing
  base_price: number;
  cost_price: number | null;
  
  // Inventory
  track_inventory: boolean;
  current_stock: number | null;
  reorder_point: number | null;
  
  // Status
  status: 'ACTIVE' | 'DISCONTINUED' | 'OUT_OF_STOCK';
  
  // Metadata
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface RetailCustomer {
  id: string;
  tenant_id: string;
  
  // Identity
  email: string | null;
  phone: string | null;
  first_name: string;
  last_name: string;
  
  // Loyalty
  loyalty_points: number | null;
  loyalty_tier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM' | null;
  
  // Status
  status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  
  // Metadata
  created_at: string;
  updated_at: string;
}

export interface RetailSale {
  id: string;
  tenant_id: string;
  
  // Sale Identity
  sale_number: string;
  customer_id: string | null;
  
  // Amounts
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  
  // Payment
  payment_method: 'CASH' | 'CARD' | 'MOBILE' | 'LOYALTY_POINTS';
  payment_status: 'PENDING' | 'COMPLETED' | 'REFUNDED' | 'FAILED';
  
  // Status
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  
  // Transaction
  sale_date: string;
  completed_at: string | null;
  
  // Staff
  cashier_id: string | null;
  
  // Metadata
  created_at: string;
  updated_at: string;
}

export interface RetailSaleItem {
  id: string;
  tenant_id: string;
  
  // References
  sale_id: string;
  product_id: string;
  
  // Item Details
  quantity: number;
  unit_price: number;
  discount_amount: number;
  line_total: number;
  
  // Metadata
  created_at: string;
}

export interface RetailInventoryMovement {
  id: string;
  tenant_id: string;
  
  // Movement Identity
  product_id: string;
  movement_type: 'RESTOCK' | 'SALE' | 'ADJUSTMENT' | 'RETURN' | 'DAMAGE' | 'TRANSFER';
  
  // Quantity
  quantity_change: number;
  previous_stock: number;
  new_stock: number;
  
  // References
  reference_type: string | null;
  reference_id: string | null;
  
  // Context
  reason: string | null;
  performed_by: string | null;
  
  // Metadata
  created_at: string;
}

// Table name mappings for type safety
export type RetailTables = {
  retail_products: RetailProduct;
  retail_customers: RetailCustomer;
  retail_sales: RetailSale;
  retail_sale_items: RetailSaleItem;
  retail_inventory_movements: RetailInventoryMovement;
};
