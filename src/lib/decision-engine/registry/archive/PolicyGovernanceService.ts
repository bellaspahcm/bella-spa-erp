/**
 * PolicyGovernanceService - Governance & Compliance Checks
 * 
 * Validates governance rules before policy publication
 */

import type {
  PolicyRegistryEntry,
  GovernanceCheckResult,
  UpdatePolicyMetadataInput,
} from './types';
import { GovernanceValidationError } from './types';
import { GOVERNANCE_DEFAULTS, ERROR_CODES, VALIDATION_RULES } from './constants';
import { PolicyRepository } from './PolicyRepository';
import { PolicyAuditService } from './PolicyAuditService';
import { validateEmail, validateISODate } from './validation';

export class PolicyGovernanceService {
  /**
   * Check governance compliance
   */
  static async checkGovernance(
    policyId: string,
    version: string
  ): Promise<GovernanceCheckResult> {
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    const warnings: string[] = [];
    const errors: string[] = [];
    const checks = {
      reviewDateValid: true,
      expireDateValid: true,
      ownershipComplete: true,
      governanceComplete: true,
    };

    // Check review date
    if (policy.reviewDate) {
      const reviewDate = new Date(policy.reviewDate);
      const now = new Date();
      
      if (reviewDate < now) {
        checks.reviewDateValid = false;
        warnings.push(`Review date has passed: ${policy.reviewDate}`);
      }
      
      // Warn if review date is within warning period
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + GOVERNANCE_DEFAULTS.expiryWarningDays);
      if (reviewDate < warningDate) {
        warnings.push(`Review date approaching: ${policy.reviewDate}`);
      }
    } else {
      checks.reviewDateValid = false;
      warnings.push('No review date set');
    }

    // Check expire date
    if (policy.expireDate) {
      const expireDate = new Date(policy.expireDate);
      const now = new Date();
      
      if (expireDate < now) {
        checks.expireDateValid = false;
        errors.push(`Policy has expired: ${policy.expireDate}`);
      }
      
      // Warn if expiring soon
      const warningDate = new Date();
      warningDate.setDate(warningDate.getDate() + GOVERNANCE_DEFAULTS.expiryWarningDays);
      if (expireDate < warningDate) {
        warnings.push(`Policy expiring soon: ${policy.expireDate}`);
      }
    }

    // Check ownership
    if (!policy.businessOwner || !policy.businessOwnerEmail) {
      checks.ownershipComplete = false;
      errors.push('Business owner information is incomplete');
    }
    
    if (!policy.technicalOwner || !policy.technicalOwnerEmail) {
      checks.ownershipComplete = false;
      warnings.push('Technical owner information is incomplete');
    }

    // Check governance fields
    if (!policy.ownerDepartment) {
      checks.governanceComplete = false;
      warnings.push('Owner department not set');
    }
    
    if (!policy.effectiveDate) {
      checks.governanceComplete = false;
      warnings.push('Effective date not set');
    }

    const passed = errors.length === 0;

