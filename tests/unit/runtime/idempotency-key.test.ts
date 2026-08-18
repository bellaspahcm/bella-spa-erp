/**
 * Idempotency Key Unit Tests
 * 
 * Tests for idempotency key derivation (Phase 3A)
 * 
 * Focus:
 * - Canonical serialization (collision prevention)
 * - Tenant-scoped key derivation
 * - Deterministic hashing
 * - Delimiter validation
 * - Version prefix
 * 
 * Test Plan: BELLA_RUNTIME_PHASE_3_TEST_PLAN.md v1.1
 * Gate: P3-4 (Idempotency - key derivation)
 */

import { describe, it, expect } from 'vitest';
import {
  deriveIdempotencyKey,
  createIdempotencyKey,
  verifyIdempotencyKey,
} from '../../../src/platform/integration-runtime/idempotency/idempotency-key';
import { ValidationError } from '../../../src/platform/integration-runtime/types/runtime-errors.types';

describe('Idempotency Key Derivation', () => {
  // ==========================================================================
  // Canonical Serialization (Collision Prevention)
  // ==========================================================================
  
  describe('Canonical Serialization', () => {
    it('should generate consistent key for same inputs', () => {
      const key1 = deriveIdempotencyKey({
        tenantId: 'tenant-a',
        correlationId: 'corr-001',
        intentType: 'REVENUE_RECOGNIZED',
      });
      
      const key2 = deriveIdempotencyKey({
        tenantId: 'tenant-a',
        correlationId: 'corr-001',
        intentType: 'REVENUE_RECOGNIZED',
      });
      
      expect(key1).toBe(key2);
    });
    
    it('should prevent collision (A:BC vs AB:C)', () => {
      // This tests the Amendment 1 fix: canonical serialization with delimiter validation
      
      const key1 = deriveIdempotencyKey({
        tenantId: 'A',
        correlationId: 'BC',
        intentType: 'TYPE',
      });
      
      const key2 = deriveIdempotencyKey({
        tenantId: 'AB',
        correlationId: 'C',
        intentType: 'TYPE',
      });
      
      // Keys MUST be different (collision prevented)
      expect(key1).not.toBe(key2);
    });
    
    it('should reject tenantId with delimiter', () => {
      expect(() => {
        deriveIdempotencyKey({
          tenantId: 'tenant:with:colons',  // ❌ Contains delimiter
          correlationId: 'corr-001',
          intentType: 'REVENUE_RECOGNIZED',
        });
      }).toThrow(ValidationError);
    });
    
    it('should reject correlationId with delimiter', () => {
      expect(() => {
        deriveIdempotencyKey({
          tenantId: 'tenant-a',
          correlationId: 'corr:with:colons',  // ❌ Contains delimiter
          intentType: 'REVENUE_RECOGNIZED',
        });
      }).toThrow(ValidationError);
    });
    
    it('should reject intentType with delimiter', () => {
      expect(() => {
        deriveIdempotencyKey({
          tenantId: 'tenant-a',
          correlationId: 'corr-001',
          intentType: 'TYPE:WITH:COLONS',  // ❌ Contains delimiter
        });
      }).toThrow(ValidationError);
    });
    
    it('should generate different keys for different inputs', () => {
      const key1 = deriveIdempotencyKey({
        tenantId: 'tenant-a',
        correlationId: 'corr-001',
        intentType: 'REVENUE_RECOGNIZED',
      });
      
      const key2 = deriveIdempotencyKey({
        tenantId: 'tenant-a',
        correlationId: 'corr-002',  // Different
        intentType: 'REVENUE_RECOGNIZED',
      });
      
      expect(key1).not.toBe(key2);
    });
  });
  
  // ==========================================================================
  // Tenant-Scoped Key Derivation (T3.3)
  // ==========================================================================
  
  describe('Tenant-Scoped Key Derivation', () => {
    it('should generate different keys for different tenants (same correlation)', () => {
      const keyA = deriveIdempotencyKey({
        tenantId: 'tenant-a',
        correlationId: 'shared-corr-001',
        intentType: 'REVENUE_RECOGNIZED',
      });
      
      const keyB = deriveIdempotencyKey({
        tenantId: 'tenant-b',
        correlationId: 'shared-corr-001',  // Same correlation
        intentType: 'REVENUE_RECOGNIZED',
      });
      
      // CRITICAL: Keys MUST be different (tenant-scoped)
      expect(keyA).not.toBe(keyB);
    });
    
    it('should generate different keys for different intentTypes (same tenant + correlation)', () => {
      const key1 = deriveIdempotencyKey({
        tenantId: 'tenant-a',
        correlationId: 'corr-001',
        intentType: 'REVENUE_RECOGNIZED',
      });
      
      const key2 = deriveIdempotencyKey({
        tenantId: 'tenant-a',
        correlationId: 'corr-001',
        intentType: 'PAYMENT_RECEIVED',  // Different intent type
      });
      
      expect(key1).not.toBe(key2);
    });
    
    it('should generate same key for same tenant + correlation + intentType', () => {
      const components = {
        tenantId: 'tenant-a',
        correlationId: 'corr-001',
        intentType: 'REVENUE_RECOGNIZED',
      };
      
      const key1 = deriveIdempotencyKey(components);
      const key2 = deriveIdempotencyKey(components);
      
      expect(key1).toBe(key2);
    });
  });
  
  // ==========================================================================
  // Deterministic Hashing
  // ==========================================================================
  
  describe('Deterministic Hashing', () => {
    it('should use SHA-256 by default', () => {
      const key = deriveIdempotencyKey({
        tenantId: 'tenant-a',
        correlationId: 'corr-001',
        intentType: 'REVENUE_RECOGNIZED',
      });
      
      // SHA-256 produces 64-character hex string
      expect(key.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
    });
    
    it('should support SHA-512 algorithm', () => {
      const key = deriveIdempotencyKey(
        {
          tenantId: 'tenant-a',
          correlationId: 'corr-001',
          intentType: 'REVENUE_RECOGNIZED',
        },
        'sha512'
      );
      
      // SHA-512 produces 128-character hex string
      expect(key.length).toBe(128);
      expect(/^[0-9a-f]{128}$/.test(key)).toBe(true);
    });
    
    it('should generate different keys for different algorithms', () => {
      const components = {
        tenantId: 'tenant-a',
        correlationId: 'corr-001',
        intentType: 'REVENUE_RECOGNIZED',
      };
      
      const key256 = deriveIdempotencyKey(components, 'sha256');
      const key512 = deriveIdempotencyKey(components, 'sha512');
      
      expect(key256).not.toBe(key512);
    });
  });
  
  // ==========================================================================
  // Component Validation
  // ==========================================================================
  
  describe('Component Validation', () => {
    it('should reject empty tenantId', () => {
      expect(() => {
        deriveIdempotencyKey({
          tenantId: '',
          correlationId: 'corr-001',
          intentType: 'REVENUE_RECOGNIZED',
        });
      }).toThrow(ValidationError);
    });
    
    it('should reject whitespace tenantId', () => {
      expect(() => {
        deriveIdempotencyKey({
          tenantId: '   ',
          correlationId: 'corr-001',
          intentType: 'REVENUE_RECOGNIZED',
        });
      }).toThrow(ValidationError);
    });
    
    it('should reject empty correlationId', () => {
      expect(() => {
        deriveIdempotencyKey({
          tenantId: 'tenant-a',
          correlationId: '',
          intentType: 'REVENUE_RECOGNIZED',
        });
      }).toThrow(ValidationError);
    });
    
    it('should reject empty intentType', () => {
      expect(() => {
        deriveIdempotencyKey({
          tenantId: 'tenant-a',
          correlationId: 'corr-001',
          intentType: '',
        });
      }).toThrow(ValidationError);
    });
  });
  
  // ==========================================================================
  // Idempotency Key Metadata
  // ==========================================================================
  
  describe('Idempotency Key Metadata', () => {
    it('should create key with metadata', () => {
      const metadata = createIdempotencyKey({
        tenantId: 'tenant-a',
        correlationId: 'corr-001',
        intentType: 'REVENUE_RECOGNIZED',
      });
      
      expect(metadata.key).toBeDefined();
      expect(metadata.key.length).toBe(64);
      expect(metadata.tenantId).toBe('tenant-a');
      expect(metadata.correlationId).toBe('corr-001');
      expect(metadata.intentType).toBe('REVENUE_RECOGNIZED');
      expect(metadata.algorithm).toBe('sha256');
      expect(metadata.derivedAt).toBeInstanceOf(Date);
    });
    
    it('should create key with SHA-512', () => {
      const metadata = createIdempotencyKey(
        {
          tenantId: 'tenant-a',
          correlationId: 'corr-001',
          intentType: 'REVENUE_RECOGNIZED',
        },
        'sha512'
      );
      
      expect(metadata.key.length).toBe(128);
      expect(metadata.algorithm).toBe('sha512');
    });
  });
  
  // ==========================================================================
  // Key Verification
  // ==========================================================================
  
  describe('Key Verification', () => {
    it('should verify correct key', () => {
      const components = {
        tenantId: 'tenant-a',
        correlationId: 'corr-001',
        intentType: 'REVENUE_RECOGNIZED',
      };
      
      const key = deriveIdempotencyKey(components);
      const isValid = verifyIdempotencyKey(key, components);
      
      expect(isValid).toBe(true);
    });
    
    it('should reject incorrect key', () => {
      const components = {
        tenantId: 'tenant-a',
        correlationId: 'corr-001',
        intentType: 'REVENUE_RECOGNIZED',
      };
      
      const wrongKey = 'abc123';
      const isValid = verifyIdempotencyKey(wrongKey, components);
      
      expect(isValid).toBe(false);
    });
    
    it('should reject key derived with different components', () => {
      const components1 = {
        tenantId: 'tenant-a',
        correlationId: 'corr-001',
        intentType: 'REVENUE_RECOGNIZED',
      };
      
      const components2 = {
        tenantId: 'tenant-b',  // Different
        correlationId: 'corr-001',
        intentType: 'REVENUE_RECOGNIZED',
      };
      
      const key = deriveIdempotencyKey(components1);
      const isValid = verifyIdempotencyKey(key, components2);
      
      expect(isValid).toBe(false);
    });
  });
  
  // ==========================================================================
  // Edge Cases
  // ==========================================================================
  
  describe('Edge Cases', () => {
    it('should handle special characters (except delimiter)', () => {
      const key = deriveIdempotencyKey({
        tenantId: 'tenant-with-dashes-123',
        correlationId: 'corr_with_underscores_456',
        intentType: 'TYPE.WITH.DOTS',
      });
      
      expect(key).toBeDefined();
      expect(key.length).toBe(64);
    });
    
    it('should handle long component values', () => {
      const key = deriveIdempotencyKey({
        tenantId: 'a'.repeat(100),
        correlationId: 'b'.repeat(100),
        intentType: 'c'.repeat(100),
      });
      
      expect(key).toBeDefined();
      expect(key.length).toBe(64);
    });
    
    it('should handle Unicode characters (except delimiter)', () => {
      const key = deriveIdempotencyKey({
        tenantId: 'tenant-中文',
        correlationId: 'corr-日本語',
        intentType: 'TYPE-한글',
      });
      
      expect(key).toBeDefined();
      expect(key.length).toBe(64);
    });
  });
});
