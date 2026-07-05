/**
 * Decision Engine Observability Tests
 * 
 * Tests for metrics collection, audit trail, and event emission.
 * 
 * @module Tests/Observability
 */

import {
  MetricsCollector,
  AuditTrail,
  DecisionEventEmitter,
  ObservabilityInterceptor,
  type DecisionMetric,
  type AuditRecord,
  type DecisionEventPayload,
} from '@/lib/decision-engine/observability';
import type { DecisionContext, DecisionResult } from '@/lib/decision-engine';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  it('should record metrics', () => {
    const metric: DecisionMetric = {
      timestamp: new Date(),
      decisionType: 'booking_approval',
      executionTime: 12.5,
      confidence: 0.95,
      provider: 'RuleProvider',
      rulesMatched: 2,
      approved: true,
      requiresManualReview: false,
      cacheHit: false,
      failed: false,
      usedFallback: false,
      tenantId: 'test-tenant',
    };

    collector.record(metric);

    expect(collector.count()).toBe(1);
  });

  it('should query metrics by tenant', () => {
    collector.record({
      timestamp: new Date(),
      decisionType: 'booking_approval',
      executionTime: 10,
      confidence: 0.9,
      provider: 'RuleProvider',
      rulesMatched: 1,
      approved: true,
      requiresManualReview: false,
      cacheHit: false,
      failed: false,
      usedFallback: false,
      tenantId: 'tenant-1',
    });

    collector.record({
      timestamp: new Date(),
      decisionType: 'booking_approval',
      executionTime: 15,
      confidence: 0.8,
      provider: 'RuleProvider',
      rulesMatched: 1,
      approved: false,
      requiresManualReview: true,
      cacheHit: false,
      failed: false,
      usedFallback: false,
      tenantId: 'tenant-2',
    });

    const tenant1Metrics = collector.query({ tenantId: 'tenant-1' });
    expect(tenant1Metrics).toHaveLength(1);
    expect(tenant1Metrics[0].tenantId).toBe('tenant-1');
  });

  it('should aggregate metrics correctly', () => {
    // Record multiple metrics
    for (let i = 0; i < 10; i++) {
      collector.record({
        timestamp: new Date(),
        decisionType: 'booking_approval',
        executionTime: 10 + i,
        confidence: 0.9,
        provider: 'RuleProvider',
        rulesMatched: 1,
        approved: i % 2 === 0,
        requiresManualReview: false,
        cacheHit: false,
        failed: false,
        usedFallback: false,
        tenantId: 'test-tenant',
      });
    }

    const aggregated = collector.aggregate({ tenantId: 'test-tenant' });

    expect(aggregated.totalDecisions).toBe(10);
    expect(aggregated.autoApprovalRate).toBe(0.5); // 5 approved, 5 rejected
    expect(aggregated.averageExecutionTime).toBeGreaterThan(10);
    expect(aggregated.p95Latency).toBeGreaterThan(0);
  });

  it('should handle empty metrics', () => {
    const aggregated = collector.aggregate();
    expect(aggregated.totalDecisions).toBe(0);
  });
});

describe('AuditTrail', () => {
  let trail: AuditTrail;

  beforeEach(() => {
    trail = new AuditTrail();
  });

  it('should record audit entries', () => {
    const record: AuditRecord = {
      decisionId: 'dec-123',
      decisionType: 'booking_approval',
      timestamp: new Date(),
      tenantId: 'test-tenant',
      provider: 'RuleProvider',
      matchedRules: [],
      executionTime: 12.5,
      confidence: 0.95,
      actions: [],
      reason: 'Test reason',
      context: {} as DecisionContext,
      result: {
        approved: true,
        requiresDeposit: false,
        depositAmount: 0,
        requiresManualReview: false,
        confidence: 0.95,
        reason: 'Test',
        actions: [],
      },
      cacheHit: false,
      failed: false,
      usedFallback: false,
    };

    trail.record(record);

    expect(trail.count()).toBe(1);
  });

  it('should query audit records by decision ID', () => {
    trail.record({
      decisionId: 'dec-123',
      decisionType: 'booking_approval',
      timestamp: new Date(),
      tenantId: 'test-tenant',
      provider: 'RuleProvider',
      matchedRules: [],
      executionTime: 12.5,
      confidence: 0.95,
      actions: [],
      reason: 'Test',
      context: {} as DecisionContext,
      result: {} as DecisionResult,
      cacheHit: false,
      failed: false,
      usedFallback: false,
    });

    const record = trail.get('dec-123');
    expect(record).toBeDefined();
    expect(record?.decisionId).toBe('dec-123');
  });

  it('should filter by approval status', () => {
    trail.record({
      decisionId: 'dec-1',
      decisionType: 'booking_approval',
      timestamp: new Date(),
      tenantId: 'test-tenant',
      provider: 'RuleProvider',
      matchedRules: [],
      executionTime: 10,
      confidence: 0.9,
      actions: [],
      reason: 'Approved',
      context: {} as DecisionContext,
      result: { approved: true } as DecisionResult,
      cacheHit: false,
      failed: false,
      usedFallback: false,
    });

    trail.record({
      decisionId: 'dec-2',
      decisionType: 'booking_approval',
      timestamp: new Date(),
      tenantId: 'test-tenant',
      provider: 'RuleProvider',
      matchedRules: [],
      executionTime: 10,
      confidence: 0.8,
      actions: [],
      reason: 'Rejected',
      context: {} as DecisionContext,
      result: { approved: false } as DecisionResult,
      cacheHit: false,
      failed: false,
      usedFallback: false,
    });

    const approved = trail.query({ approved: true });
    expect(approved).toHaveLength(1);
    expect(approved[0].decisionId).toBe('dec-1');
  });

  it('should export JSON', () => {
    trail.record({
      decisionId: 'dec-123',
      decisionType: 'booking_approval',
      timestamp: new Date(),
      tenantId: 'test-tenant',
      provider: 'RuleProvider',
      matchedRules: [],
      executionTime: 12.5,
      confidence: 0.95,
      actions: [],
      reason: 'Test',
      context: {} as DecisionContext,
      result: {} as DecisionResult,
      cacheHit: false,
      failed: false,
      usedFallback: false,
    });

    const json = trail.exportJSON();
    expect(json).toContain('dec-123');
    expect(json).toContain('booking_approval');
  });

  it('should provide statistics', () => {
    trail.record({
      decisionId: 'dec-1',
      decisionType: 'booking_approval',
      timestamp: new Date(),
      tenantId: 'test-tenant',
      provider: 'RuleProvider',
      matchedRules: [],
      executionTime: 10,
      confidence: 0.9,
      actions: [],
      reason: 'Test',
      context: {} as DecisionContext,
      result: {} as DecisionResult,
      cacheHit: false,
      failed: false,
      usedFallback: false,
    });

    const stats = trail.getStats();
    expect(stats.totalRecords).toBe(1);
    expect(stats.decisionTypes['booking_approval']).toBe(1);
    expect(stats.providers['RuleProvider']).toBe(1);
  });
});