    return {
      policyId,
      version,
      passed,
      warnings,
      errors,
      checks,
    };
  }

  /**
   * Check if policy is eligible for publishing
   * 
   * More strict than checkGovernance - used for publish action
   */
  static async checkPublishEligibility(
    policyId: string,
    version: string
  ): Promise<GovernanceCheckResult> {
    const result = await this.checkGovernance(policyId, version);

    // Add strict publish checks
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // MUST have business owner
    if (!policy.businessOwner || !policy.businessOwnerEmail) {
      result.errors.push('Business owner is required for publishing');
      result.passed = false;
    }

    // MUST have technical owner
    if (!policy.technicalOwner || !policy.technicalOwnerEmail) {
      result.errors.push('Technical owner is required for publishing');
      result.passed = false;
    }

    // MUST have department
    if (!policy.ownerDepartment) {
      result.errors.push('Owner department is required for publishing');
      result.passed = false;
    }

    // MUST have effective date
    if (!policy.effectiveDate) {
      result.errors.push('Effective date is required for publishing');
      result.passed = false;
    }

    // MUST NOT be expired
    if (policy.expireDate) {
      const expireDate = new Date(policy.expireDate);
      const now = new Date();
      if (expireDate < now) {
        result.errors.push('Cannot publish expired policy');
        result.passed = false;
      }
    }

    // MUST have review date
    if (!policy.reviewDate) {
      result.warnings.push('No review date set - policy may become stale');
    }

    return result;
  }

  /**
   * Update governance fields
   */
  static async updateGovernance(
    policyId: string,
    version: string,
    updates: UpdatePolicyMetadataInput,
    userId: string,
    reason?: string
  ): Promise<PolicyRegistryEntry> {
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);

    // Validate governance updates
    if (updates.businessOwnerEmail) {
      if (!validateEmail(updates.businessOwnerEmail)) {
        throw new GovernanceValidationError(
          'Invalid business owner email format',
          ['businessOwnerEmail']
        );
      }
    }

    if (updates.technicalOwnerEmail) {
      if (!validateEmail(updates.technicalOwnerEmail)) {
        throw new GovernanceValidationError(
          'Invalid technical owner email format',
          ['technicalOwnerEmail']
        );
      }
    }

    if (updates.reviewDate) {
      if (!validateISODate(updates.reviewDate)) {
        throw new GovernanceValidationError(
          'Invalid review date format (must be ISO date)',
          ['reviewDate']
        );
      }
    }

    if (updates.effectiveDate) {
      if (!validateISODate(updates.effectiveDate)) {
        throw new GovernanceValidationError(
          'Invalid effective date format (must be ISO date)',
          ['effectiveDate']
        );
      }
    }

    if (updates.expireDate) {
      if (!validateISODate(updates.expireDate)) {
        throw new GovernanceValidationError(
          'Invalid expire date format (must be ISO date)',
          ['expireDate']
        );
      }
    }

    // Track which fields changed for audit
    const changedFields: Array<{ field: string; oldValue: any; newValue: any }> = [];

    if (updates.businessOwner && updates.businessOwner !== policy.businessOwner) {
      changedFields.push({
        field: 'businessOwner',
        oldValue: policy.businessOwner,
        newValue: updates.businessOwner,
      });
    }

    if (updates.businessOwnerEmail && updates.businessOwnerEmail !== policy.businessOwnerEmail) {
      changedFields.push({
        field: 'businessOwnerEmail',
        oldValue: policy.businessOwnerEmail,
        newValue: updates.businessOwnerEmail,
      });
    }

    if (updates.technicalOwner && updates.technicalOwner !== policy.technicalOwner) {
      changedFields.push({
        field: 'technicalOwner',
        oldValue: policy.technicalOwner,
        newValue: updates.technicalOwner,
      });
    }

    if (updates.technicalOwnerEmail && updates.technicalOwnerEmail !== policy.technicalOwnerEmail) {
      changedFields.push({
        field: 'technicalOwnerEmail',
        oldValue: policy.technicalOwnerEmail,
        newValue: updates.technicalOwnerEmail,
      });
    }

    if (updates.ownerDepartment && updates.ownerDepartment !== policy.ownerDepartment) {
      changedFields.push({
        field: 'ownerDepartment',
        oldValue: policy.ownerDepartment,
        newValue: updates.ownerDepartment,
      });
    }

    if (updates.reviewDate && updates.reviewDate !== policy.reviewDate) {
      changedFields.push({
        field: 'reviewDate',
        oldValue: policy.reviewDate,
        newValue: updates.reviewDate,
      });
    }

    if (updates.effectiveDate && updates.effectiveDate !== policy.effectiveDate) {
      changedFields.push({
        field: 'effectiveDate',
        oldValue: policy.effectiveDate,
        newValue: updates.effectiveDate,
      });
    }

    if (updates.expireDate && updates.expireDate !== policy.expireDate) {
      changedFields.push({
        field: 'expireDate',
        oldValue: policy.expireDate,
        newValue: updates.expireDate,
      });
    }

    // Update policy
    const updated = await PolicyRepository.update(policyId, version, updates, userId);

    // Log each field change to audit trail
    for (const change of changedFields) {
      await PolicyAuditService.logFieldUpdate(
        policyId,
        version,
        change.field,
        change.oldValue,
        change.newValue,
        userId,
        reason || `Updated ${change.field}`
      );
    }

    return updated;
  }

  /**
   * Set review date (convenience method)
   */
  static async setReviewDate(
    policyId: string,
    version: string,
    reviewDate: string,
    userId: string,
    reason?: string
  ): Promise<PolicyRegistryEntry> {
    if (!validateISODate(reviewDate)) {
      throw new GovernanceValidationError(
        'Invalid review date format (must be ISO date)',
        ['reviewDate']
      );
    }

    return this.updateGovernance(
      policyId,
      version,
      { reviewDate },
      userId,
      reason || `Set review date to ${reviewDate}`
    );
  }

  /**
   * Get policies needing review (review date passed)
   */
  static async getPoliciesNeedingReview(): Promise<PolicyRegistryEntry[]> {
    return PolicyRepository.findAll({
      status: 'active',
      needsReview: true,
    });
  }

  /**
   * Get policies expiring soon
   */
  static async getExpiringPolicies(
    daysThreshold: number = GOVERNANCE_DEFAULTS.expiryWarningDays
  ): Promise<PolicyRegistryEntry[]> {
    return PolicyRepository.findAll({
      status: 'active',
      expiringSoon: true,
    });
  }

  /**
   * Check if policy is expired
   */
  static async checkExpiryDate(policyId: string, version: string): Promise<boolean> {
    const policy = await PolicyRepository.findByIdAndVersion(policyId, version);
    
    if (!policy.expireDate) return false;

    const expireDate = new Date(policy.expireDate);
    const now = new Date();
    
    return expireDate < now;
  }

  /**
   * Validate governance fields before policy creation
   */
  static validateGovernanceInput(input: UpdatePolicyMetadataInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (input.businessOwnerEmail && !validateEmail(input.businessOwnerEmail)) {
      errors.push('Invalid business owner email format');
    }

    if (input.technicalOwnerEmail && !validateEmail(input.technicalOwnerEmail)) {
      errors.push('Invalid technical owner email format');
    }

    if (input.reviewDate && !validateISODate(input.reviewDate)) {
      errors.push('Invalid review date format (must be ISO date string)');
    }

    if (input.effectiveDate && !validateISODate(input.effectiveDate)) {
      errors.push('Invalid effective date format (must be ISO date string)');
    }

    if (input.expireDate && !validateISODate(input.expireDate)) {
      errors.push('Invalid expire date format (must be ISO date string)');
    }

    // Check that expire date is after effective date
    if (input.effectiveDate && input.expireDate) {
      const effectiveDate = new Date(input.effectiveDate);
      const expireDate = new Date(input.expireDate);
      
      if (expireDate <= effectiveDate) {
        errors.push('Expire date must be after effective date');
      }
    }

    // Check that review date is in the future
    if (input.reviewDate) {
      const reviewDate = new Date(input.reviewDate);
      const now = new Date();
      
      if (reviewDate < now) {
        errors.push('Review date must be in the future');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
