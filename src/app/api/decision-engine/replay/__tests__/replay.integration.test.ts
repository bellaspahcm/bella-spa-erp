/**
 * Integration Tests for Decision Replay API
 * 
 * Tests the complete replay workflow including:
 * - Fetching original decision from audit log
 * - Reconstructing DecisionContext from stored data
 * - Re-executing decision with Decision Engine
 * - Comparing original vs replayed results
 * - Generating detailed diffs
 * - Policy version comparison (Time Machine)
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { POST } from '../[id]/route';
import { NextRequest } from 'next/server';
import type { DecisionEngine } from '@/lib/decision-engine/core/DecisionEngine';

// Mock Supabase
const createMockSupabaseClient = () => {
  const mockRpc = jest.fn();
  const mockFrom = jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(),
  }));

  return {
    rpc: mockRpc,
    from: mockFrom,
    _mocks: {
      rpc: mockRpc,
      from: mockFrom,
    },
  } as any;
};

// Mock Decision Engine
const createMockDecisionEngine = () => {
  const mockEvaluate = jest.fn();
  
  return {
    evaluate: mockEvaluate,
    _mocks: {
      evaluate: mockEvaluate,
    },
  } as any;
};

// Mock auth
jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => createMockSupabaseClient()),
}));

describe('POST /api/decision-engine/replay/[id] - Integration Tests', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
  let mockEngine: ReturnType<typeof createMockDecisionEngine>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    mockEngine = createMockDecisionEngine();
    
    // Mock createClient to return our mock
    const { createClient } = require('@/lib/supabase-server');
    createClient.mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End Replay Workflow', () => {
    it('should replay decision and generate correct diff', async () => {
      // Original decision from audit log
      const originalDecision = {
        id: 'dec-001',
        decision_id: 'dec_abc123',
        decision_type: 'leave-request-approval',
        provider: 'LeaveEngine',
        tenant_id: 'tenant-xyz',
        user_id: 'user-123',
        input_context: {
          employeeId: 'emp-456',
          leaveType: 'annual',
          days: 5,
          startDate: '2026-07-01',
        },
        policies_executed: ['leave-policy'],
        matched_rules: [
          { ruleId: 'rule-001', ruleName: 'Annual Leave Rule', priority: 1 },
        ],
        output: {
          approved: true,
          reason: 'Sufficient balance',
          daysApproved: 5,
        },
        confidence_score: 0.95,
        execution_time_ms: 42,
        version_snapshot: {
          version: 'v1.0.0',
          timestamp: '2026-06-01T00:00:00Z',
        },
      };

      // Replayed decision (with different policy - stricter)
      const replayedResult = {
        approved: false, // Changed!
        confidence: 0.9,
        matchedRules: [
          { ruleId: 'rule-001', ruleName: 'Annual Leave Rule', priority: 1 },
          { ruleId: 'rule-002', ruleName: 'Peak Season Rule', priority: 2 }, // New rule!
        ],
        metadata: {
          provider: 'LeaveEngine',
          executionTimeMs: 45, // Slightly slower
          policiesExecuted: ['leave-policy'],
        },
        output: {
          approved: false, // Changed!
          reason: 'Peak season restriction', // Changed!
          daysApproved: 0, // Changed!
        },
      };

      // Setup mocks
      const fromMock = mockSupabase.from();
      fromMock.single.mockResolvedValue({ data: originalDecision, error: null });
      mockEngine._mocks.evaluate.mockResolvedValue(replayedResult);

      // Create request
      const request = new NextRequest('http://localhost/api/decision-engine/replay/dec-001', {
        method: 'POST',
        body: JSON.stringify({
          policyVersion: 'v1.1.0',
          compareWithOriginal: true,
        }),
      });

      // Mock params
      const params = { id: 'dec-001' };

      // Execute
      const response = await POST(request, { params });
      const result = await response.json();

      // Assertions
      expect(result.success).toBe(true);
      expect(result.originalResult).toEqual({
        output: originalDecision.output,
        matchedRules: originalDecision.matched_rules,
        confidenceScore: originalDecision.confidence_score,
        executionTimeMs: originalDecision.execution_time_ms,
      });

      expect(result.replayedResult).toEqual({
        output: replayedResult.output,
        matchedRules: replayedResult.matchedRules,
        confidenceScore: replayedResult.confidence,
        executionTimeMs: replayedResult.metadata.executionTimeMs,
      });

      // Verify diff detection
      expect(result.diff).toMatchObject({
        outputChanged: true,
        changedFields: expect.arrayContaining(['approved', 'reason', 'daysApproved']),
        rulesChanged: true,
        addedRules: ['rule-002'],
        removedRules: [],
        confidenceChanged: true,
        confidenceDelta: expect.closeTo(-0.05, 2),
        executionTimeChanged: true,
        executionTimeDelta: 3,
      });

      expect(result.snapshot).toEqual({
        version: 'v1.0.0',
        timestamp: '2026-06-01T00:00:00Z',
      });
    });

    it('should detect when no changes occurred', async () => {
      const originalDecision = {
        id: 'dec-002',
        decision_type: 'discount-approval',
        input_context: { customerId: 'cust-001', discount: 10 },
        output: { approved: true, finalDiscount: 10 },
        matched_rules: [{ ruleId: 'r1', ruleName: 'Discount Rule', priority: 1 }],
        confidence_score: 1.0,
        execution_time_ms: 20,
        tenant_id: 'tenant-xyz',
      };

      // Replay produces identical result
      const replayedResult = {
        approved: true,
        confidence: 1.0,
        matchedRules: [{ ruleId: 'r1', ruleName: 'Discount Rule', priority: 1 }],
        metadata: {
          provider: 'DiscountEngine',
          executionTimeMs: 20,
        },
        output: { approved: true, finalDiscount: 10 },
      };

      const fromMock = mockSupabase.from();
      fromMock.single.mockResolvedValue({ data: originalDecision, error: null });
      mockEngine._mocks.evaluate.mockResolvedValue(replayedResult);

      const request = new NextRequest('http://localhost/api/decision-engine/replay/dec-002', {
        method: 'POST',
        body: JSON.stringify({ compareWithOriginal: true }),
      });

      const response = await POST(request, { params: { id: 'dec-002' } });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.diff).toMatchObject({
        outputChanged: false,
        changedFields: [],
        rulesChanged: false,
        addedRules: [],
        removedRules: [],
        confidenceChanged: false,
        executionTimeChanged: false,
      });
    });

    it('should handle complex nested output changes', async () => {
      const originalDecision = {
        id: 'dec-003',
        decision_type: 'salary-calculation',
        input_context: { employeeId: 'emp-789' },
        output: {
          baseSalary: 10000000,
          bonuses: {
            kpi: 2000000,
            performance: 1000000,
          },
          deductions: {
            violations: 500000,
          },
          totalSalary: 12500000,
        },
        matched_rules: [{ ruleId: 'sal-1', ruleName: 'Salary Rule', priority: 1 }],
        confidence_score: 0.98,
        execution_time_ms: 100,
        tenant_id: 'tenant-xyz',
      };

      const replayedResult = {
        approved: true,
        confidence: 0.98,
        matchedRules: [{ ruleId: 'sal-1', ruleName: 'Salary Rule', priority: 1 }],
        metadata: {
          provider: 'SalaryEngine',
          executionTimeMs: 100,
        },
        output: {
          baseSalary: 10000000,
          bonuses: {
            kpi: 2500000, // Changed!
            performance: 1000000,
          },
          deductions: {
            violations: 500000,
          },
          totalSalary: 13000000, // Changed!
        },
      };

      const fromMock = mockSupabase.from();
      fromMock.single.mockResolvedValue({ data: originalDecision, error: null });
      mockEngine._mocks.evaluate.mockResolvedValue(replayedResult);

      const request = new NextRequest('http://localhost/api/decision-engine/replay/dec-003', {
        method: 'POST',
        body: JSON.stringify({ compareWithOriginal: true }),
      });

      const response = await POST(request, { params: { id: 'dec-003' } });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.diff.outputChanged).toBe(true);
      expect(result.diff.changedFields).toEqual(
        expect.arrayContaining(['bonuses.kpi', 'totalSalary'])
      );
    });

    it('should handle rules added and removed simultaneously', async () => {
      const originalDecision = {
        id: 'dec-004',
        decision_type: 'multi-rule-test',
        input_context: { test: true },
        output: { result: 'original' },
        matched_rules: [
          { ruleId: 'r1', ruleName: 'Rule 1', priority: 1 },
          { ruleId: 'r2', ruleName: 'Rule 2', priority: 2 },
          { ruleId: 'r3', ruleName: 'Rule 3', priority: 3 },
        ],
        confidence_score: 0.9,
        execution_time_ms: 50,
        tenant_id: 'tenant-xyz',
      };

      const replayedResult = {
        approved: true,
        confidence: 0.9,
        matchedRules: [
          { ruleId: 'r1', ruleName: 'Rule 1', priority: 1 }, // Kept
          { ruleId: 'r4', ruleName: 'Rule 4', priority: 4 }, // Added
          { ruleId: 'r5', ruleName: 'Rule 5', priority: 5 }, // Added
        ],
        metadata: {
          provider: 'Engine',
          executionTimeMs: 50,
        },
        output: { result: 'original' },
      };

      const fromMock = mockSupabase.from();
      fromMock.single.mockResolvedValue({ data: originalDecision, error: null });
      mockEngine._mocks.evaluate.mockResolvedValue(replayedResult);

      const request = new NextRequest('http://localhost/api/decision-engine/replay/dec-004', {
        method: 'POST',
        body: JSON.stringify({ compareWithOriginal: true }),
      });

      const response = await POST(request, { params: { id: 'dec-004' } });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.diff.rulesChanged).toBe(true);
      expect(result.diff.addedRules).toEqual(['r4', 'r5']);
      expect(result.diff.removedRules).toEqual(['r2', 'r3']);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 when decision not found', async () => {
      const fromMock = mockSupabase.from();
      fromMock.single.mockResolvedValue({ data: null, error: { message: 'Not found' } });

      const request = new NextRequest('http://localhost/api/decision-engine/replay/invalid', {
        method: 'POST',
        body: JSON.stringify({ compareWithOriginal: true }),
      });

      const response = await POST(request, { params: { id: 'invalid' } });
      const result = await response.json();

      expect(response.status).toBe(404);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Decision not found');
    });

    it('should handle replay execution errors gracefully', async () => {
      const originalDecision = {
        id: 'dec-005',
        decision_type: 'error-test',
        input_context: { test: true },
        output: { result: 'ok' },
        matched_rules: [],
        confidence_score: 1.0,
        execution_time_ms: 10,
        tenant_id: 'tenant-xyz',
      };

      const fromMock = mockSupabase.from();
      fromMock.single.mockResolvedValue({ data: originalDecision, error: null });
      
      // Simulate replay failure
      mockEngine._mocks.evaluate.mockRejectedValue(new Error('Engine failure'));

      const request = new NextRequest('http://localhost/api/decision-engine/replay/dec-005', {
        method: 'POST',
        body: JSON.stringify({ compareWithOriginal: true }),
      });

      const response = await POST(request, { params: { id: 'dec-005' } });
      const result = await response.json();

      expect(response.status).toBe(500);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Failed to replay decision');
    });

    it('should validate request body', async () => {
      const request = new NextRequest('http://localhost/api/decision-engine/replay/dec-001', {
        method: 'POST',
        body: 'invalid json',
      });

      const response = await POST(request, { params: { id: 'dec-001' } });
      const result = await response.json();

      expect(response.status).toBe(400);
      expect(result.success).toBe(false);
    });
  });

  describe('Policy Version Comparison', () => {
    it('should use specified policy version for replay', async () => {
      const originalDecision = {
        id: 'dec-006',
        decision_type: 'version-test',
        input_context: { data: 'test' },
        output: { version: 'v1.0.0' },
        matched_rules: [],
        confidence_score: 1.0,
        execution_time_ms: 10,
        version_snapshot: {
          version: 'v1.0.0',
          timestamp: '2026-01-01T00:00:00Z',
        },
        tenant_id: 'tenant-xyz',
      };

      const fromMock = mockSupabase.from();
      fromMock.single.mockResolvedValue({ data: originalDecision, error: null });

      const replayedResult = {
        approved: true,
        confidence: 1.0,
        matchedRules: [],
        metadata: {
          provider: 'Engine',
          executionTimeMs: 10,
        },
        output: { version: 'v2.0.0' }, // Different version
      };

      mockEngine._mocks.evaluate.mockResolvedValue(replayedResult);

      const request = new NextRequest('http://localhost/api/decision-engine/replay/dec-006', {
        method: 'POST',
        body: JSON.stringify({
          policyVersion: 'v2.0.0',
          compareWithOriginal: true,
        }),
      });

      const response = await POST(request, { params: { id: 'dec-006' } });
      const result = await response.json();

      expect(result.success).toBe(true);
      
      // Verify Decision Engine was called with versionSnapshot
      expect(mockEngine._mocks.evaluate).toHaveBeenCalledWith(
        expect.objectContaining({
          versionSnapshot: expect.objectContaining({
            version: 'v2.0.0',
          }),
        })
      );
    });
  });

  describe('Performance and Metrics', () => {
    it('should track execution time changes accurately', async () => {
      const originalDecision = {
        id: 'dec-007',
        decision_type: 'perf-test',
        input_context: {},
        output: {},
        matched_rules: [],
        confidence_score: 1.0,
        execution_time_ms: 50,
        tenant_id: 'tenant-xyz',
      };

      const replayedResult = {
        approved: true,
        confidence: 1.0,
        matchedRules: [],
        metadata: {
          provider: 'Engine',
          executionTimeMs: 150, // 100ms slower
        },
        output: {},
      };

      const fromMock = mockSupabase.from();
      fromMock.single.mockResolvedValue({ data: originalDecision, error: null });
      mockEngine._mocks.evaluate.mockResolvedValue(replayedResult);

      const request = new NextRequest('http://localhost/api/decision-engine/replay/dec-007', {
        method: 'POST',
        body: JSON.stringify({ compareWithOriginal: true }),
      });

      const response = await POST(request, { params: { id: 'dec-007' } });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.diff.executionTimeChanged).toBe(true);
      expect(result.diff.executionTimeDelta).toBe(100);
    });

    it('should track confidence score changes with precision', async () => {
      const originalDecision = {
        id: 'dec-008',
        decision_type: 'confidence-test',
        input_context: {},
        output: {},
        matched_rules: [],
        confidence_score: 0.876,
        execution_time_ms: 10,
        tenant_id: 'tenant-xyz',
      };

      const replayedResult = {
        approved: true,
        confidence: 0.912,
        matchedRules: [],
        metadata: {
          provider: 'Engine',
          executionTimeMs: 10,
        },
        output: {},
      };

      const fromMock = mockSupabase.from();
      fromMock.single.mockResolvedValue({ data: originalDecision, error: null });
      mockEngine._mocks.evaluate.mockResolvedValue(replayedResult);

      const request = new NextRequest('http://localhost/api/decision-engine/replay/dec-008', {
        method: 'POST',
        body: JSON.stringify({ compareWithOriginal: true }),
      });

      const response = await POST(request, { params: { id: 'dec-008' } });
      const result = await response.json();

      expect(result.success).toBe(true);
      expect(result.diff.confidenceChanged).toBe(true);
      expect(result.diff.confidenceDelta).toBeCloseTo(0.036, 3);
    });
  });
});
