/**
 * Deployment Policy Engine Types
 * 
 * Defines verification response structures and errors for the Policy Engine.
 * Enforces Platform Constitution Law 11 (Strictly No any Types).
 * 
 * @module platform/host/policy
 */

export interface PolicyValidationResult {
  isValid: boolean;
  capabilityId: string;
  finalTier?: 'T1' | 'T2' | 'T3';
  rolloutPolicy?: string;
  safetyProfile?: string;
  reason?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export class GovernanceViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GovernanceViolationError';
    // Restore prototype chain
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
