/**
 * Common Core — Tenant Context Implementation
 * 
 * Provides thread-safe / async local context storage for active tenant identity.
 * 
 * @module platform/core/tenant/tenant-context.primitive
 */

import { TenantContext, TenantContextPrimitive } from './types';

export class DefaultTenantContextPrimitive implements TenantContextPrimitive {
  private activeContext?: TenantContext;

  public getTenantId(): string | undefined {
    return this.activeContext?.tenantId;
  }

  public requireTenantId(): string {
    const tenantId = this.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context required but not set');
    }
    return tenantId;
  }

  public async runInTenantContext<T>(
    context: TenantContext,
    callback: () => T | Promise<T>
  ): Promise<T> {
    const previousContext = this.activeContext;
    this.activeContext = context;
    try {
      return await callback();
    } finally {
      this.activeContext = previousContext;
    }
  }
}

export const defaultTenantContext = new DefaultTenantContextPrimitive();
