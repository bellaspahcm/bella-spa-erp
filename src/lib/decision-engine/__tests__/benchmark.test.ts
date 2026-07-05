/**
 * Decision Engine Benchmark Tests
 * 
 * Validates audit logging overhead is acceptable for production use.
 * 
 * Acceptance Criteria:
 * - Audit overhead < 10% of execution time
 * - No memory leaks after 10,000 decisions
 * - Throughput > 500 decisions/second
 * 
 * Run with: npm test -- benchmark.test.ts --runInBand
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { DecisionEngine } from '../core/DecisionEngine';
import { DecisionAuditLogger } from '../audit/DecisionAuditLogger';
import type { DecisionContext, DecisionResult, Policy } from '../types';
import type { SupabaseClient } from '@supabase/supabase-js';

// Mock Supabase for benchmark (no actual DB I/O)
const createMockSupabaseClient = () => {
  const mockInsert = jest.fn().mockResolvedValue({ data: null, error: null });
  const mockFrom = jest.fn(() => ({
    insert: mockInsert,
  }));

  return {
    from: mockFrom,
    _mocks: { insert: mockInsert },
  } as any;
};

describe('Decision Engine Benchmark', () => {
  const ITERATIONS = 1000; // Warm-up + measurement iterations
  const WARMUP_ITERATIONS = 100; // Warm-up to avoid JIT compilation effects

  let engineWithoutAudit: DecisionEngine;
  let engineWithAudit: DecisionEngine;
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  // Sample policy for testing
  const testPolicy: Policy = {
    name: 'benchmark-policy',
    rules: [
      {
        id: 'rule-1',
        name: 'Always Approve',
        priority: 1,
        conditions: [],
        actions: [
          {
            type: 'set-output',
            field: 'approved',
            value: true,
          },
        ],
      },
    ],
  };

  beforeAll(() => {
    mockSupabase = createMockSupabaseClient();

    // Engine without audit
    engineWithoutAudit = new DecisionEngine({
      policies: { 'benchmark-module': [testPolicy] },
    });

    // Engine with audit
    const auditLogger = new DecisionAuditLogger(mockSupabase as unknown as SupabaseClient);
    engineWithAudit = new DecisionEngine({
      policies: { 'benchmark-module': [testPolicy] },
      auditLogger,
    });
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  /**
   * Benchmark 1: Audit Overhead
   * 
   * Measures execution time difference between:
   * - Decision Engine without audit logging
   * - Decision Engine with audit logging
   * 
   * Target: Overhead < 10%
   */
  it('should have audit overhead < 10%', async () => {
    const context: DecisionContext = {
      decisionType: 'benchmark-test',
      input: {
        test: true,
        data: { value: 123 },
      },
      tenantId: 'benchmark-tenant',
      userId: 'benchmark-user',
    };

    // Warm-up phase (avoid JIT compilation bias)
    console.log('\n🔥 Warming up...');
    for (let i = 0; i < WARMUP_ITERATIONS; i++) {
      await engineWithoutAudit.evaluate(context);
      await engineWithAudit.evaluate(context);
    }

    // Benchmark without audit
    console.log('\n⏱️  Benchmarking WITHOUT audit...');
    const startWithoutAudit = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await engineWithoutAudit.evaluate(context);
    }
    const endWithoutAudit = performance.now();
    const timeWithoutAudit = endWithoutAudit - startWithoutAudit;
    const avgWithoutAudit = timeWithoutAudit / ITERATIONS;

    // Benchmark with audit
    console.log('⏱️  Benchmarking WITH audit...');
    const startWithAudit = performance.now();
    for (let i = 0; i < ITERATIONS; i++) {
      await engineWithAudit.evaluate(context);
    }
    const endWithAudit = performance.now();
    const timeWithAudit = endWithAudit - startWithAudit;
    const avgWithAudit = timeWithAudit / ITERATIONS;

    // Calculate overhead
    const overhead = ((avgWithAudit - avgWithoutAudit) / avgWithoutAudit) * 100;

    console.log('\n📊 Benchmark Results:');
    console.log(`   Without Audit: ${avgWithoutAudit.toFixed(3)}ms per decision`);
    console.log(`   With Audit:    ${avgWithAudit.toFixed(3)}ms per decision`);
    console.log(`   Overhead:      ${overhead.toFixed(2)}%`);
    console.log(`   Iterations:    ${ITERATIONS}`);

    // Assertion: Overhead must be < 10%
    expect(overhead).toBeLessThan(10);
    console.log(`\n✅ PASS: Audit overhead (${overhead.toFixed(2)}%) < 10%\n`);
  });

  /**
   * Benchmark 2: Throughput
   * 
   * Measures decisions per second with audit enabled.
   * 
   * Target: > 500 decisions/second
   */
  it('should process > 500 decisions/second with audit', async () => {
    const context: DecisionContext = {
      decisionType: 'throughput-test',
      input: { test: true },
      tenantId: 'throughput-tenant',
    };

    const testDuration = 1000; // 1 second
    const start = performance.now();
    let count = 0;

    console.log('\n🚀 Throughput test (1 second)...');

    // Run as many decisions as possible in 1 second
    while (performance.now() - start < testDuration) {
      await engineWithAudit.evaluate(context);
      count++;
    }

    const decisionsPerSecond = count;

    console.log('\n📊 Throughput Results:');
    console.log(`   Decisions/second: ${decisionsPerSecond}`);
    console.log(`   Duration:         ${testDuration}ms`);

    // Assertion: Throughput must be > 500/s
    expect(decisionsPerSecond).toBeGreaterThan(500);
    console.log(`\n✅ PASS: Throughput (${decisionsPerSecond}/s) > 500/s\n`);
  });

  /**
   * Benchmark 3: Memory Usage
   * 
   * Checks for memory leaks after processing many decisions.
   * 
   * Target: Memory increase < 50MB after 10,000 decisions
   */
  it('should not leak memory after 10,000 decisions', async () => {
    const context: DecisionContext = {
      decisionType: 'memory-test',
      input: { test: true },
      tenantId: 'memory-tenant',
    };

    // Force garbage collection if available (run with --expose-gc)
    if (global.gc) {
      global.gc();
    }

    // Measure initial memory
    const initialMemory = process.memoryUsage().heapUsed;

    console.log('\n💾 Memory leak test (10,000 decisions)...');
    console.log(`   Initial heap: ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);

    // Process 10,000 decisions
    const iterations = 10000;
    for (let i = 0; i < iterations; i++) {
      await engineWithAudit.evaluate(context);
      
      // Log progress every 2000 iterations
      if ((i + 1) % 2000 === 0) {
        console.log(`   Processed ${i + 1}/${iterations} decisions...`);
      }
    }

    // Force garbage collection again
    if (global.gc) {
      global.gc();
    }

    // Measure final memory
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    const memoryIncreaseMB = memoryIncrease / 1024 / 1024;

    console.log('\n📊 Memory Results:');
    console.log(`   Initial heap:  ${(initialMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Final heap:    ${(finalMemory / 1024 / 1024).toFixed(2)} MB`);
    console.log(`   Increase:      ${memoryIncreaseMB.toFixed(2)} MB`);
    console.log(`   Iterations:    ${iterations}`);

    // Assertion: Memory increase < 50MB
    expect(memoryIncreaseMB).toBeLessThan(50);
    console.log(`\n✅ PASS: Memory increase (${memoryIncreaseMB.toFixed(2)} MB) < 50 MB\n`);
  }, 60000); // 60 second timeout

  /**
   * Benchmark 4: Concurrent Decisions
   * 
   * Measures performance under concurrent load.
   * 
   * Target: 100 concurrent decisions complete in < 1 second
   */
  it('should handle 100 concurrent decisions in < 1 second', async () => {
    const concurrentCount = 100;
    const contexts: DecisionContext[] = Array.from({ length: concurrentCount }, (_, i) => ({
      decisionType: 'concurrent-test',
      input: { index: i, test: true },
      tenantId: 'concurrent-tenant',
      userId: `user-${i}`,
    }));

    console.log(`\n⚡ Concurrent test (${concurrentCount} decisions)...`);

    const start = performance.now();
    
    // Execute all decisions concurrently
    await Promise.all(
      contexts.map(ctx => engineWithAudit.evaluate(ctx))
    );

    const duration = performance.now() - start;

    console.log('\n📊 Concurrent Results:');
    console.log(`   Concurrent decisions: ${concurrentCount}`);
    console.log(`   Total duration:       ${duration.toFixed(2)}ms`);
    console.log(`   Avg per decision:     ${(duration / concurrentCount).toFixed(3)}ms`);

    // Assertion: 100 concurrent decisions < 1 second
    expect(duration).toBeLessThan(1000);
    console.log(`\n✅ PASS: ${concurrentCount} concurrent decisions in ${duration.toFixed(2)}ms < 1000ms\n`);
  });

  /**
   * Benchmark 5: Complex Decision Performance
   * 
   * Measures performance with more realistic complex decisions.
   */
  it('should handle complex decisions efficiently', async () => {
    // Complex policy with multiple rules and conditions
    const complexPolicy: Policy = {
      name: 'complex-policy',
      rules: [
        {
          id: 'rule-1',
          name: 'High Value Check',
          priority: 1,
          conditions: [
            { field: 'amount', operator: '>', value: 1000000 },
            { field: 'customerTier', operator: '===', value: 'VIP' },
          ],
          actions: [
            { type: 'set-output', field: 'requiresApproval', value: true },
            { type: 'set-output', field: 'approvalLevel', value: 'DIRECTOR' },
          ],
        },
        {
          id: 'rule-2',
          name: 'Medium Value Check',
          priority: 2,
          conditions: [
            { field: 'amount', operator: '>', value: 500000 },
          ],
          actions: [
            { type: 'set-output', field: 'requiresApproval', value: true },
            { type: 'set-output', field: 'approvalLevel', value: 'MANAGER' },
          ],
        },
        {
          id: 'rule-3',
          name: 'Auto Approve',
          priority: 3,
          conditions: [
            { field: 'amount', operator: '<=', value: 500000 },
          ],
          actions: [
            { type: 'set-output', field: 'requiresApproval', value: false },
            { type: 'set-output', field: 'approved', value: true },
          ],
        },
      ],
    };

    const complexEngine = new DecisionEngine({
      policies: { 'complex-module': [complexPolicy] },
      auditLogger: new DecisionAuditLogger(mockSupabase as unknown as SupabaseClient),
    });

    const context: DecisionContext = {
      decisionType: 'discount-approval',
      input: {
        amount: 750000,
        customerTier: 'REGULAR',
        discount: 15,
        customerId: 'cust-123',
      },
      tenantId: 'complex-tenant',
    };

    console.log('\n🔧 Complex decision benchmark...');

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      await complexEngine.evaluate(context);
    }

    const duration = performance.now() - start;
    const avg = duration / iterations;

    console.log('\n📊 Complex Decision Results:');
    console.log(`   Avg execution:  ${avg.toFixed(3)}ms`);
    console.log(`   Total duration: ${duration.toFixed(2)}ms`);
    console.log(`   Iterations:     ${iterations}`);

    // Assertion: Complex decisions < 10ms average
    expect(avg).toBeLessThan(10);
    console.log(`\n✅ PASS: Complex decisions (${avg.toFixed(3)}ms) < 10ms\n`);
  });
});
