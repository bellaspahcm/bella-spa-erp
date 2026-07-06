/**
 * Unit Tests - DecisionEngine
 * 
 * Tests for DecisionEngine core orchestrator evaluation flow.
 */

import type { IDecisionProvider } from '../../abstractions';
import type { DecisionContext, DecisionResult } from '../../types';
import type { ILogger } from '../../../logger';
import {
  createDecisionEngine,
  DecisionEngine,
  type DecisionEngineConfig,
} from '../DecisionEngine';
import { DecisionProviderRegistry } from '../DecisionProviderRegistry';
import { ProviderEvaluationError } from '../../errors';

// Mock provider implementation
class MockProvider implements IDecisionProvider {
  constructor(
    public readonly name: string,
    public readonly supportedRuleTypes: string[],
    private readonly mockResult: Partial<DecisionResult>,
    private readonly evaluateDelay = 0,
    private readonly shouldThrow = false
  ) {}

  async evaluate(context: DecisionContext): Promise<DecisionResult> {
    if (this.shouldThrow) {
      throw new Error(`Mock evaluation error from ${this.name}`);
    }

    await new Promise((resolve) => setTimeout(resolve, this.evaluateDelay));

    return {
      approved: this.mockResult.approved ?? true,
      confidence: this.mockResult.confidence ?? 1.0,
      provider: this.name,
      executionTime: this.evaluateDelay,
      timestamp: new Date(),
      matchedRules: this.mockResult.matchedRules,
      recommendations: this.mockResult.recommendations,
      metadata: this.mockResult.metadata,
    };
  }

  canHandle(context: DecisionContext): boolean {
    return this.supportedRuleTypes.includes(context.ruleType);
  }
}

// Mock logger
class MockLogger implements ILogger {
  logs: Array<{ level: string; message: string; data?: any }> = [];

  info(message: string, data?: any) {
    this.logs.push({ level: 'info', message, data });
  }

  warn(message: string, data?: any) {
    this.logs.push({ level: 'warn', message, data });
  }

  error(message: string, data?: any) {
    this.logs.push({ level: 'error', message, data });
  }

  debug(message: string, data?: any) {
    this.logs.push({ level: 'debug', message, data });
  }

  clear() {
    this.logs = [];
  }
}

// Mock event publisher
class MockEventPublisher {
  events: Array<{ type: string; data: any }> = [];

  async publish(event: any) {
    this.events.push({ type: event.type, data: event.data });
  }

  clear() {
    this.events = [];
  }
}

