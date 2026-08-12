/**
 * Common Core — Audit Trail Helper
 * 
 * Provides utility methods to stamp creation and modification metadata.
 * 
 * @module platform/core/audit/audit-trail.primitive
 */

import { AuditContext, AuditableEntity } from './types';

export class AuditTrailPrimitive {
  public static createAuditFields(context: AuditContext): AuditableEntity {
    const now = new Date().toISOString();
    return {
      tenantId: context.tenantId,
      createdBy: context.userId,
      createdAt: now,
      updatedBy: context.userId,
      updatedAt: now,
      correlationId: context.correlationId,
    };
  }

  public static updateAuditFields(entity: AuditableEntity, userId: string, correlationId?: string): AuditableEntity {
    return {
      ...entity,
      updatedBy: userId,
      updatedAt: new Date().toISOString(),
      correlationId: correlationId || entity.correlationId,
    };
  }
}
