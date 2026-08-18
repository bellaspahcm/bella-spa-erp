/**
 * Tenant Repository
 * 
 * Database operations for runtime_tenant_registry table
 * 
 * CRITICAL: All operations tenant-scoped
 * 
 * Version: 1.0.0
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  TenantRegistryRecord,
  TenantRegistryInsert,
  TenantRegistryUpdate,
} from '../types/database.types';
import { TenantIsolationError, buildErrorContext } from '../types/runtime-errors.types';

/**
 * Tenant Repository
 * 
 * Manages tenant registry (CRUD + isolation)
 */
export class TenantRepository {
  constructor(private supabase: SupabaseClient) {}
  
  /**
   * Create Tenant
   * 
   * Register new tenant
   * 
   * @throws Error if tenant already exists or database error
   */
  async createTenant(tenant: TenantRegistryInsert): Promise<TenantRegistryRecord> {
    const { data, error } = await this.supabase
      .from('runtime_tenant_registry')
      .insert(tenant)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create tenant: ${error.message}`);
    }
    
    return this.mapToRecord(data);
  }
  
  /**
   * Get Tenant by ID
   * 
   * Retrieve tenant record
   * 
   * @throws TenantIsolationError if tenant not found
   */
  async getTenant(tenantId: string): Promise<TenantRegistryRecord> {
    const { data, error } = await this.supabase
      .from('runtime_tenant_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .single();
    
    if (error || !data) {
      throw new TenantIsolationError(
        tenantId,
        `Tenant not found: ${tenantId}`,
        buildErrorContext(undefined, error, { tenantId })
      );
    }
    
    return this.mapToRecord(data);
  }
  
  /**
   * Get Active Tenant
   * 
   * Retrieve tenant (must be active)
   * 
   * @throws TenantIsolationError if tenant not found or inactive
   */
  async getActiveTenant(tenantId: string): Promise<TenantRegistryRecord> {
    const { data, error } = await this.supabase
      .from('runtime_tenant_registry')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .single();
    
    if (error || !data) {
      throw new TenantIsolationError(
        tenantId,
        `Active tenant not found: ${tenantId}`,
        buildErrorContext(undefined, error, { tenantId })
      );
    }
    
    return this.mapToRecord(data);
  }
  
  /**
   * List Active Tenants
   * 
   * Query all active tenants
   */
  async listActiveTenants(): Promise<TenantRegistryRecord[]> {
    const { data, error } = await this.supabase
      .from('runtime_tenant_registry')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) {
      throw new Error(`Failed to list tenants: ${error.message}`);
    }
    
    return (data || []).map(this.mapToRecord);
  }
  
  /**
   * Update Tenant
   * 
   * Update tenant metadata
   * 
   * @throws TenantIsolationError if tenant not found
   */
  async updateTenant(
    tenantId: string,
    updates: TenantRegistryUpdate
  ): Promise<TenantRegistryRecord> {
    const { data, error } = await this.supabase
      .from('runtime_tenant_registry')
      .update(updates)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    
    if (error || !data) {
      throw new TenantIsolationError(
        tenantId,
        `Failed to update tenant: ${tenantId}`,
        buildErrorContext(undefined, error, { tenantId, updates })
      );
    }
    
    return this.mapToRecord(data);
  }
  
  /**
   * Deactivate Tenant
   * 
   * Soft delete (set is_active = false)
   */
  async deactivateTenant(tenantId: string): Promise<void> {
    await this.updateTenant(tenantId, { is_active: false });
  }
  
  /**
   * Activate Tenant
   * 
   * Reactivate inactive tenant
   */
  async activateTenant(tenantId: string): Promise<void> {
    await this.updateTenant(tenantId, { is_active: true });
  }
  
  /**
   * Tenant Exists
   * 
   * Check if tenant exists (non-throwing)
   */
  async tenantExists(tenantId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('runtime_tenant_registry')
      .select('tenant_id')
      .eq('tenant_id', tenantId)
      .single();
    
    return !error && data !== null;
  }
  
  /**
   * Is Tenant Active
   * 
   * Check if tenant exists and is active (non-throwing)
   */
  async isTenantActive(tenantId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('runtime_tenant_registry')
      .select('is_active')
      .eq('tenant_id', tenantId)
      .single();
    
    return !error && data?.is_active === true;
  }
  
  /**
   * Map database row to record
   */
  private mapToRecord(data: any): TenantRegistryRecord {
    return {
      tenant_id: data.tenant_id,
      tenant_name: data.tenant_name,
      is_active: data.is_active,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
      metadata: data.metadata,
    };
  }
}