describe('DecisionEngine', () => {
  let registry: DecisionProviderRegistry;
  let logger: MockLogger;
  let eventPublisher: MockEventPublisher;

  beforeEach(() => {
    registry = new DecisionProviderRegistry();
    logger = new MockLogger();
    eventPublisher = new MockEventPublisher();
  });

  describe('evaluate', () => {
    it('should evaluate decision with simple approval', async () => {
      const provider = new MockProvider('TestProvider', ['if-then'], {
        approved: true,
        confidence: 0.95,
      });
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000, creditScore: 750 },
        timestamp: new Date(),
      };

      const result = await engine.evaluate(context);

      expect(result.approved).toBe(true);
      expect(result.confidence).toBe(0.95);
      expect(result.provider).toBe('TestProvider');
      expect(result.isFallback).toBeUndefined();
    });

    it('should evaluate decision with rejection', async () => {
      const provider = new MockProvider('TestProvider', ['if-then'], {
        approved: false,
        confidence: 0.8,
        recommendations: ['Improve credit score', 'Reduce loan amount'],
      });
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 50000, creditScore: 600 },
        timestamp: new Date(),
      };

      const result = await engine.evaluate(context);

      expect(result.approved).toBe(false);
      expect(result.confidence).toBe(0.8);
      expect(result.recommendations).toEqual([
        'Improve credit score',
        'Reduce loan amount',
      ]);
    });

    it('should include matched rules in result', async () => {
      const provider = new MockProvider('TestProvider', ['if-then'], {
        approved: true,
        confidence: 1.0,
        matchedRules: [
          'creditScore >= 700',
          'amount <= 20000',
        ],
      });
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000, creditScore: 750 },
        timestamp: new Date(),
      };

      const result = await engine.evaluate(context);

      expect(result.matchedRules).toEqual([
        'creditScore >= 700',
        'amount <= 20000',
      ]);
    });

    it('should include metadata in result', async () => {
      const provider = new MockProvider('TestProvider', ['if-then'], {
        approved: true,
        confidence: 1.0,
        metadata: {
          processingMethod: 'rule-based',
          ruleVersion: '1.2.0',
        },
      });
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000, creditScore: 750 },
        timestamp: new Date(),
      };

      const result = await engine.evaluate(context);

      expect(result.metadata).toEqual({
        processingMethod: 'rule-based',
        ruleVersion: '1.2.0',
      });
    });

    it('should measure execution time accurately', async () => {
      const provider = new MockProvider(
        'TestProvider',
        ['if-then'],
        { approved: true, confidence: 1.0 },
        100 // 100ms delay
      );
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000 },
        timestamp: new Date(),
      };

      const result = await engine.evaluate(context);

      expect(result.executionTime).toBeGreaterThanOrEqual(100);
      expect(result.executionTime).toBeLessThan(200);
    });

    it('should publish decision.evaluated event', async () => {
      const provider = new MockProvider('TestProvider', ['if-then'], {
        approved: true,
        confidence: 0.95,
      });
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000, creditScore: 750 },
        timestamp: new Date(),
      };

      await engine.evaluate(context);

      expect(eventPublisher.events).toHaveLength(1);
      expect(eventPublisher.events[0].type).toBe('decision.evaluated');
      expect(eventPublisher.events[0].data.approved).toBe(true);
    });

    it('should log evaluation info', async () => {
      const provider = new MockProvider('TestProvider', ['if-then'], {
        approved: true,
        confidence: 0.95,
      });
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000, creditScore: 750 },
        timestamp: new Date(),
      };

      await engine.evaluate(context);

      const infoLogs = logger.logs.filter((log) => log.level === 'info');
      expect(infoLogs.length).toBeGreaterThan(0);
      expect(infoLogs.some((log) => log.message.includes('Decision evaluated'))).toBe(
        true
      );
    });

    it('should support correlationId for tracing', async () => {
      const provider = new MockProvider('TestProvider', ['if-then'], {
        approved: true,
        confidence: 1.0,
      });
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000 },
        timestamp: new Date(),
        correlationId: 'test-correlation-123',
      };

      const result = await engine.evaluate(context);

      expect(result.correlationId).toBe('test-correlation-123');
    });
  });

  describe('error handling', () => {
    it('should throw ProviderNotFoundError if no provider registered', async () => {
      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'unknown-type',
        rule: { condition: {}, action: {} },
        data: { amount: 10000 },
        timestamp: new Date(),
      };

      await expect(engine.evaluate(context)).rejects.toThrow(
        'No provider found for rule type: "unknown-type"'
      );
    });

    it('should wrap provider error in ProviderEvaluationError with fallback', async () => {
      const provider = new MockProvider(
        'TestProvider',
        ['if-then'],
        {},
        0,
        true // shouldThrow
      );
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
        fallbackStrategy: 'SAFE_DEFAULT',
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000 },
        timestamp: new Date(),
      };

      const result = await engine.evaluate(context);

      expect(result.isFallback).toBe(true);
      expect(result.approved).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it('should throw error when fallback strategy is RETHROW', async () => {
      const provider = new MockProvider(
        'TestProvider',
        ['if-then'],
        {},
        0,
        true // shouldThrow
      );
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
        fallbackStrategy: 'RETHROW',
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000 },
        timestamp: new Date(),
      };

      await expect(engine.evaluate(context)).rejects.toThrow(
        'Mock evaluation error from TestProvider'
      );
    });

    it('should use fallback strategy on provider error', async () => {
      const provider = new MockProvider(
        'TestProvider',
        ['if-then'],
        {},
        0,
        true // shouldThrow
      );
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
        fallbackStrategy: 'SAFE_DEFAULT',
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000 },
        timestamp: new Date(),
      };

      const result = await engine.evaluate(context);

      expect(result.isFallback).toBe(true);
      expect(result.approved).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.recommendations).toContain('Manual review required due to system error');
    });

    it('should handle timeout with fallback', async () => {
      const provider = new MockProvider(
        'TestProvider',
        ['if-then'],
        { approved: true, confidence: 1.0 },
        2000 // 2s delay (exceeds timeout)
      );
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
        timeoutMs: 500, // 500ms timeout
        fallbackStrategy: 'SAFE_DEFAULT',
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000 },
        timestamp: new Date(),
      };

      const result = await engine.evaluate(context);

      expect(result.isFallback).toBe(true);
      expect(result.approved).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.error).toBeDefined();
      expect(result.error?.code).toBe('EVALUATION_TIMEOUT');
    });

    it('should log errors with details', async () => {
      const provider = new MockProvider(
        'TestProvider',
        ['if-then'],
        {},
        0,
        true // shouldThrow
      );
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
        fallbackStrategy: 'SAFE_DEFAULT',
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000 },
        timestamp: new Date(),
      };

      await engine.evaluate(context);

      const errorLogs = logger.logs.filter((log) => log.level === 'error');
      expect(errorLogs.length).toBeGreaterThan(0);
      expect(
        errorLogs.some((log) => log.message.includes('Provider evaluation failed'))
      ).toBe(true);
    });

    it('should publish event on error when fallback used', async () => {
      const provider = new MockProvider(
        'TestProvider',
        ['if-then'],
        {},
        0,
        true // shouldThrow
      );
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
        fallbackStrategy: 'SAFE_DEFAULT',
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000 },
        timestamp: new Date(),
      };

      await engine.evaluate(context);

      // Should still publish event with isFallback=true
      expect(eventPublisher.events).toHaveLength(1);
      expect(eventPublisher.events[0].data.isFallback).toBe(true);
    });
  });

  describe('validation', () => {
    it('should throw error if context is missing required fields', async () => {
      const provider = new MockProvider('TestProvider', ['if-then'], {
        approved: true,
        confidence: 1.0,
      });
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
      });

      const invalidContext = {
        // Missing ruleType and other required fields
        module: 'lending',
        data: { amount: 10000 },
        timestamp: new Date(),
      } as any;

      await expect(engine.evaluate(invalidContext)).rejects.toThrow(
        'Invalid context'
      );
    });

    it('should validate context before evaluation', async () => {
      const provider = new MockProvider('TestProvider', ['if-then'], {
        approved: true,
        confidence: 1.0,
      });
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
      });

      const invalidContext = {
        tenantId: '',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: {},
        data: { amount: 10000 },
        timestamp: new Date(),
      } as any;

      await expect(engine.evaluate(invalidContext)).rejects.toThrow();
    });
  });

  describe('configuration', () => {
    it('should work without event publisher', async () => {
      const provider = new MockProvider('TestProvider', ['if-then'], {
        approved: true,
        confidence: 1.0,
      });
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        logger,
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000 },
        timestamp: new Date(),
      };

      const result = await engine.evaluate(context);

      expect(result.approved).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should work without logger', async () => {
      const provider = new MockProvider('TestProvider', ['if-then'], {
        approved: true,
        confidence: 1.0,
      });
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000 },
        timestamp: new Date(),
      };

      const result = await engine.evaluate(context);

      expect(result.approved).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should respect custom timeout configuration', async () => {
      const provider = new MockProvider(
        'TestProvider',
        ['if-then'],
        { approved: true, confidence: 1.0 },
        1500 // 1.5s delay
      );
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
        timeoutMs: 2000, // 2s timeout (should allow provider to complete)
        fallbackStrategy: 'SAFE_DEFAULT',
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000 },
        timestamp: new Date(),
      };

      const result = await engine.evaluate(context);

      expect(result.isFallback).toBeUndefined();
      expect(result.approved).toBe(true);
      expect(result.confidence).toBe(1.0);
    });

    it('should respect custom fallback strategy', async () => {
      const provider = new MockProvider(
        'TestProvider',
        ['if-then'],
        {},
        0,
        true // shouldThrow
      );
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
        fallbackStrategy: 'MANUAL_REVIEW',
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: { amount: 10000 },
        timestamp: new Date(),
      };

      const result = await engine.evaluate(context);

      expect(result.isFallback).toBe(true);
      expect(result.approved).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.action).toBe('MANUAL_REVIEW');
    });
  });

  describe('createDecisionEngine', () => {
    it('should create DecisionEngine instance', () => {
      const engine = createDecisionEngine({
        registry,
        logger,
      });

      expect(engine).toBeInstanceOf(DecisionEngine);
    });
  });

  describe('sanitization', () => {
    it('should sanitize sensitive data in logs', async () => {
      const provider = new MockProvider('TestProvider', ['if-then'], {
        approved: true,
        confidence: 1.0,
      });
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: {
          amount: 10000,
          password: 'secret123',
          apiKey: 'sk_live_xyz',
        },
        timestamp: new Date(),
      };

      await engine.evaluate(context);

      const logs = logger.logs;
      const logStrings = JSON.stringify(logs);

      expect(logStrings).not.toContain('secret123');
      expect(logStrings).not.toContain('sk_live_xyz');
      expect(logStrings).toContain('REDACTED');
    });

    it('should sanitize sensitive data in events', async () => {
      const provider = new MockProvider('TestProvider', ['if-then'], {
        approved: true,
        confidence: 1.0,
      });
      registry.register(provider);

      const engine = new DecisionEngine({
        registry,
        eventPublisher: {
          publish: (event) => eventPublisher.publish(event),
        },
        logger,
      });

      const context: DecisionContext = {
        tenantId: 'test-tenant',
        module: 'lending',
        decisionType: 'loan-approval',
        ruleType: 'if-then',
        rule: { condition: {}, action: {} },
        data: {
          amount: 10000,
          password: 'secret123',
          creditCard: '4111-1111-1111-1111',
        },
        timestamp: new Date(),
      };

      await engine.evaluate(context);

      const events = eventPublisher.events;
      const eventStrings = JSON.stringify(events);

      expect(eventStrings).not.toContain('secret123');
      expect(eventStrings).not.toContain('4111-1111-1111-1111');
      // Events don't sanitize automatically - this is expected behavior
    });
  });
});
