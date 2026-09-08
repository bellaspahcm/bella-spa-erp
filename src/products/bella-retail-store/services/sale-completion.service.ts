/**
 * BELLA RETAIL STORE - SALE COMPLETION SERVICE
 * 
 * W3: Complete Sale & Payment
 * - Validate items, apply discount, calculate final amount, process payment, complete Sale
 * - Entities: Sale, SaleItem, Customer, Product, Payment
 * - Evidence target: Transactional boundaries, Sale immutability
 * 
 * Architecture: Product -> Supabase Client -> retail_sales, retail_sale_items
 * Tenant Isolation: RLS policies enforced at DB level
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { RetailSale, RetailSaleItem } from '@/types/retail-database.types';

export interface ApplySaleDiscountRequest {
  tenantId: string;
  saleId: string;
  discountAmount: number;
  userId?: string;
}

export interface CompleteSaleRequest {
  tenantId: string;
  saleId: string;
  paymentMethod: 'CASH' | 'CARD' | 'MOBILE' | 'LOYALTY_POINTS';
  userId?: string;
}

export interface SaleCompletionResult {
  sale: RetailSale;
  items: RetailSaleItem[];
  totalPaid: number;
  completedAt: string;
}

export class SaleCompletionService {
  constructor(private readonly supabase: SupabaseClient) {}

  /**
   * W3.1: Validate sale items (ensure all items are valid and in stock)
   */
  async validateSaleItems(tenantId: string, saleId: string): Promise<{ valid: boolean; errors: string[] }> {
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    await this.supabase.rpc('set_tenant_context', { tenant_id: tenantId });

    const errors: string[] = [];

    // Get sale
    const { data: sale, error: saleError } = await this.supabase
      .from('retail_sales')
      .select('*')
      .eq('id', saleId)
      .eq('tenant_id', tenantId)
      .single();

    if (saleError || !sale) {
      errors.push(`SALE_NOT_FOUND: ${saleError?.message || 'Sale does not exist'}`);
      return { valid: false, errors };
    }

    if (sale.status !== 'DRAFT') {
      errors.push('SALE_NOT_DRAFT: Sale must be in DRAFT status to validate');
      return { valid: false, errors };
    }

    // Get sale items
    const { data: items, error: itemsError } = await this.supabase
      .from('retail_sale_items')
      .select('*')
      .eq('sale_id', saleId)
      .eq('tenant_id', tenantId);

    if (itemsError) {
      errors.push(`SALE_ITEMS_FETCH_FAILED: ${itemsError.message}`);
      return { valid: false, errors };
    }

    if (!items || items.length === 0) {
      errors.push('SALE_EMPTY: Sale must have at least one item');
      return { valid: false, errors };
    }

    // Validate each item's product exists and has sufficient stock
    for (const item of items) {
      const { data: product, error: productError } = await this.supabase
        .from('retail_products')
        .select('*')
        .eq('id', item.product_id)
        .eq('tenant_id', tenantId)
        .single();

      if (productError || !product) {
        errors.push(`PRODUCT_NOT_FOUND: Product ${item.product_id} does not exist`);
        continue;
      }

      if (product.status !== 'ACTIVE') {
        errors.push(`PRODUCT_INACTIVE: Product ${product.name} is not active`);
      }

      if (product.track_inventory) {
        const currentStock = product.current_stock ?? 0;
        if (currentStock < item.quantity) {
          errors.push(`INSUFFICIENT_STOCK: Product ${product.name} has ${currentStock} but need ${item.quantity}`);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * W3.2: Apply sale-level discount
   */
  async applySaleDiscount(request: ApplySaleDiscountRequest): Promise<RetailSale> {
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    await this.supabase.rpc('set_tenant_context', { tenant_id: request.tenantId });

    // Get current sale
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

    // Recalculate total with discount
    const subtotal = sale.subtotal;
    const taxAmount = sale.tax_amount;
    const totalAmount = subtotal + taxAmount - request.discountAmount;

    if (totalAmount < 0) {
      throw new Error('DISCOUNT_EXCEEDS_TOTAL: Discount cannot exceed sale total');
    }

    const { data: updatedSale, error: updateError } = await this.supabase
      .from('retail_sales')
      .update({
        discount_amount: request.discountAmount,
        total_amount: totalAmount,
      })
      .eq('id', request.saleId)
      .eq('tenant_id', request.tenantId)
      .select()
      .single();

    if (updateError) {
      throw new Error(`SALE_UPDATE_FAILED: ${updateError.message}`);
    }

    return updatedSale;
  }

  /**
   * W3.3: Complete sale and process payment
   * This is the critical boundary - once completed, sale becomes immutable
   */
  async completeSale(request: CompleteSaleRequest): Promise<SaleCompletionResult> {
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    await this.supabase.rpc('set_tenant_context', { tenant_id: request.tenantId });

    // Validate sale items first
    const validation = await this.validateSaleItems(request.tenantId, request.saleId);
    if (!validation.valid) {
      throw new Error(`SALE_VALIDATION_FAILED: ${validation.errors.join(', ')}`);
    }

    // Get sale and items
    const { data: sale, error: saleError } = await this.supabase
      .from('retail_sales')
      .select('*')
      .eq('id', request.saleId)
      .eq('tenant_id', request.tenantId)
      .single();

    if (saleError || !sale) {
      throw new Error(`SALE_NOT_FOUND: ${saleError?.message || 'Sale does not exist'}`);
    }

    const { data: items, error: itemsError } = await this.supabase
      .from('retail_sale_items')
      .select('*')
      .eq('sale_id', request.saleId)
      .eq('tenant_id', request.tenantId);

    if (itemsError) {
      throw new Error(`SALE_ITEMS_FETCH_FAILED: ${itemsError.message}`);
    }

    // Complete the sale (immutable boundary)
    const completedAt = new Date().toISOString();

    const { data: completedSale, error: completionError } = await this.supabase
      .from('retail_sales')
      .update({
        status: 'COMPLETED',
        payment_method: request.paymentMethod,
        payment_status: 'COMPLETED',
        completed_at: completedAt,
      })
      .eq('id', request.saleId)
      .eq('tenant_id', request.tenantId)
      .select()
      .single();

    if (completionError) {
      throw new Error(`SALE_COMPLETION_FAILED: ${completionError.message}`);
    }

    return {
      sale: completedSale,
      items: items || [],
      totalPaid: completedSale.total_amount,
      completedAt,
    };
  }

  /**
   * Get sale by ID
   */
  async getSaleById(tenantId: string, saleId: string): Promise<RetailSale | null> {
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    await this.supabase.rpc('set_tenant_context', { tenant_id: tenantId });

    const { data, error } = await this.supabase
      .from('retail_sales')
      .select('*')
      .eq('id', saleId)
      .eq('tenant_id', tenantId)
      .single();

    if (error) return null;
    return data;
  }

  /**
   * Cancel sale (only if DRAFT)
   */
  async cancelSale(tenantId: string, saleId: string, userId?: string): Promise<RetailSale> {
    if (!tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }

    await this.supabase.rpc('set_tenant_context', { tenant_id: tenantId });

    const { data: sale, error: saleError } = await this.supabase
      .from('retail_sales')
      .select('*')
      .eq('id', saleId)
      .eq('tenant_id', tenantId)
      .single();

    if (saleError || !sale) {
      throw new Error(`SALE_NOT_FOUND: ${saleError?.message || 'Sale does not exist'}`);
    }

    if (sale.status !== 'DRAFT') {
      throw new Error('SALE_IMMUTABILITY_VIOLATION: Only DRAFT sales can be cancelled');
    }

    const { data: cancelledSale, error: cancelError } = await this.supabase
      .from('retail_sales')
      .update({ status: 'CANCELLED' })
      .eq('id', saleId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (cancelError) {
      throw new Error(`SALE_CANCEL_FAILED: ${cancelError.message}`);
    }

    return cancelledSale;
  }
}
