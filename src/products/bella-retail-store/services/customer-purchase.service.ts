/**
 * BELLA RETAIL STORE - CUSTOMER PURCHASE SERVICE
 * 
 * W2: Customer Purchase
 * - Register Customer, start Sale, add Product, create SaleItem, calculate total
 * - Entities: Customer, Product, Sale, SaleItem
 * - Evidence target: Cross-domain interaction, Customer-Sale semantics
 * 
 * Architecture: Product -> Supabase Client -> retail_customers, retail_sales, retail_sale_items
 * Tenant Isolation: RLS policies enforced at DB level
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  RetailCustomer,
  RetailSale,
  RetailSaleItem,
  RetailProduct,
} from '@/types/retail-database.types';

export interface RegisterCustomerRequest {
  tenantId: string;
  email?: string;
  phone?: string;
  firstName: string;
  lastName: string;
  loyaltyTier?: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
}

export interface StartSaleRequest {
  tenantId: string;
  customerId?: string;
  cashierId?: string;
}

export interface AddSaleItemRequest {
  tenantId: string;
  saleId: string;
  productId: string;
  quantity: number;
  discountAmount?: number;
}

export interface SaleWithItems {
  sale: RetailSale;
  items: RetailSaleItem[];
  customer?: RetailCustomer;
}

export class CustomerPurchaseService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * W2.1: Register a new customer
   */
  async registerCustomer(request: RegisterCustomerRequest): Promise<RetailCustomer> {
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    if (!request.email && !request.phone) {
      throw new Error('CUSTOMER_VALIDATION_FAILED: email or phone is required');
    }

    await this.supabase.rpc('set_tenant_context', { tenant_id: request.tenantId });

    const { data, error } = await this.supabase
      .from('retail_customers')
      .insert({
        tenant_id: request.tenantId,
        email: request.email || null,
        phone: request.phone || null,
        first_name: request.firstName,
        last_name: request.lastName,
        loyalty_points: 0,
        loyalty_tier: request.loyaltyTier || null,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`CUSTOMER_REGISTRATION_FAILED: ${error.message}`);
    }

    return data;
  }

  /**
   * W2.2: Start a new sale (create draft sale)
   */
  async startSale(request: StartSaleRequest): Promise<RetailSale> {
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    await this.supabase.rpc('set_tenant_context', { tenant_id: request.tenantId });

    // Generate sale number (simple sequential for now)
    const saleNumber = `SALE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const { data, error } = await this.supabase
      .from('retail_sales')
      .insert({
        tenant_id: request.tenantId,
        sale_number: saleNumber,
        customer_id: request.customerId || null,
        subtotal: 0,
        tax_amount: 0,
        discount_amount: 0,
        total_amount: 0,
        payment_method: 'CASH', // Default, will be updated on completion
        payment_status: 'PENDING',
        status: 'DRAFT',
        cashier_id: request.cashierId || null,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`SALE_START_FAILED: ${error.message}`);
    }

    return data;
  }

  /**
   * W2.3: Add a product to the sale (create SaleItem)
   */
  async addSaleItem(request: AddSaleItemRequest): Promise<RetailSaleItem> {
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    await this.supabase.rpc('set_tenant_context', { tenant_id: request.tenantId });

    // Get product details
    const { data: product, error: productError } = await this.supabase
      .from('retail_products')
      .select('*')
      .eq('id', request.productId)
      .eq('tenant_id', request.tenantId)
      .single();

    if (productError || !product) {
      throw new Error(`PRODUCT_NOT_FOUND: ${productError?.message || 'Product does not exist'}`);
    }

    // Verify sale exists and is in DRAFT status
    const { data: sale, error: saleError } = await this.supabase
      .from('retail_sales')
      .select('*')
      .eq('id', request.saleId)
      .eq('tenant_id', request.tenantId)
      .single();

    if (saleError || !sale) {
      throw new Error(`SALE_NOT_FOUND: ${saleError?.message || 'Sale does not exist'}`);
    }

    if (sale.status !== 'DRAFT') {
      throw new Error('SALE_IMMUTABILITY_VIOLATION: Cannot modify non-draft sale');
    }

    // Calculate line total
    const unitPrice = product.base_price;
    const discountAmount = request.discountAmount || 0;
    const lineTotal = unitPrice * request.quantity - discountAmount;

    // Create sale item
    const { data: saleItem, error: itemError } = await this.supabase
      .from('retail_sale_items')
      .insert({
        tenant_id: request.tenantId,
        sale_id: request.saleId,
        product_id: request.productId,
        quantity: request.quantity,
        unit_price: unitPrice,
        discount_amount: discountAmount,
        line_total: lineTotal,
      })
      .select()
      .single();

    if (itemError) {
      throw new Error(`SALE_ITEM_CREATE_FAILED: ${itemError.message}`);
    }

    // Recalculate sale totals
    await this.recalculateSaleTotals(request.tenantId, request.saleId);

    return saleItem;
  }

  /**
   * W2.4: Get sale with items and customer
   */
  async getSaleWithItems(tenantId: string, saleId: string): Promise<SaleWithItems> {
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    await this.supabase.rpc('set_tenant_context', { tenant_id: tenantId });

    // Get sale
    const { data: sale, error: saleError } = await this.supabase
      .from('retail_sales')
      .select('*')
      .eq('id', saleId)
      .eq('tenant_id', tenantId)
      .single();

    if (saleError || !sale) {
      throw new Error(`SALE_NOT_FOUND: ${saleError?.message || 'Sale does not exist'}`);
    }

    // Get sale items
    const { data: items, error: itemsError } = await this.supabase
      .from('retail_sale_items')
      .select('*')
      .eq('sale_id', saleId)
      .eq('tenant_id', tenantId);

    if (itemsError) {
      throw new Error(`SALE_ITEMS_FETCH_FAILED: ${itemsError.message}`);
    }

    // Get customer if exists
    let customer: RetailCustomer | undefined;
    if (sale.customer_id) {
      const { data: customerData, error: customerError } = await this.supabase
        .from('retail_customers')
        .select('*')
        .eq('id', sale.customer_id)
        .eq('tenant_id', tenantId)
        .single();

      if (!customerError && customerData) {
        customer = customerData;
      }
    }

    return {
      sale,
      items: items || [],
      customer,
    };
  }

  /**
   * Get customer by ID
   */
  async getCustomerById(tenantId: string, customerId: string): Promise<RetailCustomer | null> {
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    await this.supabase.rpc('set_tenant_context', { tenant_id: tenantId });

    const { data, error } = await this.supabase
      .from('retail_customers')
      .select('*')
      .eq('id', customerId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Helper: Recalculate sale totals from items
   */
  private async recalculateSaleTotals(tenantId: string, saleId: string): Promise<void> {
    // Get all items for the sale
    const { data: items, error: itemsError } = await this.supabase
      .from('retail_sale_items')
      .select('*')
      .eq('sale_id', saleId)
      .eq('tenant_id', tenantId);

    if (itemsError) {
      throw new Error(`SALE_ITEMS_FETCH_FAILED: ${itemsError.message}`);
    }

    const subtotal = (items || []).reduce((sum, item) => sum + item.line_total, 0);

    // Update sale totals (tax calculated as 10% for simplicity)
    const taxAmount = subtotal * 0.1;
    const totalAmount = subtotal + taxAmount;

    const { error: updateError } = await this.supabase
      .from('retail_sales')
      .update({
        subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
      })
      .eq('id', saleId)
      .eq('tenant_id', tenantId);

    if (updateError) {
      throw new Error(`SALE_UPDATE_FAILED: ${updateError.message}`);
    }
  }
}
