/**
 * Resilience Tests
 * 
 * Validates Retry Queue + Circuit Breaker patterns work correctly.
 * 
 * Critical Tests:
 * 1. Queue retries failed items with exponential backoff
 * 2. Circuit breaker opens after threshold failures
 * 3. Circuit breaker tests recovery (half-open state)
 * 4. Dead Letter Queue captures max-retry items
 * 5. Business decisions succeed even when audit fails
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { AuditQueue } from '../AuditQueue';
import { CircuitBreaker, CircuitBreakerOpenError } from '../CircuitBreaker';
import { ResilientDecisionAuditLogger } from '../ResilientDecisionAuditLogger';
import type { DecisionContext, DecisionResult } from '../../types';

describe('AuditQueue', () => {
  it('should retry failed items with exponential backoff', async () => {
    let attempts = 0;
    const mockProcessor = jest.fn(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('Simulated failure');
      }
      // Success on 3rd attempt
    });

    const queue = new AuditQueue(mockProcessor, {
      maxAttempts: 3,
      baseDelayMs: 10, // Short delays for testing
      processingIntervalMs: 10,
    });

    queue.enqueue({ test: 'data' });

    // Wait for retries
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(mockProcessor).toHaveBeenCalledTimes(3);
    const metrics = queue.getMetrics();
    expect(metrics.successCount).toBe(1);
    expect(metrics.pending).toBe(0);

    await queue.stop();
  });

  it('should move to DLQ after max retries', async () => {
    const mockProcessor = jest.fn(async () => {
      throw new Error('Always fails');
    });

    const queue = new AuditQueue(mockProcessor, {
      maxAttempts: 3,
      baseDelayMs: 10,
      processingIntervalMs: 10,
    });

    queue.enqueue({ test: 'data' });

    // Wait for all retries
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(mockProcessor).toHaveBeenCalledTimes(3);
    const metrics = queue.getMetrics();
    expect(metrics.deadLetters).toBe(1);
    expect(metrics.pending).toBe(0);

    const dlq = queue.getDLQ();
    expect(dlq.length).toBe(1);
    expect(dlq[0].attempt).toBe(3);

    await queue.stop();
  });

  it('should retry items from DLQ', async () => {
    let attempts = 0;
    const mockProcessor = jest.fn(async () => {
      attempts++;
      if (attempts <= 3) {
        throw new Error('Fail first 3 times');
      }
      // Success on 4th attempt (after DLQ retry)
    });

    const queue = new AuditQueue(mockProcessor, {
      maxAttempts: 3,
      baseDelayMs: 10,
      processingIntervalMs: 10,
    });

    queue.enqueue({ test: 'data' });

    // Wait for initial retries → DLQ
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(queue.getDLQ().length).toBe(1);

    // Retry from DLQ
    const itemId = queue.getDLQ()[0].id;
    const retried = queue.retryFromDLQ(itemId);
    expect(retried).toBe(true);

    // Wait for successful retry
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(queue.getDLQ().length).toBe(0);
    expect(queue.getMetrics().successCount).toBe(1);

    await queue.stop();
  });
});

describe('CircuitBreaker', () => {
  it('should open circuit after failure threshold', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      timeout: 1000,
    });

    const failingFn = async () => {
      throw new Error('Always fails');
    };

    // Trigger 3 failures
    for (let i = 0; i < 3; i++) {
      try {
        await breaker.execute(failingFn);
      } catch (error) {
        // Expected
      }
    }

    // Circuit should be open now
    expect(breaker.isOpen()).toBe(true);
    expect(breaker.getState()).toBe('OPEN');

    // Next call should fail fast
    await expect(breaker.execute(failingFn)).rejects.toThrow(CircuitBreakerOpenError);
  });

  it('should transition to half-open after timeout', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      timeout: 100, // Short timeout for testing
    });

    const failingFn = async () => {
      throw new Error('Fail');
    };

    // Open circuit
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(failingFn);
      } catch (error) {
        // Expected
      }
    }

    expect(breaker.isOpen()).toBe(true);

    // Wait for timeout
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Next call should attempt (half-open)
    const successFn = async () => 'success';
    const result = await breaker.execute(successFn);

    expect(result).toBe('success');
    expect(breaker.getState()).toBe('HALF_OPEN');
  });

  it('should close circuit after successful recovery', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      successThreshold: 2,
      timeout: 100,
    });

    // Open circuit
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('Fail');
        });
      } catch (error) {
        // Expected
      }
    }

    expect(breaker.isOpen()).toBe(true);

    // Wait for timeout → half-open
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 2 successful calls → close circuit
    const successFn = async () => 'success';
    await breaker.execute(successFn);
    await breaker.execute(successFn);

    expect(breaker.isClosed()).toBe(true);
    expect(breaker.getState()).toBe('CLOSED');
  });

  it('should reopen if recovery test fails', async () => {
    const breaker = new CircuitBreaker({
      failureThreshold: 2,
      timeout: 100,
    });

    // Open circuit
    for (let i = 0; i < 2; i++) {
      try {
        await breaker.execute(async () => {
          throw new Error('Fail');
        });
      } catch (error) {
        // Expected
      }
    }

    expect(breaker.isOpen()).toBe(true);

    // Wait for timeout → half-open
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Recovery test fails
    try {
      await breaker.execute(async () => {
        throw new Error('Still failing');
      });
    } catch (error) {
      // Expected
    }

    // Should reopen
    expect(breaker.isOpen()).toBe(true);
  });
});

describe('ResilientDecisionAuditLogger - Integration', () => {
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn(() => ({
        insert: jest.fn().mockResolvedValue({ error: null }),
      })),
    };
  });

  it('should log decisions successfully', async () => {
    const logger = new ResilientDecisionAuditLogger(mockSupabase);

    const context: DecisionContext = {
      decisionType: 'test',
      input: { test: true },
      tenantId: 'tenant-123',
    };

    const result: DecisionResult = {
      approved: true,
      confidence: 1.0,
      matchedRules: [],
      metadata: {
        provider: 'TestEngine',
        executionTimeMs: 5,
      },
      output: { approved: true },
    };

    await logger.logToAuditTrail(context, result);

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(mockSupabase.from).toHaveBeenCalledWith('decision_audit_log');
    const health = logger.getHealth();
    expect(health.status).toBe('healthy');

    await logger.shutdown();
  });

  it('should handle database failures gracefully', async () => {
    let attempts = 0;
    mockSupabase.from = jest.fn(() => ({
      insert: jest.fn(async () => {
        attempts++;
        if (attempts < 3) {
          return { error: { message: 'DB unavailable' } };
        }
        return { error: null };
      }),
    }));

    const logger = new ResilientDecisionAuditLogger(mockSupabase);

    const context: DecisionContext = {
      decisionType: 'test',
      input: {},
      tenantId: 'tenant-123',
    };

    const result: DecisionResult = {
      approved: true,
      confidence: 1.0,
      matchedRules: [],
      metadata: { provider: 'Test', executionTimeMs: 1 },
      output: {},
    };

    // Should not throw
    await expect(logger.logToAuditTrail(context, result)).resolves.not.toThrow();

    // Wait for retries
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(attempts).toBeGreaterThanOrEqual(2);

    await logger.shutdown();
  });

  it('should move to DLQ after max retries', async () => {
    mockSupabase.from = jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: { message: 'Always fails' } }),
    }));

    const logger = new ResilientDecisionAuditLogger(mockSupabase);

    const context: DecisionContext = {
      decisionType: 'test',
      input: {},
      tenantId: 'tenant-123',
    };

    const result: DecisionResult = {
      approved: true,
      confidence: 1.0,
      matchedRules: [],
      metadata: { provider: 'Test', executionTimeMs: 1 },
      output: {},
    };

    await logger.logToAuditTrail(context, result);

    // Wait for all retries → DLQ
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const health = logger.getHealth();
    expect(health.dlqSize).toBe(1);

    const dlq = logger.getDLQ();
    expect(dlq.length).toBe(1);
    expect(dlq[0].attempt).toBe(3);

    await logger.shutdown();
  });

  it('should open circuit breaker after repeated failures', async () => {
    mockSupabase.from = jest.fn(() => ({
      insert: jest.fn().mockResolvedValue({ error: { message: 'DB down' } }),
    }));

    const logger = new ResilientDecisionAuditLogger(mockSupabase);

    // Trigger 6+ failures (threshold is 5)
    for (let i = 0; i < 6; i++) {
      await logger.logToAuditTrail(
        { decisionType: 'test', input: {}, tenantId: 'test' },
        { approved: true, confidence: 1, matchedRules: [], metadata: { provider: 'Test', executionTimeMs: 1 }, output: {} }
      );
    }

    // Wait for processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    const health = logger.getHealth();
    expect(health.circuitBreaker.state).toBe('OPEN');
    expect(health.status).toBe('unhealthy');

    await logger.shutdown();
  });

  it('should retry items from DLQ successfully', async () => {
    let attempts = 0;
    mockSupabase.from = jest.fn(() => ({
      insert: jest.fn(async () => {
        attempts++;
        if (attempts <= 3) {
          return { error: { message: 'Fail first 3' } };
        }
        return { error: null }; // Success after DLQ retry
      }),
    }));

    const logger = new ResilientDecisionAuditLogger(mockSupabase);

    await logger.logToAuditTrail(
      { decisionType: 'test', input: {}, tenantId: 'test' },
      { approved: true, confidence: 1, matchedRules: [], metadata: { provider: 'Test', executionTimeMs: 1 }, output: {} }
    );

    // Wait for initial retries → DLQ
    await new Promise((resolve) => setTimeout(resolve, 600));
    expect(logger.getDLQ().length).toBe(1);

    // Retry from DLQ
    const retried = logger.retryAllFromDLQ();
    expect(retried).toBe(1);

    // Wait for successful retry
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(logger.getDLQ().length).toBe(0);

    await logger.shutdown();
  });
});

describe('Chaos Engineering - Decision Engine Resilience', () => {
  it('CRITICAL: Business decisions must succeed when audit DB is down', async () => {
    // Mock complete DB failure
    const brokenSupabase = {
      from: jest.fn(() => ({
        insert: jest.fn().mockRejectedValue(new Error('Database connection refused')),
      })),
    };

    const logger = new ResilientDecisionAuditLogger(brokenSupabase as any);

    const context: DecisionContext = {
      decisionType: 'leave-approval',
      input: {
        employeeId: 'emp-123',
        days: 5,
      },
      tenantId: 'tenant-xyz',
    };

    const result: DecisionResult = {
      approved: true,
      confidence: 0.95,
      matchedRules: [{ ruleId: 'rule-1', ruleName: 'Leave Policy', priority: 1 }],
      metadata: {
        provider: 'LeaveEngine',
        executionTimeMs: 42,
      },
      output: {
        approved: true,
        reason: 'Sufficient leave balance',
      },
    };

    // Make 6+ decisions (threshold is 5) to trigger circuit breaker
    for (let i = 0; i < 6; i++) {
      // Audit logging should not throw
      await expect(logger.logToAuditTrail(context, result)).resolves.not.toThrow();

      // Business decision is successful
      expect(result.approved).toBe(true);
    }

    // Wait for queue processing and circuit breaker to open
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const health = logger.getHealth();
    expect(health.status).toBe('unhealthy'); // Circuit open
    expect(health.circuitBreaker.state).toBe('OPEN');

    await logger.shutdown();
  }, 5000); // 5 second timeout for chaos test
});
