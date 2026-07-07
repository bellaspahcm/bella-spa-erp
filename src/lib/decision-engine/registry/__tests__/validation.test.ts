/**
 * Validation Utilities Unit Tests
 * 
 * Tests for all validation functions used by PolicyRegistry.
 */

import {
  validatePolicy,
  validateVersion,
  validateEmail,
  validateISODate,
  validateStatusTransition,
} from '../validation';

describe('Validation Utilities', () => {
  // ========================================
  // Policy Validation
  // ========================================

  describe('validatePolicy()', () => {
    it('should accept valid policy', () => {
      const policy = {
        id: 'test-policy',
        version: '1.0.0',
        name: 'Test Policy',
        description: 'Test description',
        rules: [],
      };

      const result = validatePolicy(policy);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject policy with short ID', () => {
      const policy = {
        id: 'ab', // Too short (min 3 chars)
        version: '1.0.0',
        name: 'Test',
        rules: [],
      };

      const result = validatePolicy(policy);

      expect(result.valid).toBe(false);
      expect(result.errors.some(err => /policy.*id.*3.*100/i.test(err))).toBe(true);
    });

    it('should reject policy with long ID', () => {
      const policy = {
        id: 'a'.repeat(101), // Too long (max 100 chars)
        version: '1.0.0',
        name: 'Test',
        rules: [],
      };

      const result = validatePolicy(policy);

      expect(result.valid).toBe(false);
      // Check error message contains both min (3) and max (100), in any order
      const hasError = result.errors.some(err => 
        /policy\s*id/i.test(err) && /100/.test(err) && /3/.test(err)
      );
      expect(hasError).toBe(true);
    });

    it('should reject policy with invalid ID characters', () => {
      const policy = {
        id: 'test policy!@#', // Invalid characters
        version: '1.0.0',
        name: 'Test',
        rules: [],
      };

      const result = validatePolicy(policy);

      expect(result.valid).toBe(false);
      expect(result.errors.some(err => /alphanumeric/i.test(err))).toBe(true);
    });

    it('should accept policy ID with hyphens and underscores', () => {
      const policy = {
        id: 'test-policy_v1',
        version: '1.0.0',
        name: 'Test',
        rules: [],
      };

      const result = validatePolicy(policy);

      expect(result.valid).toBe(true);
    });

    it('should reject policy with short name', () => {
      const policy = {
        id: 'test-policy',
        version: '1.0.0',
        name: 'AB', // Too short (min 3 chars)
        rules: [],
      };

      const result = validatePolicy(policy);

      expect(result.valid).toBe(false);
      expect(result.errors.some(err => /name.*3.*200/i.test(err))).toBe(true);
    });

    it('should reject policy with long name', () => {
      const policy = {
        id: 'test-policy',
        version: '1.0.0',
        name: 'A'.repeat(201), // Too long (max 200 chars)
        rules: [],
      };

      const result = validatePolicy(policy);

      expect(result.valid).toBe(false);
      // Check error message contains both min (3) and max (200), in any order
      const hasError = result.errors.some(err => 
        /name/i.test(err) && /200/.test(err) && /3/.test(err)
      );
      expect(hasError).toBe(true);
    });

    it('should reject policy with long description', () => {
      const policy = {
        id: 'test-policy',
        version: '1.0.0',
        name: 'Test Policy',
        description: 'A'.repeat(1001), // Too long (max 1000 chars)
        rules: [],
      };

      const result = validatePolicy(policy);

      expect(result.valid).toBe(false);
      expect(result.errors.some(err => /description.*1000/i.test(err))).toBe(true);
    });

    it('should accept policy without rules array', () => {
      const policy = {
        id: 'test-policy',
        version: '1.0.0',
        name: 'Test Policy',
      };

      const result = validatePolicy(policy);

      expect(result.valid).toBe(true);
    });
  });

  // ========================================
  // Version Validation
  // ========================================

  describe('validateVersion()', () => {
    it('should accept valid semver versions', () => {
      const validVersions = ['1.0.0', '2.1.3', '10.20.30', '0.0.1'];

      validVersions.forEach((version) => {
        const result = validateVersion(version);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid semver versions', () => {
      const invalidVersions = ['1.0', 'v1.0.0', '1', 'abc', '1.0.0.0'];

      invalidVersions.forEach((version) => {
        const result = validateVersion(version);
        expect(result.valid).toBe(false);
        expect(result.errors.some(err => /semver/i.test(err))).toBe(true);
      });
    });

    it('should reject empty version', () => {
      const result = validateVersion('');

      expect(result.valid).toBe(false);
    });
  });

  // ========================================
  // Email Validation
  // ========================================

  describe('validateEmail()', () => {
    it('should accept valid email addresses', () => {
      const validEmails = [
        'user@example.com',
        'john.doe@company.co.uk',
        'admin+test@domain.org',
        'user_123@sub.domain.com',
      ];

      validEmails.forEach((email) => {
        expect(validateEmail(email)).toBe(true);
      });
    });

    it('should reject invalid email addresses', () => {
      const invalidEmails = [
        'notanemail',
        '@example.com',
        'user@',
        'user @example.com',
        'user@example',
        '',
      ];

      invalidEmails.forEach((email) => {
        expect(validateEmail(email)).toBe(false);
      });
    });
  });

  // ========================================
  // ISO Date Validation
  // ========================================

  describe('validateISODate()', () => {
    it('should accept valid ISO date strings', () => {
      const validDates = [
        '2026-01-01',
        '2026-12-31',
        '2026-06-15',
      ];

      validDates.forEach((date) => {
        expect(validateISODate(date)).toBe(true);
      });
    });

    it('should accept valid ISO datetime strings', () => {
      const validDates = [
        '2026-01-01T00:00:00Z',
        '2026-06-22T10:30:45.123Z',
        '2026-12-31T23:59:59Z',
      ];

      validDates.forEach((date) => {
        expect(validateISODate(date)).toBe(true);
      });
    });

    it('should reject invalid date strings', () => {
      const invalidDates = [
        '01/01/2026', // Wrong format
        '2026-13-01', // Invalid month
        '2026-01-32', // Invalid day
        'not-a-date',
        '',
      ];

      invalidDates.forEach((date) => {
        expect(validateISODate(date)).toBe(false);
      });
    });
  });

  // ========================================
  // Status Transition Validation
  // ========================================

  describe('validateStatusTransition()', () => {
    it('should allow draft → active', () => {
      expect(validateStatusTransition('draft', 'active')).toBe(true);
    });

    it('should allow active → deprecated', () => {
      expect(validateStatusTransition('active', 'deprecated')).toBe(true);
    });

    it('should allow active → archived', () => {
      expect(validateStatusTransition('active', 'archived')).toBe(true);
    });

    it('should allow deprecated → active', () => {
      expect(validateStatusTransition('deprecated', 'active')).toBe(true);
    });

    it('should allow deprecated → archived', () => {
      expect(validateStatusTransition('deprecated', 'archived')).toBe(true);
    });

    it('should reject draft → deprecated', () => {
      expect(validateStatusTransition('draft', 'deprecated')).toBe(false);
    });

    it('should reject draft → archived', () => {
      expect(validateStatusTransition('draft', 'archived')).toBe(false);
    });

    it('should reject archived → any status', () => {
      expect(validateStatusTransition('archived', 'active')).toBe(false);
      expect(validateStatusTransition('archived', 'deprecated')).toBe(false);
      expect(validateStatusTransition('archived', 'draft')).toBe(false);
    });

    it('should reject same status transition', () => {
      expect(validateStatusTransition('active', 'active')).toBe(false);
      expect(validateStatusTransition('draft', 'draft')).toBe(false);
    });

    it('should handle invalid status values', () => {
      expect(validateStatusTransition('invalid' as any, 'active')).toBe(false);
      expect(validateStatusTransition('active', 'invalid' as any)).toBe(false);
    });
  });
});
