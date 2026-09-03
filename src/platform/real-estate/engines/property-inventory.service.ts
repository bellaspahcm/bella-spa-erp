/**
 * Real Estate Kernel — Property Inventory Service
 *
 * Implements IPropertyInventoryContract, providing read-only access to property inventory.
 *
 * @module platform/real-estate/engines/property-inventory.service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { IPropertyInventoryContract, PropertyUnitRow } from '../contracts/property-inventory.contract';
import { PropertyUnitRepository } from '../repositories/property-unit.repository';
import type { Database } from '@/types/database.types';

export class PropertyInventoryService implements IPropertyInventoryContract {
  constructor(
    private readonly repository: PropertyUnitRepository,
    private readonly supabase: SupabaseClient<Database>
  ) {}

  /**
   * Retrieves products for a given project under tenant isolation.
   */
  async getProducts(tenantId: string, projectId: string): Promise<PropertyUnitRow[]> {
    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!projectId) throw new Error('PROJECT_BOUNDARY_VIOLATION: projectId is required');

    // Query database directly to return complete Row types
    const { data, error } = await this.supabase
      .from('real_estate_products')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('project_id', projectId)
      .order('product_code', { ascending: true });

    if (error) {
      throw new Error(`DATABASE_ERROR: Failed to fetch products for project: ${error.message}`);
    }

    return data || [];
  }
}
