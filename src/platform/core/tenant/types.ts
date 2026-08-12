/**
 * Common Core — Tenant Context & RLS Primitives
 * 
 * Domain-agnostic tenant isolation and context propagation primitives.
 * 
 * @module platform/core/tenant
 */

export interface TenantContext {
  tenantId: string;
  userId?: string;
  roles?: string[];
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface TenantContextPrimitive {
  getTenantId(): string | undefined;
  requireTenantId(): string;
  runInTenantContext<T>(context: TenantContext, callback: () => T | Promise<T>): T | Promise<T>;
}
