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

    const units = await this.repository.findByProject(this.supabase, tenantId, projectId);
    return units.map(unit => {
      const props = unit.toProps();
      return {
        id: props.id,
        tenant_id: props.tenantId,
        project_id: props.projectId,
        product_code: props.productCode,
        product_type: props.productType,
        unit_code: props.unitCode,
        area: props.area,
        unit_price: props.unitPrice,
        status: props.status,
        owner_name: props.ownerName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      };
    });
  }
}
