'use server';

/**
 * Product Sales Actions
 * 
 * Server actions for managing product sales and commission calculations.
 * Supports flexible commission input (fixed amount or percentage).
 * 
 * @module modules/product-sales/actions/product-sales-actions
 */

import { createClient } from '@/lib/supabase-server';
import { calculateProductSalesCommission } from '@/lib/business-rules/commission';
import type { CommissionType } from '@/lib/business-rules/commission';

// Note: product_sales table will be created by migration 20260622164000_create_product_sales.sql
// Inline type definition until database types are regenerated
interface ProductSalesInsert {
  tenant_id: string;
  ktv_id: string;
  customer_id?: string | null;
  booking_id?: string | null;
  product_name: string;
  product_category?: string | null;
  product_sku?: string | null;
  quantity: number;
  unit_price: number;
  total_sales_amount: number;
  override_commission_type?: string | null;
  override_commission_value?: number | null;
  calculated_commission: number;
  status?: string;
  payment_method?: string | null;
  sale_date: string;
  notes?: string | null;
}

interface CreateProductSaleInput {
  tenantId: string;
  ktvId: string;
  customerId?: string | null;
  productName: string;
  productCategory?: string | null;
  productSku?: string | null;
  quantity: number;
  unitPrice: number;
  totalSalesAmount: number;
  overrideCommissionType?: CommissionType | null;
  overrideCommissionValue?: number | null;
  paymentMethod: 'cash' | 'bank_transfer' | 'zalo_pay' | 'momo' | 'card';
  saleDate: string;
  notes?: string | null;
}

interface ActionResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Creates a new product sale record with commission calculation.
 * 
 * **Business Rules:**
 * 1. Calculate commission using override or tenant default
 * 2. Commission priority: override > tenant default > system default (10%)
 * 3. Set status to 'completed' by default
 * 4. Module isolation: Beauty Spa only
 * 
 * @param input - Product sale creation input
 * @returns Action result with created product sale data
 * 
 * @example
 * ```typescript
 * const result = await createProductSale({
 *   tenantId: '...',
 *   ktvId: '...',
 *   productName: 'Sữa tắm Dove',
 *   quantity: 2,
 *   unitPrice: 150000,
 *   totalSalesAmount: 300000,
 *   overrideCommissionType: 'percentage',
 *   overrideCommissionValue: 15,
 *   paymentMethod: 'cash',
 *   saleDate: '2026-06-22'
 * });
 * ```
 */
export async function createProductSale(
  input: CreateProductSaleInput
): Promise<ActionResult<{ id: string; calculatedCommission: number }>> {
  try {
    const supabase = await createClient();

    // TODO: Uncomment after running migration 20260622164000_create_product_sales.sql
    // This function will work once product_sales table exists in database
    
    console.warn('[createProductSale] Migration not run yet. Table product_sales does not exist.');
    return {
      success: false,
      error: 'Chức năng này sẽ khả dụng sau khi chạy migration. Table product_sales chưa tồn tại.',
    };

    /* IMPLEMENTATION - Uncomment after migration:
    
    // 1. Get tenant commission config for defaults
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('commission_config')
      .eq('id', input.tenantId)
      .single();

    const commissionConfig = tenant?.commission_config as {
      product_sales_commission_default?: {
        type: CommissionType;
        value: number;
      };
    } | null;

    const defaultType = commissionConfig?.product_sales_commission_default?.type;
    const defaultValue = commissionConfig?.product_sales_commission_default?.value;

    // 2. Calculate commission
    const calculatedCommission = calculateProductSalesCommission({
      totalSalesAmount: input.totalSalesAmount,
      overrideType: input.overrideCommissionType,
      overrideValue: input.overrideCommissionValue,
      defaultType,
      defaultValue,
    });

    // 3. Prepare insert data
    const insertData: ProductSalesInsert = {
      tenant_id: input.tenantId,
      ktv_id: input.ktvId,
      customer_id: input.customerId || null,
      product_name: input.productName,
      product_category: input.productCategory || null,
      product_sku: input.productSku || null,
      quantity: input.quantity,
      unit_price: input.unitPrice,
      total_sales_amount: input.totalSalesAmount,
      override_commission_type: input.overrideCommissionType || null,
      override_commission_value: input.overrideCommissionValue || null,
      calculated_commission: calculatedCommission,
      payment_method: input.paymentMethod,
      sale_date: input.saleDate,
      notes: input.notes || null,
      status: 'completed',
    };

    // 4. Insert product sale
    const { data: productSale, error: insertError } = await supabase
      .from('product_sales')
      .insert(insertData)
      .select('id, calculated_commission')
      .single();

    if (insertError) {
      console.error('Error inserting product sale:', insertError);
      return {
        success: false,
        error: 'Không thể lưu bán hàng. Vui lòng thử lại.',
      };
    }

    console.log('Product sale created successfully:', {
      id: productSale.id,
      commission: calculatedCommission,
    });

    return {
      success: true,
      data: {
        id: productSale.id,
        calculatedCommission: productSale.calculated_commission,
      },
    };
    
    */
  } catch (error) {
    console.error('Unexpected error in createProductSale:', error);
    return {
      success: false,
      error: 'Lỗi hệ thống. Vui lòng thử lại sau.',
    };
  }
}

