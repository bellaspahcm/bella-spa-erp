/**
 * Unit Tests - DecisionResult
 * 
 * Tests for DecisionResult type, factory functions, and utilities.
 */

import {
  createErrorResult,
  createFallbackResult,
  createSuccessResult,
  interpretResult,
  sanitizeDecisionResult,
  validateDecisionResult,
  type DecisionResult,
} from '../DecisionResult';

describe('DecisionResult', () => {
  describe('createSuccessResult', () => {
    it('should create approved result', () => {
      const result = createSuccessResult(true, 1.0, {
        reason: 'Test reason',
        provider: 'TestProvider',
        executionTime: 50,
      });

      expect(result.approved).toBe(true);
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toBe('Test reason');
      expect(result.provider).toBe('TestProvider');
      expect(result.executionTime).toBe(50);
      expect(result.isFallback).toBe(false);
      expect(result.timestamp).toBeInstanceOf(Date);
    });

    it('should create rejected result', () => {
      const result = createSuccessResult(false, 0.8, {
        reason: 'Rule not matched',
        provider: 'RuleProvider',
        executionTime: 30,
      });

      expect(result.approved).toBe(false);
      expect(result.confidence).toBe(0.8);
      expect(result.reason).toBe('Rule not matched');
    });

    it('should clamp confidence to [0, 1] range', () => {
      const resultTooLow = createSuccessResult(true, -0.5, {
        provider: 'TestProvider',
        executionTime: 50,
      });
      expect(resultTooLow.confidence).toBe(0);

      const resultTooHigh = createSuccessResult(true, 1.5, {
        provider: 'TestProvider',
        executionTime: 50,
      });
      expect(resultTooHigh.confidence).toBe(1);
    });

    it('should include matched rules', () => {
      const result = createSuccessResult(true, 1.0, {
        matchedRules: ['rule-1', 'rule-2'],
        provider: 'RuleProvider',
        executionTime: 50,
      });

      expect(result.matchedRules).toEqual(['rule-1', 'rule-2']);
    });

    it('should include recommendations', () => {
      const result = createSuccessResult(true, 0.9, {
        recommendations: ['Apply discount', 'Send confirmation'],
        provider: 'RuleProvider',
        executionTime: 50,
      });

      expect(result.recommendations).toEqual(['Apply discount', 'Send confirmation']);
    });

    it('should include action', () => {
      const result = createSuccessResult(true, 1.0, {
        action: {
          type: 'approve-with-conditions',
          data: { discount: 0.05 },
        },
        provider: 'RuleProvider',
        executionTime: 50,
      });

      expect(result.action).toEqual({
        type: 'approve-with-conditions',
        data: { discount: 0.05 },
      });
    });

    it('should include metadata', () => {
      const result = createSuccessResult(true, 1.0, {
        metadata: {
          ruleId: 'rule-123',
          evaluatedConditions: 5,
        },
        provider: 'RuleProvider',
        executionTime: 50,
      });

      expect(result.metadata).toEqual({
        ruleId: 'rule-123',
        evaluatedConditions: 5,
      });
    });
  });

  describe('createFallbackResult', () => {
    it('should create fallback result from error', () => {
      const error = new Error('Provider timeout');
      const result = createFallbackResult(error, 'RuleProvider', 5000);

      expect(result.approved).toBe(false);
      expect(result.confidence).toBe(0.0);
      expect(result.reason).toContain('Decision evaluation failed');
      expect(result.reason).toContain('Provider timeout');
      expect(result.isFallback).toBe(true);
      expect(result.provider).toBe('RuleProvider');
      expect(result.executionTime).toBe(5000);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Provider timeout');
      expect(result.error?.code).toBe('Error');
    });

    it('should include error stack', () => {
      const error = new Error('Test error');
      const result = createFallbackResult(error, 'TestProvider', 100);

      expect(result.error?.stack).toBeDefined();
      expect(result.error?.stack).toContain('Test error');
    });
  });

  describe('createErrorResult', () => {
    it('should create error result with code and message', () => {
      const result = createErrorResult(
        'PROVIDER_NOT_FOUND',
        'No provider found for rule type: ml-model',
        'error-handler'
      );

      expect(result.approved).toBe(false);
      expect(result.confidence).toBe(0.0);
      expect(result.reason).toBe('No provider found for rule type: ml-model');
      expect(result.isFallback).toBe(true);
      expect(result.provider).toBe('error-handler');
      expect(result.executionTime).toBe(0);
      expect(result.error?.code).toBe('PROVIDER_NOT_FOUND');
      expect(result.error?.message).toBe('No provider found for rule type: ml-model');
    });

    it('should use default provider if not specified', () => {
      const result = createErrorResult('VALIDATION_ERROR', 'Invalid context');

      expect(result.provider).toBe('error-handler');
    });
  });

  describe('interpretResult', () => {
    it('should interpret fallback result', () => {
      const result = createFallbackResult(new Error('Test'), 'TestProvider', 100);
      expect(interpretResult(result)).toBe('Manual review required due to system error');
    });

    it('should interpret high confidence approval', () => {
      const result = createSuccessResult(true, 0.95, {
        provider: 'RuleProvider',
        executionTime: 50,
      });
      expect(interpretResult(result)).toBe('Auto-approve with high confidence');
    });

    it('should interpret medium confidence approval', () => {
      const result = createSuccessResult(true, 0.8, {
        provider: 'RuleProvider',
        executionTime: 50,
      });
      expect(interpretResult(result)).toBe('Approve but monitor closely');
    });

    it('should interpret low confidence approval', () => {
      const result = createSuccessResult(true, 0.6, {
        provider: 'AIProvider',
        executionTime: 200,
      });
      expect(interpretResult(result)).toBe('Requires manual review before approval');
    });

    it('should interpret high confidence rejection', () => {
      const result = createSuccessResult(false, 0.95, {
        provider: 'RuleProvider',
        executionTime: 50,
      });
      expect(interpretResult(result)).toBe('Auto-reject with clear reason');
    });

    it('should interpret standard rejection', () => {
      const result = createSuccessResult(false, 0.7, {
        provider: 'RuleProvider',
        executionTime: 50,
      });
      expect(interpretResult(result)).toBe('Standard rejection');
    });
  });

  describe('validateDecisionResult', () => {
    const validResult: DecisionResult = {
      approved: true,
      confidence: 0.9,
      provider: 'TestProvider',
      executionTime: 50,
      timestamp: new Date(),
    };

    it('should not throw for valid result', () => {
      expect(() => validateDecisionResult(validResult)).not.toThrow();
    });

    it('should throw if approved is not boolean', () => {
      const result = { ...validResult, approved: 'yes' as any };
      expect(() => validateDecisionResult(result)).toThrow('approved must be boolean');
    });

    it('should throw if confidence is not number', () => {
      const result = { ...validResult, confidence: '0.9' as any };
      expect(() => validateDecisionResult(result)).toThrow('confidence must be number');
    });

    it('should throw if confidence is out of range', () => {
      const resultTooLow = { ...validResult, confidence: -0.1 };
      expect(() => validateDecisionResult(resultTooLow)).toThrow(
        'confidence must be between 0 and 1'
      );

      const resultTooHigh = { ...validResult, confidence: 1.5 };
      expect(() => validateDecisionResult(resultTooHigh)).toThrow(
        'confidence must be between 0 and 1'
      );
    });

    it('should throw if provider is missing', () => {
      const result = { ...validResult, provider: '' };
      expect(() => validateDecisionResult(result)).toThrow('provider is required');
    });

    it('should throw if executionTime is not number', () => {
      const result = { ...validResult, executionTime: '50' as any };
      expect(() => validateDecisionResult(result)).toThrow('executionTime must be number');
    });

    it('should throw if timestamp is not Date', () => {
      const result = { ...validResult, timestamp: '2026-01-01' as any };
      expect(() => validateDecisionResult(result)).toThrow('timestamp must be Date');
    });

    it('should throw with multiple errors', () => {
      const result = {
        ...validResult,
        approved: 'yes' as any,
        confidence: 1.5,
        provider: '',
      };

      const error = () => validateDecisionResult(result);
      expect(error).toThrow('Invalid DecisionResult');
      expect(error).toThrow('approved must be boolean');
      expect(error).toThrow('confidence must be between 0 and 1');
      expect(error).toThrow('provider is required');
    });
  });

  describe('sanitizeDecisionResult', () => {
    it('should sanitize sensitive metadata', () => {
      const result: DecisionResult = {
        approved: true,
        confidence: 1.0,
        provider: 'TestProvider',
        executionTime: 50,
        timestamp: new Date(),
        metadata: {
          ruleId: 'rule-123',
          credentials: 'secret',
          apiKey: 'key-abc',
          token: 'token-xyz',
          normalField: 'normal-value',
        },
      };

      const sanitized = sanitizeDecisionResult(result);

      expect(sanitized.metadata).toEqual({
        ruleId: 'rule-123',
        normalField: 'normal-value',
      });
    });

    it('should preserve error message and code', () => {
      const result: DecisionResult = {
        approved: false,
        confidence: 0.0,
        provider: 'error-handler',
        executionTime: 100,
        timestamp: new Date(),
        error: {
          message: 'Provider failed',
          code: 'PROVIDER_ERROR',
          stack: 'Error stack trace...',
        },
      };

      const sanitized = sanitizeDecisionResult(result);

      expect(sanitized.error?.message).toBe('Provider failed');
      expect(sanitized.error?.code).toBe('PROVIDER_ERROR');
    });

    it('should redact stack trace in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const result: DecisionResult = {
        approved: false,
        confidence: 0.0,
        provider: 'error-handler',
        executionTime: 100,
        timestamp: new Date(),
        error: {
          message: 'Error',
          code: 'ERROR',
          stack: 'Stack trace...',
        },
      };

      const sanitized = sanitizeDecisionResult(result);

      expect(sanitized.error?.stack).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });

    it('should keep stack trace in development', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      const result: DecisionResult = {
        approved: false,
        confidence: 0.0,
        provider: 'error-handler',
        executionTime: 100,
        timestamp: new Date(),
        error: {
          message: 'Error',
          code: 'ERROR',
          stack: 'Stack trace...',
        },
      };

      const sanitized = sanitizeDecisionResult(result);

      expect(sanitized.error?.stack).toBe('Stack trace...');

      process.env.NODE_ENV = originalEnv;
    });

    it('should handle result without metadata', () => {
      const result: DecisionResult = {
        approved: true,
        confidence: 1.0,
        provider: 'TestProvider',
        executionTime: 50,
        timestamp: new Date(),
      };

      const sanitized = sanitizeDecisionResult(result);

      expect(sanitized.metadata).toBeUndefined();
    });

    it('should handle result without error', () => {
      const result: DecisionResult = {
        approved: true,
        confidence: 1.0,
        provider: 'TestProvider',
        executionTime: 50,
        timestamp: new Date(),
      };

      const sanitized = sanitizeDecisionResult(result);

      expect(sanitized.error).toBeUndefined();
    });
  });
});
