/**
 * Common Core — Audit & Provenance Primitives
 * 
 * Domain-agnostic audit metadata interface.
 * Strictly limited to technical metadata (tenant, user, timestamps, correlation).
 * 
 * @module platform/core/audit
 */

export interface AuditContext {
  tenantId: string;
  userId: string;
  correlationId?: string;
}

export interface AuditableEntity {
  tenantId: string;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  correlationId?: string;
}
