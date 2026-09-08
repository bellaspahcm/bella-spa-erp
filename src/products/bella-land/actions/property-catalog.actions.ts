/**
 * BELLA LAND — PROPERTY CATALOG SERVER ACTIONS
 *
 * Next.js Server Actions for Property Catalog Product Service.
 * These actions provide the bridge between UI and Bella Land Product layer.
 *
 * Architecture flow:
 *   UI → Server Action → Product Service → Real Estate OS Contract → Database
 *
 * @module src/products/bella-land/actions/property-catalog.actions
 */

'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { PropertyCatalogProductService } from '../services/property-catalog.service';
import type { IPropertyInventoryContract } from '../../../platform/real-estate/contracts/property-inventory.contract';
import { Database } from '@/types/database.types';

type PropertyUnitRow = Database['public']['Tables']['real_estate_products']['Row'];

export interface PropertyCatalogResult {
  success: boolean;
  data?: PropertyUnitRow[] | null;
  error?: string;
}

/**
 * Creates Real Estate OS service implementation for Property Inventory contract.
 * This is a temporary workaround until dependency injection is properly implemented.
 */
async function createInventoryContract(supabase: any): Promise<IPropertyInventoryContract> {
  // Dynamically import internal Kernel modules (only at runtime, not at module level)
  const { PropertyInventoryService } = await import('../../../platform/real-estate/engines/property-inventory.service');
  const { PropertyUnitRepository } = await import('../../../platform/real-estate/repositories/property-unit.repository');
  
  const repository = new PropertyUnitRepository();
  return new PropertyInventoryService(repository, supabase);
}

/**
 * Fetches property units for a project through Bella Land Product service.
 * 
 * @param projectId - UUID of the real estate project
 * @returns Result containing property units or error
 */
export async function fetchPropertyCatalogAction(
  projectId: string
): Promise<PropertyCatalogResult> {
  try {
    // 1. Get authenticated user and tenant context
    const user = await getCurrentUser();
    if (!user || !user.tenant_id) {
      return { 
        success: false, 
        error: 'UNAUTHORIZED: Missing tenant context' 
      };
    }

    // 2. Validate inputs
    if (!projectId) {
      return { 
        success: false, 
        error: 'VALIDATION_ERROR: Project ID is required' 
      };
    }

    // 3. Initialize Real Estate OS service stack
    const supabase = await createClient();
    const inventoryContract = await createInventoryContract(supabase);

    // 4. Initialize Bella Land Product service
    const catalogService = new PropertyCatalogProductService(inventoryContract);

    // 5. Execute query through Product service
    const products = await catalogService.getProducts(user.tenant_id, projectId);

    return { 
      success: true, 
      data: products 
    };
  } catch (error) {
    console.error('[fetchPropertyCatalogAction] Error:', error);
    
    // Handle known error types
    if (error instanceof Error) {
      if (error.message.includes('TENANT_ISOLATION_VIOLATION')) {
        return {
          success: false,
          error: 'SECURITY_ERROR: Tenant isolation violation detected'
        };
      }
      if (error.message.includes('MANIFEST_VIOLATION')) {
        return {
          success: false,
          error: 'CAPABILITY_ERROR: Requested capability not enabled in product manifest'
        };
      }
      return {
        success: false,
        error: error.message
      };
    }

    return {
      success: false,
      error: 'SYSTEM_ERROR: Unexpected error occurred'
    };
  }
}
