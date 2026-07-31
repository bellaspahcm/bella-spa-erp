import { Database } from '@/types/database.types';
import { SupabaseClient } from '@supabase/supabase-js';
import type { ApartmentStatus } from '../contexts/inventory/domain/apartment';

type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];
type ProductUpdate = Database['public']['Tables']['real_estate_products']['Update'];

export class ProductService {
  /**
   * Fetch all products (units) inside a project for a given tenant
   */
  static async getProducts(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    projectId: string
  ): Promise<ProductRow[]> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    const { data, error } = await supabase
      .from('real_estate_products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('product_code', { ascending: true });

    if (error) {
      console.error('[ProductService] Error fetching products:', error.message);
      throw error;
    }

    return data || [];
  }

  /**
   * Update product status and owner details, validating through Inventory State Machine
   */
  static async updateProductStatus(
    supabase: SupabaseClient<Database>,
    tenantId: string,
    productId: string,
    targetStatus: ProductRow['status'],
    ownerName?: string | null
  ): Promise<ProductRow> {
    if (!tenantId) {
      throw new Error('Tenant ID is required');
    }
    if (!productId) {
      throw new Error('Product ID is required');
    }

    // 1. Fetch current status of the product under tenant scope
    const { data: product, error: fetchError } = await supabase
      .from('real_estate_products')
      .select('*')
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchError || !product) {
      console.error('[ProductService] Product not found or access denied:', fetchError?.message);
      throw new Error(fetchError?.message || 'Product not found or access denied');
    }

    const currentStatus = product.status as ApartmentStatus;

    // 2. Validate state transition using Bounded Context Domain Model
    const { ApartmentDomainModel } = await import('../contexts/inventory/domain/apartment');
    const apartmentModel = new ApartmentDomainModel({
      id: product.id,
      projectId: product.project_id || '',
      unitCode: product.product_code,
      floor: product.floor ? parseInt(product.floor, 10) : 0,
      block: product.block || '',
      bedrooms: 0,
      bathrooms: 0,
      area: product.area || 0,
      price: product.unit_price || 0,
      status: currentStatus,
      ownerName: product.owner_name,
    });

    apartmentModel.transitionTo(targetStatus as ApartmentStatus, ownerName);


    // 3. Perform update (Zero Silent Failures - propagate errors)
    const updatePayload: ProductUpdate = {
      status: targetStatus,
      updated_at: new Date().toISOString(),
    };

    if (ownerName !== undefined) {
      updatePayload.owner_name = ownerName;
    }

    const { data: updatedProduct, error: updateError } = await supabase
      .from('real_estate_products')
      .update(updatePayload)
      .eq('id', productId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (updateError || !updatedProduct) {
      console.error('[ProductService] Error updating product:', updateError?.message);
      throw new Error(updateError?.message || 'Failed to update product status');
    }

    // 4. Emit accounting outbox event for financial state transitions (Zero Direct Ledger Write)
    try {
      const { RealEstateAccountingService } = await import('./RealEstateAccountingService');
      await RealEstateAccountingService.emitStatusChangeEvent(
        supabase,
        tenantId,
        updatedProduct,
        targetStatus
      );
    } catch (acctErr) {
      console.warn('[ProductService] Warning: Failed to emit accounting event:', acctErr);
    }

    return updatedProduct;
  }
}

