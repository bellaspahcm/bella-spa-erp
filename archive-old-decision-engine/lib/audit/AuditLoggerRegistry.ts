/**
 * Audit Logger Registry
 * 
 * Singleton registry to access ResilientDecisionAuditLogger health metrics
 * from health endpoint without circular dependencies.
 */

import type { ResilientDecisionAuditLoggerBridge } from './ResilientDecisionAuditLoggerBridge';

class AuditLoggerRegistry {
  private static instance: AuditLoggerRegistry;
  private logger: ResilientDecisionAuditLoggerBridge | null = null;

  private constructor() {}

  static getInstance(): AuditLoggerRegistry {
    if (!AuditLoggerRegistry.instance) {
      AuditLoggerRegistry.instance = new AuditLoggerRegistry();
    }
    return AuditLoggerRegistry.instance;
  }

  register(logger: ResilientDecisionAuditLoggerBridge): void {
    this.logger = logger;
  }

  getLogger(): ResilientDecisionAuditLoggerBridge | null {
    return this.logger;
  }

  getHealth(): any {
    if (!this.logger) {
      return {
        status: 'not-initialized',
        message: 'Resilient audit logger not registered',
      };
    }

    try {
      return this.logger.getHealth();
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

export const auditLoggerRegistry = AuditLoggerRegistry.getInstance();
