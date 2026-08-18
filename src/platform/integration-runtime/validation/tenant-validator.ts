/**
 * Tenant Validator
 * 
 * Tenant isolation enforcement:
 * - Validate tenant exists
 * - Validate tenant is active
 * - Prevent cross-tenant access
 * 
 * Version: 1.0.0
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 */

import { TenantIsolationError, buildErrorContext } from '../types/runtime-errors.types';
import { TenantContext } from '../types/runtime-config.types';

/**
 * Tenant Validator
 * 
 * Validates tenant context and enforces isolation
 */
export class TenantValidator {
  // In-memory cache of valid tenants (production: use database)
  private validTenants: Map<string, TenantContext> = new Map();
  
  /**
   * Register Tenant
   * 
   * Add tenant to valid tenant registry
   * (Production: this would be database-backed)
   */
  public registerTenant(tenant: TenantContext): void {
    this.validTenants.set(tenant.tenantId, tenant);
  }
  
  /**
   * Validate Tenant
   * 
   * @throws TenantIsolationError if tenant invalid or inactive
   */
  public validateTenant(tenantId: string): TenantContext {
    if (!tenantId || tenantId.trim().length === 0) {
      throw new TenantIsolationError(
        tenantId,
        'Tenant ID is required',
        buildErrorContext(undefined, undefined, { tenantId })
      );
    }
    
    const tenant = this.validTenants.get(tenantId);
    
    if (!tenant) {
      throw new TenantIsolationError(
        tenantId,
        `Tenant not found: ${tenantId}`,
        buildErrorContext(undefined, undefined, { tenantId })
      );
    }
    
    if (!tenant.isActive) {
      throw new TenantIsolationError(
        tenantId,
        `Tenant is inactive: ${tenantId}`,
        buildErrorContext(undefined, undefined, { tenantId, tenant })
      );
    }
    
    return tenant;
  }
  
  /**
   * Validate Tenant Scope
   * 
   * Ensure operation is scoped to single tenant
   * Prevent cross-tenant access
   * 
   * @throws TenantIsolationError if cross-tenant access attempted
   */
  public validateTenantScope(
    requestTenantId: string,
    resourceTenantId: string
  ): void {
    if (requestTenantId !== resourceTenantId) {
      throw new TenantIsolationError(
        requestTenantId,
        `Cross-tenant access denied: Request tenant ${requestTenantId} ` +
        `cannot access resource of tenant ${resourceTenantId}`,
        buildErrorContext(undefined, undefined, {
          requestTenantId,
          resourceTenantId,
        })
      );
    }
  }
  
  /**
   * Get Tenant Context
   * 
   * Retrieve tenant details (if valid)
   */
  public getTenantContext(tenantId: string): TenantContext | undefined {
    return this.validTenants.get(tenantId);
  }
  
  /**
   * Is Tenant Valid
   * 
   * Check if tenant exists and is active (non-throwing)
   */
  public isTenantValid(tenantId: string): boolean {
    const tenant = this.validTenants.get(tenantId);
    return tenant !== undefined && tenant.isActive;
  }
  
  /**
   * List Active Tenants
   * 
   * Get all active tenants
   */
  public listActiveTenants(): TenantContext[] {
    return Array.from(this.validTenants.values()).filter(t => t.isActive);
  }
  
  /**
   * Deactivate Tenant
   * 
   * Mark tenant as inactive (soft delete)
   */
  public deactivateTenant(tenantId: string): void {
    const tenant = this.validTenants.get(tenantId);
    if (tenant) {
      tenant.isActive = false;
      this.validTenants.set(tenantId, tenant);
    }
  }
  
  /**
   * Clear Cache
   * 
   * Clear in-memory tenant cache (for testing)
   */
  public clearCache(): void {
    this.validTenants.clear();
  }
}

/**
 * Default tenant validator instance
 * 
 * Singleton for common usage
 */
export const tenantValidator = new TenantValidator();
