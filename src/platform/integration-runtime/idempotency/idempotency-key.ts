/**
 * Idempotency Key Derivation
 * 
 * Tenant-scoped idempotency key generation
 * 
 * Formula: HASH(tenantId + correlationId + intentType)
 * 
 * CRITICAL DESIGN:
 * - Tenant-scoped (Tenant A cannot replay Tenant B's intents)
 * - Deterministic (same input → same key)
 * - Collision-resistant (SHA-256)
 * 
 * Version: 1.0.0
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 * Architecture Decision: Runtime Architecture Gate v2, Gap 1 fix
 */

import crypto from 'crypto';
import { IdempotencyKeyComponents } from '../types/runtime-config.types';
import { ValidationError, buildErrorContext } from '../types/runtime-errors.types';

/**
 * Derive Idempotency Key
 * 
 * Generate tenant-scoped idempotency key
 * 
 * Formula: SHA-256(v1:tenantId:correlationId:intentType)
 * 
 * Canonical serialization (collision-resistant):
 * - Version prefix: "v1:" (future compatibility)
 * - Delimiter: ":" (length-prefixed alternative considered, colon simpler)
 * - Components validated: no ":" characters allowed
 * - Prevents collision: "A:BC" ≠ "AB:C" (delimiter enforced)
 * 
 * @param components - Key components (tenant, correlation, intent type)
 * @param algorithm - Hash algorithm (default: sha256)
 * @returns Idempotency key (hex string)
 * 
 * @throws ValidationError if components invalid or contain delimiter
 */
export function deriveIdempotencyKey(
  components: IdempotencyKeyComponents,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): string {
  // Validate components
  validateKeyComponents(components);
  
  // Validate no delimiter in components (prevent injection/collision)
  const delimiter = ':';
  if (components.tenantId.includes(delimiter)) {
    throw new ValidationError(
      `Idempotency key derivation failed: tenantId cannot contain delimiter '${delimiter}'`,
      buildErrorContext(undefined, undefined, { components })
    );
  }
  if (components.correlationId.includes(delimiter)) {
    throw new ValidationError(
      `Idempotency key derivation failed: correlationId cannot contain delimiter '${delimiter}'`,
      buildErrorContext(undefined, undefined, { components })
    );
  }
  if (components.intentType.includes(delimiter)) {
    throw new ValidationError(
      `Idempotency key derivation failed: intentType cannot contain delimiter '${delimiter}'`,
      buildErrorContext(undefined, undefined, { components })
    );
  }
  
  // Canonical serialization (version + components + delimiter)
  const input = `v1:${components.tenantId}:${components.correlationId}:${components.intentType}`;
  
  // Hash
  const hash = crypto.createHash(algorithm);
  hash.update(input, 'utf8');
  
  return hash.digest('hex');
}

/**
 * Validate Key Components
 * 
 * Ensure all required components present
 * 
 * @throws ValidationError if components invalid
 */
function validateKeyComponents(components: IdempotencyKeyComponents): void {
  if (!components.tenantId || components.tenantId.trim().length === 0) {
    throw new ValidationError(
      'Idempotency key derivation failed: tenantId is required',
      buildErrorContext(undefined, undefined, { components })
    );
  }
  
  if (!components.correlationId || components.correlationId.trim().length === 0) {
    throw new ValidationError(
      'Idempotency key derivation failed: correlationId is required',
      buildErrorContext(undefined, undefined, { components })
    );
  }
  
  if (!components.intentType || components.intentType.trim().length === 0) {
    throw new ValidationError(
      'Idempotency key derivation failed: intentType is required',
      buildErrorContext(undefined, undefined, { components })
    );
  }
}

/**
 * Parse Idempotency Key Components
 * 
 * Extract tenant ID from idempotency key (for validation)
 * 
 * NOTE: This is NOT reversing the hash (impossible)
 * This is for metadata tracking (components stored separately)
 */
export interface IdempotencyKeyMetadata {
  key: string;
  tenantId: string;
  correlationId: string;
  intentType: string;
  algorithm: string;
  derivedAt: Date;
}

/**
 * Create Idempotency Key with Metadata
 * 
 * Derive key and return with metadata for storage
 */
export function createIdempotencyKey(
  components: IdempotencyKeyComponents,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): IdempotencyKeyMetadata {
  const key = deriveIdempotencyKey(components, algorithm);
  
  return {
    key,
    tenantId: components.tenantId,
    correlationId: components.correlationId,
    intentType: components.intentType,
    algorithm,
    derivedAt: new Date(),
  };
}

/**
 * Verify Idempotency Key
 * 
 * Verify key was derived from given components
 * (For debugging/auditing)
 */
export function verifyIdempotencyKey(
  key: string,
  components: IdempotencyKeyComponents,
  algorithm: 'sha256' | 'sha512' = 'sha256'
): boolean {
  const expectedKey = deriveIdempotencyKey(components, algorithm);
  return key === expectedKey;
}