/**
 * Updates an existing product sale and recalculates commission.
 * 
 * @param id - Product sale ID
 * @param input - Updated product sale data (partial)
 * @returns Action result
 */
export async function updateProductSale(
  id: string,
  input: Partial<CreateProductSaleInput>
): Promise<ActionResult> {
  console.warn('[updateProductSale] Migration not run yet. Table product_sales does not exist.');
  return {
    success: false,
    error: 'Chức năng này sẽ khả dụng sau khi chạy migration.',
  };
  
  /* IMPLEMENTATION - Uncomment after migration:
  try {
    const supabase = await createClient();

    // Get existing record
    const { data: existing, error: fetchError } = await supabase
      .from('product_sales')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return {
        success: false,
        error: 'Không tìm thấy bán hàng',
      };
    }

    // Merge with updates
    const updated = { ...existing, ...input };

    // Recalculate total if quantity or unit price changed
    if (input.quantity !== undefined || input.unitPrice !== undefined) {
      updated.total_sales_amount = updated.quantity * updated.unit_price;
    }

    // TODO: Get tenant config when migration is run
    // For now use system defaults
    const defaultType: CommissionType = 'percentage';
    const defaultValue = 10;

    // Recalculate commission
    const calculatedCommission = calculateProductSalesCommission({
      totalSalesAmount: updated.total_sales_amount,
      overrideType: updated.override_commission_type as CommissionType | null,
      overrideValue: updated.override_commission_value,
      defaultType,
      defaultValue,
    });

    // Update record
    const { error: updateError } = await supabase
      .from('product_sales')
      .update({
        product_name: updated.product_name,
        product_category: updated.product_category,
        product_sku: updated.product_sku,
        quantity: updated.quantity,
        unit_price: updated.unit_price,
        total_sales_amount: updated.total_sales_amount,
        override_commission_type: updated.override_commission_type,
        override_commission_value: updated.override_commission_value,
        calculated_commission: calculatedCommission,
        payment_method: updated.payment_method,
        sale_date: updated.sale_date,
        notes: updated.notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating product sale:', updateError);
      return {
        success: false,
        error: 'Không thể cập nhật bán hàng',
      };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected error in updateProductSale:', error);
    return {
      success: false,
      error: 'Lỗi hệ thống',
    };
  }
  */
}

/**
 * Soft deletes a product sale by setting status to 'cancelled'.
 * 
 * @param id - Product sale ID
 * @returns Action result
 */
export async function deleteProductSale(id: string): Promise<ActionResult> {
  console.warn('[deleteProductSale] Migration not run yet.');
  return { success: false, error: 'Chức năng này sẽ khả dụng sau khi chạy migration.' };
}

export async function getProductSales(filters?: {
  tenantId?: string;
  ktvId?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Promise<ActionResult<{ sales: unknown[]; total: number }>> {
  console.warn('[getProductSales] Migration not run yet.');
  return { success: false, error: 'Chức năng này sẽ khả dụng sau khi chạy migration.' };
}

export async function getProductSaleById(id: string): Promise<ActionResult<unknown>> {
  console.warn('[getProductSaleById] Migration not run yet.');
  return { success: false, error: 'Chức năng này sẽ khả dụng sau khi chạy migration.' };
}