describe('DecisionEventEmitter', () => {
  let emitter: DecisionEventEmitter;

  beforeEach(() => {
    emitter = new DecisionEventEmitter();
  });

  it('should emit and handle events', async () => {
    const handler = jest.fn();

    emitter.on('decision.completed', handler);

    await emitter.emitCompleted({
      decisionId: 'dec-123',
      decisionType: 'booking_approval',
      tenantId: 'test-tenant',
      provider: 'RuleProvider',
      context: {} as DecisionContext,
      result: {} as DecisionResult,
      executionTime: 12.5,
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0].decisionId).toBe('dec-123');
  });

  it('should unsubscribe handlers', async () => {
    const handler = jest.fn();

    emitter.on('decision.completed', handler);
    emitter.off('decision.completed', handler);

    await emitter.emitCompleted({
      decisionId: 'dec-123',
      decisionType: 'booking_approval',
      tenantId: 'test-tenant',
      provider: 'RuleProvider',
      context: {} as DecisionContext,
      result: {} as DecisionResult,
      executionTime: 12.5,
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('should handle multiple subscribers', async () => {
    const handler1 = jest.fn();
    const handler2 = jest.fn();

    emitter.on('decision.completed', handler1);
    emitter.on('decision.completed', handler2);

    await emitter.emitCompleted({
      decisionId: 'dec-123',
      decisionType: 'booking_approval',
      tenantId: 'test-tenant',
      provider: 'RuleProvider',
      context: {} as DecisionContext,
      result: {} as DecisionResult,
      executionTime: 12.5,
    });

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });
});

describe('ObservabilityInterceptor', () => {
  let interceptor: ObservabilityInterceptor;
  let collector: MetricsCollector;
  let trail: AuditTrail;

  beforeEach(() => {
    interceptor = new ObservabilityInterceptor();
    collector = new MetricsCollector();
    trail = new AuditTrail();
  });

  it('should collect observability data during decision', async () => {
    const context: DecisionContext = {
      tenantId: 'test-tenant',
      module: 'booking',
      decisionType: 'auto-approval',
      ruleType: 'if-then',
      rule: {},
      data: {},
    };

    const executor = jest.fn().mockResolvedValue({
      approved: true,
      requiresDeposit: false,
      depositAmount: 0,
      requiresManualReview: false,
      confidence: 0.95,
      reason: 'Test',
      actions: [],
    });

    const result = await interceptor.intercept(context, executor, {
      decisionType: 'booking_approval',
      provider: 'RuleProvider',
      tenantId: 'test-tenant',
    });

    expect(result.approved).toBe(true);
    expect(executor).toHaveBeenCalledWith(context);
  });

  it('should handle decision failures', async () => {
    const context: DecisionContext = {
      tenantId: 'test-tenant',
      module: 'booking',
      decisionType: 'auto-approval',
      ruleType: 'if-then',
      rule: {},
      data: {},
    };

    const executor = jest.fn().mockRejectedValue(new Error('Test error'));

    const result = await interceptor.intercept(context, executor, {
      decisionType: 'booking_approval',
      provider: 'RuleProvider',
      tenantId: 'test-tenant',
    });

    expect(result.approved).toBe(false);
    expect(result.requiresManualReview).toBe(true);
    expect(result.reason).toContain('Decision failed');
  });
});
