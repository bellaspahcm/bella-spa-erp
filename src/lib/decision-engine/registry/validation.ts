/**
 * Policy Registry Validation Utilities
 * 
 * Validates policy structure, version format, emails, status transitions, etc.
 */

import type { Policy } from '../types';
import type { PolicyStatus } from './types';
import { 
  VALIDATION_RULES, 
  VALID_STATUS_TRANSITIONS,
  ERROR_CODES 
} from './constants';
import { PolicyRegistryError } from './types';

// ============================================================================
// POLICY VALIDATION
// ============================================================================

/**
 * Validate policy structure
 * Returns validation result object instead of throwing
 */
export function validatePolicy(policy: Policy): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required fields
  if (!policy.id) {
    errors.push('Policy ID is required');
  } else {
    // Validate policy ID format
    if (!VALIDATION_RULES.policyId.pattern.test(policy.id)) {
      errors.push(`Invalid policy ID format: ${policy.id}. Must contain only alphanumeric characters, hyphens, and underscores`);
    }

    // Validate length
    if (policy.id.length < VALIDATION_RULES.policyId.minLength) {
      errors.push(`Policy ID must be at least ${VALIDATION_RULES.policyId.minLength} characters (max ${VALIDATION_RULES.policyId.maxLength})`);
    }

    if (policy.id.length > VALIDATION_RULES.policyId.maxLength) {
      errors.push(`Policy ID must not exceed ${VALIDATION_RULES.policyId.maxLength} characters (min ${VALIDATION_RULES.policyId.minLength})`);
    }
  }

  if (!policy.name) {
    errors.push('Policy name is required');
  } else {
    // Validate name length
    if (policy.name.length < VALIDATION_RULES.name.minLength) {
      errors.push(`Policy name must be at least ${VALIDATION_RULES.name.minLength} characters (max ${VALIDATION_RULES.name.maxLength})`);
    }

    if (policy.name.length > VALIDATION_RULES.name.maxLength) {
      errors.push(`Policy name must not exceed ${VALIDATION_RULES.name.maxLength} characters (min ${VALIDATION_RULES.name.minLength})`);
    }
  }

  // Validate description length (optional)
  if (policy.description && policy.description.length > VALIDATION_RULES.description.maxLength) {
    errors.push(`Policy description must not exceed ${VALIDATION_RULES.description.maxLength} characters`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate policy structure (throws on error - for internal use)
 */
export function validatePolicyOrThrow(policy: Policy): void {
  const result = validatePolicy(policy);
  if (!result.valid) {
    throw new PolicyRegistryError(
      `Policy validation failed: ${result.errors.join('; ')}`,
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      { errors: result.errors }
    );
  }
}

// ============================================================================
// VERSION VALIDATION
// ============================================================================

/**
 * Validate Semver version format
 * Returns validation result object instead of throwing
 */
export function validateVersion(version: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!VALIDATION_RULES.version.pattern.test(version)) {
    errors.push(`Invalid version format: ${version}. Expected Semver format (e.g., "1.0.0", "1.1.0", "2.0.0")`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validate Semver version format (throws on error - for internal use)
 */
export function validateVersionOrThrow(version: string): void {
  const result = validateVersion(version);
  if (!result.valid) {
    throw new PolicyRegistryError(
      result.errors[0],
      ERROR_CODES.INVALID_VERSION_FORMAT,
      { 
        version, 
        pattern: VALIDATION_RULES.version.pattern.source,
        examples: VALIDATION_RULES.version.examples 
      }
    );
  }
}

/**
 * Compare two Semver versions
 * Returns: -1 if v1 < v2, 0 if v1 == v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < 3; i++) {
    if (parts1[i] > parts2[i]) return 1;
    if (parts1[i] < parts2[i]) return -1;
  }

  return 0;
}

/**
 * Check if version v1 is newer than v2
 */
export function isNewerVersion(v1: string, v2: string): boolean {
  return compareVersions(v1, v2) > 0;
}

// ============================================================================
// EMAIL VALIDATION
// ============================================================================

/**
 * Validate email format
 * Returns true if valid, false if invalid
 */
export function validateEmail(email: string): boolean {
  // Empty string should return false (email is invalid if provided but empty)
  if (!email || email.trim().length === 0) return false;

  if (!VALIDATION_RULES.email.pattern.test(email)) {
    return false;
  }

  if (email.length > VALIDATION_RULES.email.maxLength) {
    return false;
  }

  return true;
}

/**
 * Validate email format (throws on error - for internal use)
 */
export function validateEmailOrThrow(email: string): void {
  if (!email) return; // Email is optional

  if (!VALIDATION_RULES.email.pattern.test(email)) {
    throw new PolicyRegistryError(
      `Invalid email format: ${email}`,
      ERROR_CODES.INVALID_EMAIL_FORMAT,
      { email, pattern: VALIDATION_RULES.email.pattern.source }
    );
  }

  if (email.length > VALIDATION_RULES.email.maxLength) {
    throw new PolicyRegistryError(
      `Email must not exceed ${VALIDATION_RULES.email.maxLength} characters`,
      ERROR_CODES.INVALID_EMAIL_FORMAT,
      { email, maxLength: VALIDATION_RULES.email.maxLength }
    );
  }
}

// ============================================================================
// ISO DATE VALIDATION
// ============================================================================

/**
 * Validate ISO 8601 date/datetime format
 * Returns true if valid, false if invalid
 */
export function validateISODate(dateString: string): boolean {
  if (!dateString) return false;

  const date = new Date(dateString);
  
  // Check if date is valid
  if (isNaN(date.getTime())) {
    return false;
  }

  // Check if date string is in ISO format by parsing and converting back
  // This ensures "2024-13-01" (invalid month) returns false
  const isoString = date.toISOString();
  const dateOnly = dateString.split('T')[0];
  
  // For date-only strings, check if the date part matches
  if (!dateString.includes('T')) {
    return isoString.startsWith(dateOnly);
  }

  // For datetime strings, more lenient check
  return true;
}

// ============================================================================
// STATUS TRANSITION VALIDATION
// ============================================================================

/**
 * Validate status transition
 * Returns true if valid, false if invalid
 */
export function validateStatusTransition(
  currentStatus: PolicyStatus,
  newStatus: PolicyStatus
): boolean {
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];
  return allowedTransitions.includes(newStatus);
}

/**
 * Validate status transition (throws on error - for internal use)
 */
export function validateStatusTransitionOrThrow(
  currentStatus: PolicyStatus,
  newStatus: PolicyStatus
): void {
  const allowedTransitions = VALID_STATUS_TRANSITIONS[currentStatus] || [];

  if (!allowedTransitions.includes(newStatus)) {
    throw new PolicyRegistryError(
      `Invalid status transition: ${currentStatus} → ${newStatus}. Allowed transitions: ${allowedTransitions.join(', ')}`,
      ERROR_CODES.INVALID_STATUS_TRANSITION,
      { currentStatus, newStatus, allowedTransitions }
    );
  }
}

// ============================================================================
// GOVERNANCE VALIDATION
// ============================================================================

/**
 * Validate review date (must be in the future)
 */
export function validateReviewDate(reviewDate: string): void {
  const date = new Date(reviewDate);
  const now = new Date();

  if (isNaN(date.getTime())) {
    throw new PolicyRegistryError(
      `Invalid review date format: ${reviewDate}`,
      ERROR_CODES.GOVERNANCE_VALIDATION_FAILED,
      { reviewDate }
    );
  }

  if (date < now) {
    throw new PolicyRegistryError(
      `Review date must be in the future: ${reviewDate}`,
      ERROR_CODES.REVIEW_DATE_PASSED,
      { reviewDate, now: now.toISOString() }
    );
  }
}

/**
 * Validate expiry date (must be in the future)
 */
export function validateExpiryDate(expiryDate: string): void {
  const date = new Date(expiryDate);
  const now = new Date();

  if (isNaN(date.getTime())) {
    throw new PolicyRegistryError(
      `Invalid expiry date format: ${expiryDate}`,
      ERROR_CODES.GOVERNANCE_VALIDATION_FAILED,
      { expiryDate }
    );
  }

  if (date < now) {
    throw new PolicyRegistryError(
      `Policy has expired: ${expiryDate}`,
      ERROR_CODES.POLICY_EXPIRED,
      { expiryDate, now: now.toISOString() }
    );
  }
}

/**
 * Check if expiry date is within warning period (default: 30 days)
 */
export function isExpiryDateWarning(expiryDate: string, warningDays: number = 30): boolean {
  const date = new Date(expiryDate);
  const now = new Date();
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + warningDays);

  return date >= now && date <= warningDate;
}

/**
 * Check if review date has passed
 */
export function isReviewDatePassed(reviewDate: string): boolean {
  const date = new Date(reviewDate);
  const now = new Date();

  return date < now;
}

// ============================================================================
// REASON VALIDATION
// ============================================================================

/**
 * Validate reason for status change
 */
export function validateReason(reason: string | undefined, required: boolean = false): void {
  if (required && !reason) {
    throw new PolicyRegistryError(
      'Reason is required for this operation',
      ERROR_CODES.MISSING_REQUIRED_FIELD,
      { field: 'reason' }
    );
  }

  if (reason) {
    if (reason.length < VALIDATION_RULES.reason.minLength) {
      throw new PolicyRegistryError(
        `Reason must be at least ${VALIDATION_RULES.reason.minLength} characters`,
        ERROR_CODES.GOVERNANCE_VALIDATION_FAILED,
        { reason, minLength: VALIDATION_RULES.reason.minLength }
      );
    }

    if (reason.length > VALIDATION_RULES.reason.maxLength) {
      throw new PolicyRegistryError(
        `Reason must not exceed ${VALIDATION_RULES.reason.maxLength} characters`,
        ERROR_CODES.GOVERNANCE_VALIDATION_FAILED,
        { reason, maxLength: VALIDATION_RULES.reason.maxLength }
      );
    }
  }
}

// ============================================================================
// COMPREHENSIVE VALIDATION
// ============================================================================

/**
 * Validate all governance fields
 */
export function validateGovernance(governance: {
  businessOwnerEmail?: string;
  technicalOwnerEmail?: string;
  reviewDate?: string;
  expireDate?: string;
}): string[] {
  const warnings: string[] = [];

  // Validate emails
  try {
    if (governance.businessOwnerEmail) {
      validateEmailOrThrow(governance.businessOwnerEmail);
    }
  } catch (error) {
    warnings.push(`Business owner email: ${error.message}`);
  }

  try {
    if (governance.technicalOwnerEmail) {
      validateEmailOrThrow(governance.technicalOwnerEmail);
    }
  } catch (error) {
    warnings.push(`Technical owner email: ${error.message}`);
  }

  // Check review date
  if (governance.reviewDate && isReviewDatePassed(governance.reviewDate)) {
    warnings.push(`Review date has passed: ${governance.reviewDate}`);
  }

  // Check expiry date
  if (governance.expireDate) {
    try {
      validateExpiryDate(governance.expireDate);
      
      // Check if expiring soon
      if (isExpiryDateWarning(governance.expireDate)) {
        warnings.push(`Policy expires soon: ${governance.expireDate}`);
      }
    } catch (error) {
      warnings.push(`Expiry date: ${error.message}`);
    }
  }

  return warnings;
}
