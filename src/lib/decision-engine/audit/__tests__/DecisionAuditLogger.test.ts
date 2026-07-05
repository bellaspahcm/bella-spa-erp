/**
 * Unit Tests for DecisionAuditLogger
 * 
 * Tests audit logging functionality including:
 * - Persisting decisions to database
 * - Handling correlation context
 * - Version snapshot creation
 * - Resource metrics tracking
 * - Graceful error handling
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { DecisionAuditLogger } from '../DecisionAuditLogger';
import type { DecisionResult, DecisionContext } from '../../types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase client
const createMockSupabaseClient = () => {
  const mockInsert = jest.fn().mockReturnThis();
  const mockSelect = jest.fn().mockReturnThis();
  const mockSingle = jest.fn();
  const mockFrom = jest.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
    single: mockSingle,
  }));

  return {
    from: mockFrom,
    _mocks: {
      from: mockFrom,
      insert: mockInsert,
      select: mockSelect,
      single: mockSingle,
    },
  } as any;
};

describe('DecisionAuditLogger', () => {
  let logger: DecisionAuditLogger;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let consoleErrorSpy: jest.SpiedFunction<typeof console.error>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    logger = new DecisionAuditLogger(mockSupabase as unknown as SupabaseClient);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
  });

  describe('logToAuditTrail', () => {
    it('should persist decision with basic fields to database', async () => {
      const context: DecisionContext = {
        decisionType: 'leave-request-approval',
        input: {
          employeeId: 'emp-123',
          leaveType: 'annual',
          days: 5,
        },
        tenantId: 'tenant-abc',
        userId: 'user-001',
      };

      const result: DecisionResult = {
        approved: true,
        confidence: 0.95,
        matchedRules: [
          { ruleId: 'rule-001', ruleName: 'Annual Leave Policy', priority: 1 },
        ],
        metadata: {
          provider: 'DecisionEngine',
          executionTimeMs: 42,
          policiesExecuted: ['leave-policies'],
        },
        output: {
          approved: true,
          reason: 'Employee has sufficient leave balance',
        },
      };

      mockSupabase._mocks.insert.mockResolvedValue({ data: null, error: null });

      await logger.logToAuditTrail(context, result);

      expect(mockSupabase._mocks.from).toHaveBeenCalledWith('decision_audit_log');
      expect(mockSupabase._mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          decision_type: 'leave-request-approval',
          provider: 'DecisionEngine',
          tenant_id: 'tenant-abc',
          user_id: 'user-001',
          status: 'success',
          input_context: context.input,
          policies_executed: ['leave-policies'],
          output: result.output,
          confidence_score: 0.95,
          execution_time_ms: 42,
        })
      );
    });

    it('should include correlation context when provided', async () => {
      const context: DecisionContext = {
        decisionType: 'booking-validation',
        input: { bookingId: 'bkg-789' },
        tenantId: 'tenant-abc',
        correlationContext: {
          traceId: 'trace-xyz',
          spanId: 'span-123',
          parentSpanId: 'span-parent',
        },
      };

      const result: DecisionResult = {
        approved: true,
        confidence: 0.9,
        matchedRules: [],
        metadata: { provider: 'RuleEngine', executionTimeMs: 20 },
        output: { valid: true },
      };

      mockSupabase._mocks.insert.mockResolvedValue({ data: null, error: null });

      await logger.logToAuditTrail(context, result);

      expect(mockSupabase._mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          correlation_id: expect.any(String),
          trace_id: 'trace-xyz',
          span_id: 'span-123',
          parent_span_id: 'span-parent',
        })
      );
    });

    it('should include version snapshot when provided', async () => {
      const context: DecisionContext = {
        decisionType: 'price-calculation',
        input: { packageId: 'pkg-001' },
        tenantId: 'tenant-abc',
        versionSnapshot: {
          version: 'v2.1.0',
          timestamp: '2026-06-22T10:00:00Z',
          description: 'Summer promotion pricing',
        },
      };

      const result: DecisionResult = {
        approved: true,
        confidence: 1.0,
        matchedRules: [],
        metadata: { provider: 'PricingEngine', executionTimeMs: 15 },
        output: { price: 500000 },
      };

      mockSupabase._mocks.insert.mockResolvedValue({ data: null, error: null });

      await logger.logToAuditTrail(context, result);

      expect(mockSupabase._mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          version_snapshot: {
            version: 'v2.1.0',
            timestamp: '2026-06-22T10:00:00Z',
            description: 'Summer promotion pricing',
          },
        })
      );
    });

    it('should include resource metrics when provided', async () => {
      const context: DecisionContext = {
        decisionType: 'complex-analysis',
        input: { data: [1, 2, 3] },
        tenantId: 'tenant-abc',
        resourceMetrics: {
          cpuMs: 150,
          memoryBytes: 2048000,
          dbQueryCount: 5,
          dbQueryTimeMs: 45,
          apiCallCount: 2,
          apiCallTimeMs: 120,
        },
      };

      const result: DecisionResult = {
        approved: true,
        confidence: 0.85,
        matchedRules: [],
        metadata: { provider: 'AnalyticsEngine', executionTimeMs: 200 },
        output: { result: 'processed' },
      };

      mockSupabase._mocks.insert.mockResolvedValue({ data: null, error: null });

      await logger.logToAuditTrail(context, result);

      expect(mockSupabase._mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_metrics: {
            cpuMs: 150,
            memoryBytes: 2048000,
            dbQueryCount: 5,
            dbQueryTimeMs: 45,
            apiCallCount: 2,
            apiCallTimeMs: 120,
          },
        })
      );
    });

    it('should include business outcome when provided', async () => {
      const context: DecisionContext = {
        decisionType: 'discount-approval',
        input: { customerId: 'cust-456', discount: 20 },
        tenantId: 'tenant-abc',
        businessOutcome: {
          revenueImpact: -50000,
          customerSatisfactionScore: 9.5,
          operationalEfficiency: 1.2,
        },
      };

      const result: DecisionResult = {
        approved: true,
        confidence: 0.88,
        matchedRules: [],
        metadata: { provider: 'DiscountEngine', executionTimeMs: 30 },
        output: { approved: true },
      };

      mockSupabase._mocks.insert.mockResolvedValue({ data: null, error: null });

      await logger.logToAuditTrail(context, result);

      expect(mockSupabase._mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          business_outcome: {
            revenueImpact: -50000,
            customerSatisfactionScore: 9.5,
            operationalEfficiency: 1.2,
          },
        })
      );
    });

    it('should include AI metadata when provided', async () => {
      const context: DecisionContext = {
        decisionType: 'ai-recommendation',
        input: { query: 'best package' },
        tenantId: 'tenant-abc',
        aiMetadata: {
          modelName: 'gpt-4o',
          modelVersion: '2024-08',
          temperature: 0.7,
          tokensUsed: 450,
          embeddingsUsed: true,
        },
      };

      const result: DecisionResult = {
        approved: true,
        confidence: 0.92,
        matchedRules: [],
        metadata: { provider: 'AIEngine', executionTimeMs: 1200 },
        output: { recommendation: 'VIP Package' },
      };

      mockSupabase._mocks.insert.mockResolvedValue({ data: null, error: null });

      await logger.logToAuditTrail(context, result);

      expect(mockSupabase._mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          ai_metadata: {
            modelName: 'gpt-4o',
            modelVersion: '2024-08',
            temperature: 0.7,
            tokensUsed: 450,
            embeddingsUsed: true,
          },
        })
      );
    });

    it('should set status to "error" when decision has error', async () => {
      const context: DecisionContext = {
        decisionType: 'validation',
        input: { data: 'invalid' },
        tenantId: 'tenant-abc',
      };

      const result: DecisionResult = {
        approved: false,
        confidence: 0,
        matchedRules: [],
        metadata: { provider: 'Validator', executionTimeMs: 10 },
        output: {},
        error: 'Invalid input format',
      };

      mockSupabase._mocks.insert.mockResolvedValue({ data: null, error: null });

      await logger.logToAuditTrail(context, result);

      expect(mockSupabase._mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
        })
      );
    });

    it('should set status to "warning" when confidence is below 0.7', async () => {
      const context: DecisionContext = {
        decisionType: 'low-confidence-check',
        input: { data: 'ambiguous' },
        tenantId: 'tenant-abc',
      };

      const result: DecisionResult = {
        approved: true,
        confidence: 0.65,
        matchedRules: [],
        metadata: { provider: 'Engine', executionTimeMs: 25 },
        output: { approved: true },
      };

      mockSupabase._mocks.insert.mockResolvedValue({ data: null, error: null });

      await logger.logToAuditTrail(context, result);

      expect(mockSupabase._mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'warning',
        })
      );
    });

    it('should handle database insertion errors gracefully', async () => {
      const context: DecisionContext = {
        decisionType: 'test',
        input: {},
        tenantId: 'tenant-abc',
      };

      const result: DecisionResult = {
        approved: true,
        confidence: 1.0,
        matchedRules: [],
        metadata: { provider: 'Test', executionTimeMs: 5 },
        output: {},
      };

      const dbError = new Error('Database connection failed');
      mockSupabase._mocks.insert.mockResolvedValue({ data: null, error: dbError });

      // Should not throw
      await expect(logger.logToAuditTrail(context, result)).resolves.not.toThrow();

      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to persist decision to audit log:',
        dbError
      );
    });

    it('should generate decision ID if not provided', async () => {
      const context: DecisionContext = {
        decisionType: 'auto-id-test',
        input: {},
        tenantId: 'tenant-abc',
      };

      const result: DecisionResult = {
        approved: true,
        confidence: 1.0,
        matchedRules: [],
        metadata: { provider: 'Test', executionTimeMs: 5 },
        output: {},
      };

      mockSupabase._mocks.insert.mockResolvedValue({ data: null, error: null });

      await logger.logToAuditTrail(context, result);

      expect(mockSupabase._mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          decision_id: expect.stringMatching(/^dec_[a-z0-9]+$/),
        })
      );
    });

    it('should include audit log entries from result metadata', async () => {
      const context: DecisionContext = {
        decisionType: 'with-audit-log',
        input: {},
        tenantId: 'tenant-abc',
      };

      const result: DecisionResult = {
        approved: true,
        confidence: 1.0,
        matchedRules: [],
        metadata: {
          provider: 'Test',
          executionTimeMs: 10,
          auditLog: [
            { timestamp: '2026-06-22T10:00:00Z', level: 'info', message: 'Started' },
            { timestamp: '2026-06-22T10:00:01Z', level: 'info', message: 'Completed' },
          ],
        },
        output: {},
      };

      mockSupabase._mocks.insert.mockResolvedValue({ data: null, error: null });

      await logger.logToAuditTrail(context, result);

      expect(mockSupabase._mocks.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          audit_log: [
            { timestamp: '2026-06-22T10:00:00Z', level: 'info', message: 'Started' },
            { timestamp: '2026-06-22T10:00:01Z', level: 'info', message: 'Completed' },
          ],
        })
      );
    });

    it('should handle all metadata fields correctly', async () => {
      const context: DecisionContext = {
        decisionType: 'comprehensive-test',
        input: { comprehensive: true },
        tenantId: 'tenant-xyz',
        userId: 'user-999',
        correlationContext: {
          traceId: 'trace-comp',
          spanId: 'span-comp',
        },
        versionSnapshot: {
          version: 'v1.0.0',
          timestamp: '2026-01-01T00:00:00Z',
        },
        resourceMetrics: {
          cpuMs: 100,
          memoryBytes: 1024000,
        },
        businessOutcome: {
          revenueImpact: 1000,
        },
        aiMetadata: {
          modelName: 'test-model',
          tokensUsed: 100,
        },
      };

      const result: DecisionResult = {
        approved: true,
        confidence: 0.95,
        matchedRules: [
          { ruleId: 'r1', ruleName: 'Rule 1', priority: 1 },
          { ruleId: 'r2', ruleName: 'Rule 2', priority: 2 },
        ],
        metadata: {
          provider: 'ComprehensiveEngine',
          executionTimeMs: 150,
          policiesExecuted: ['policy1', 'policy2'],
          auditLog: [
            { timestamp: '2026-06-22T10:00:00Z', level: 'info', message: 'Test' },
          ],
        },
        output: { comprehensive: 'result' },
      };

      mockSupabase._mocks.insert.mockResolvedValue({ data: null, error: null });

      await logger.logToAuditTrail(context, result);

      const insertCall = mockSupabase._mocks.insert.mock.calls[0][0];
      
      expect(insertCall).toMatchObject({
        decision_type: 'comprehensive-test',
        provider: 'ComprehensiveEngine',
        tenant_id: 'tenant-xyz',
        user_id: 'user-999',
        status: 'success',
        input_context: { comprehensive: true },
        policies_executed: ['policy1', 'policy2'],
        matched_rules: [
          { ruleId: 'r1', ruleName: 'Rule 1', priority: 1 },
          { ruleId: 'r2', ruleName: 'Rule 2', priority: 2 },
        ],
        output: { comprehensive: 'result' },
        confidence_score: 0.95,
        execution_time_ms: 150,
        trace_id: 'trace-comp',
        span_id: 'span-comp',
        version_snapshot: {
          version: 'v1.0.0',
          timestamp: '2026-01-01T00:00:00Z',
        },
        resource_metrics: {
          cpuMs: 100,
          memoryBytes: 1024000,
        },
        business_outcome: {
          revenueImpact: 1000,
        },
        ai_metadata: {
          modelName: 'test-model',
          tokensUsed: 100,
        },
        audit_log: [
          { timestamp: '2026-06-22T10:00:00Z', level: 'info', message: 'Test' },
        ],
      });
    });
  });
});
