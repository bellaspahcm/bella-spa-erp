/**
 * Real Estate Kernel — PropertyUnit Repository
 *
 * Repository pattern for loading and saving PropertyUnit entities.
 * Restricts all direct database access (supabase.from('real_estate_products')) to the Kernel repository layer.
 *
 * @module platform/real-estate/repositories/property-unit.repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { PropertyUnit, PropertyUnitStatus } from '../domain/property-unit.entity';
import type { Database } from '@/types/database.types';

export class PropertyUnitRepository {
  /**
   * Loads a PropertyUnit by ID and Tenant ID.
   */
  async findById(supabase: SupabaseClient<Database>, tenantId: string, id: string): Promise<PropertyUnit | null> {
    const { data, error } = await supabase
      .from('real_estate_products')
      .select('*')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw new Error(`DATABASE_ERROR: Failed to load property unit: ${error.message}`);
    }

    return new PropertyUnit({
      id: data.id,
      tenantId: data.tenant_id,
      projectId: data.project_id,
      productCode: data.product_code || '',
      productType: (data.product_type as 'apartment' | 'townhouse' | 'shophouse' | 'villa') || 'apartment',
      unitCode: data.product_code || '', // Use product_code as unitCode (schema has no unit_code field)
      area: Number(data.area || 0),
      unitPrice: Number(data.unit_price || 0),
      status: (data.status as PropertyUnitStatus) || 'available',
      ownerName: data.owner_name || null
    });
  }

  /**
   * Saves the state of a PropertyUnit back to the database.
   */
  async save(supabase: SupabaseClient<Database>, unit: PropertyUnit): Promise<void> {
    const { error } = await supabase
      .from('real_estate_products')
      .update({
        status: unit.status,
        owner_name: unit.ownerName,
        updated_at: new Date().toISOString()
      })
      .eq('id', unit.id)
      .eq('tenant_id', unit.tenantId);

    if (error) {
      throw new Error(`DATABASE_ERROR: Failed to save property unit ${unit.id}: ${error.message}`);
    }
  }

  /**
   * Retrieves all product units by project.
   */
  async findByProject(supabase: SupabaseClient<Database>, tenantId: string, projectId: string): Promise<PropertyUnit[]> {
    const { data, error } = await supabase
      .from('real_estate_products')
      .select('*')
      .eq('project_id', projectId)
      .eq('tenant_id', tenantId)
      .order('product_code', { ascending: true }); // Order by product_code (schema has no unit_code field)

    if (error) {
      throw new Error(`DATABASE_ERROR: Failed to fetch products for project: ${error.message}`);
    }

    return data.map(item => new PropertyUnit({
      id: item.id,
      tenantId: item.tenant_id,
      projectId: item.project_id,
      productCode: item.product_code || '',
      productType: (item.product_type as 'apartment' | 'townhouse' | 'shophouse' | 'villa') || 'apartment',
      unitCode: item.product_code || '', // Use product_code (schema has no unit_code field)
      area: Number(item.area || 0),
      unitPrice: Number(item.unit_price || 0),
      status: (item.status as PropertyUnitStatus) || 'available',
      ownerName: item.owner_name || null
    }));
  }
}
