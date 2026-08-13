/**
 * BELLA LAND — PROPERTY CATALOG PRODUCT SERVICE
 *
 * Handles unit list displays, enforcing manifest capabilities.
 * Consumes the public IPropertyInventoryContract without direct DB access.
 *
 * @module src/products/bella-land/services/property-catalog.service
 */

import { IPropertyInventoryContract, PropertyUnitRow } from '../../../platform/real-estate/contracts/property-inventory.contract';
import { bellaLandManifest } from '../manifest';

export class PropertyCatalogProductService {
  constructor(private readonly inventoryContract: IPropertyInventoryContract) {}

  private assertCapability(capabilityId: string) {
    const capabilities = bellaLandManifest.capabilities || [];
    if (!capabilities.includes(capabilityId)) {
      throw new Error(`MANIFEST_VIOLATION: Capability '${capabilityId}' is not enabled in product manifest.`);
    }
  }

  /**
   * Retrieves products for a project under tenant isolation.
   */
  async getProducts(tenantId: string, projectId: string): Promise<PropertyUnitRow[]> {
    this.assertCapability('property_inventory_query');
    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!projectId) throw new Error('PROJECT_BOUNDARY_VIOLATION: projectId is required');

    return this.inventoryContract.getProducts(tenantId, projectId);
  }
}
