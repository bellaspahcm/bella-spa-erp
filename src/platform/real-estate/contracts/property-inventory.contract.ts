/**
 * Real Estate Kernel — Property Inventory Public Contract
 *
 * Defines the public read contract for real estate property units and projects.
 *
 * @module platform/real-estate/contracts/property-inventory.contract
 */

import type { Database } from '@/types/database.types';

export type PropertyProjectRow = Database['public']['Tables']['real_estate_projects']['Row'];
export type PropertyUnitRow = Database['public']['Tables']['real_estate_products']['Row'];

export interface IPropertyInventoryContract {
  /**
   * Retrieves all property units/products inside a project under tenant isolation.
   */
  getProducts(tenantId: string, projectId: string): Promise<PropertyUnitRow[]>;
}
