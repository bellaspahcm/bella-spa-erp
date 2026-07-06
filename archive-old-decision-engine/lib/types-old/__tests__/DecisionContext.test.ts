/**
 * Unit Tests - DecisionContext
 * 
 * Tests for DecisionContext type, factory functions, and utilities.
 */

import {
  createDecisionContext,
  sanitizeDecisionContext,
  validateDecisionContext,
  type DecisionContext,
} from '../DecisionContext';

describe('DecisionContext', () => {
  describe('createDecisionContext', () => {
    it('should create valid context with required fields', () => {
      const context = createDecisionContext({
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 5000000 },
      });

      expect(context.tenantId).toBe('test-tenant');
      expect(context.module).toBe('booking');
      expect(context.decisionType).toBe('auto-approval');
      expect(context.ruleType).toBe('if-then');
      expect(context.data).toEqual({ amount: 5000000 });
    });

    it('should generate correlationId if not provided', () => {
      const context = createDecisionContext({
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {},
        data: {},
      });

      expect(context.correlationId).toBeDefined();
      expect(context.correlationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should use provided correlationId', () => {
      const correlationId = 'custom-correlation-id';
      const context = createDecisionContext({
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {},
        data: {},
        correlationId,
      });

      expect(context.correlationId).toBe(correlationId);
    });

    it('should set timestamp if not provided', () => {
      const before = new Date();
      const context = createDecisionContext({
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {},
        data: {},
      });
      const after = new Date();

      expect(context.timestamp).toBeDefined();
      expect(context.timestamp!.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(context.timestamp!.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should use provided timestamp', () => {
      const timestamp = new Date('2026-01-01');
      const context = createDecisionContext({
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {},
        data: {},
        timestamp,
      });

      expect(context.timestamp).toBe(timestamp);
    });

    it('should apply default options', () => {
      const context = createDecisionContext({
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {},
        data: {},
      });

      expect(context.options).toEqual({
        cache: true,
        cacheTTL: 300,
        timeout: 5000,
        fallback: 'default',
        dryRun: false,
      });
    });

    it('should merge provided options with defaults', () => {
      const context = createDecisionContext({
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {},
        data: {},
        options: {
          cache: false,
          timeout: 10000,
        },
      });

      expect(context.options).toEqual({
        cache: false,
        cacheTTL: 300,
        timeout: 10000,
        fallback: 'default',
        dryRun: false,
      });
    });

    it('should include optional user information', () => {
      const user = {
        id: 'user-123',
        role: 'admin',
        email: 'admin@example.com',
      };

      const context = createDecisionContext({
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {},
        data: {},
        user,
      });

      expect(context.user).toEqual(user);
    });

    it('should include metadata', () => {
      const metadata = {
        customerId: 'cust-456',
        bookingId: 'book-789',
      };

      const context = createDecisionContext({
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {},
        data: {},
        metadata,
      });

      expect(context.metadata).toEqual(metadata);
    });
  });

  describe('validateDecisionContext', () => {
    const validContext: DecisionContext = {
      tenantId: 'test-tenant',
      module: 'booking',
      decisionType: 'auto-approval',
      ruleType: 'if-then',
      rule: {},
      data: {},
    };

    it('should not throw for valid context', () => {
      expect(() => validateDecisionContext(validContext)).not.toThrow();
    });

    it('should throw if tenantId is missing', () => {
      const context = { ...validContext, tenantId: '' };
      expect(() => validateDecisionContext(context)).toThrow('tenantId is required');
    });

    it('should throw if module is missing', () => {
      const context = { ...validContext, module: '' };
      expect(() => validateDecisionContext(context)).toThrow('module is required');
    });

    it('should throw if decisionType is missing', () => {
      const context = { ...validContext, decisionType: '' };
      expect(() => validateDecisionContext(context)).toThrow('decisionType is required');
    });

    it('should throw if ruleType is missing', () => {
      const context = { ...validContext, ruleType: '' };
      expect(() => validateDecisionContext(context)).toThrow('ruleType is required');
    });

    it('should throw if rule is missing', () => {
      const context = { ...validContext, rule: null as any };
      expect(() => validateDecisionContext(context)).toThrow('rule is required');
    });

    it('should throw if data is missing', () => {
      const context = { ...validContext, data: null as any };
      expect(() => validateDecisionContext(context)).toThrow('data is required');
    });

    it('should throw with multiple errors', () => {
      const context = {
        ...validContext,
        tenantId: '',
        module: '',
        decisionType: '',
      };

      expect(() => validateDecisionContext(context)).toThrow(
        'Invalid DecisionContext: tenantId is required, module is required, decisionType is required'
      );
    });
  });

  describe('sanitizeDecisionContext', () => {
    it('should sanitize sensitive data fields', () => {
      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {},
        data: {
          amount: 5000000,
          password: 'secret123',
          apiKey: 'key-abc-123',
          creditCard: '1234-5678-9012-3456',
        },
      };

      const sanitized = sanitizeDecisionContext(context);

      expect(sanitized.data).toEqual({
        amount: 5000000,
        password: '***REDACTED***',
        apiKey: '***REDACTED***',
        creditCard: '***REDACTED***',
      });
    });

    it('should redact user email', () => {
      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {},
        data: {},
        user: {
          id: 'user-123',
          role: 'admin',
          email: 'admin@example.com',
        },
      };

      const sanitized = sanitizeDecisionContext(context);

      expect(sanitized.user).toEqual({
        id: 'user-123',
        role: 'admin',
        email: '***@***',
      });
    });

    it('should preserve non-sensitive fields', () => {
      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {},
        data: {
          amount: 5000000,
          customerTier: 'vip',
        },
      };

      const sanitized = sanitizeDecisionContext(context);

      expect(sanitized.data).toEqual({
        amount: 5000000,
        customerTier: 'vip',
      });
    });

    it('should handle context without user', () => {
      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {},
        data: {},
      };

      const sanitized = sanitizeDecisionContext(context);

      expect(sanitized.user).toBeUndefined();
    });

    it('should handle empty data object', () => {
      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule: {},
        data: {},
      };

      const sanitized = sanitizeDecisionContext(context);

      expect(sanitized.data).toEqual({});
    });
  });
});
