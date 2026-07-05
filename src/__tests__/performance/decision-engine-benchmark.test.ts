/**
 * Decision Engine Performance Benchmark
 * 
 * Measures Decision Engine performance with real-world scenarios.
 * Provides investor-grade performance data.
 * 
 * Benchmarks:
 * - 100 decisions (small scale)
 * - 500 decisions (medium scale)
 * - 1000 decisions (large scale)
 * 
 * Metrics:
 * - Average execution time
 * - p50, p95, p99 latency
 * - Memory usage
 * - Cache impact
 * 
 * @module Tests/Performance/DecisionEngine
 */

import { bootstrapForTesting, type DecisionContext } from '@/lib/decision-engine';
import { metricsCollector } from '@/lib/decision-engine/observability';
import { evaluateBookingApproval, type BookingDecisionInput } from '@/services/booking-decision-service';

describe('Decision Engine Performance Benchmarks', () => {
  beforeEach(() => {
    // Clear metrics before each test
    metricsCollector.clear();
  });

  /**
   * Benchmark: 100 decisions
   * Target: <15ms average, <50ms p95
   */
  it('should handle 100 booking approval decisions efficiently', async () => {
    const COUNT = 100;
    const startTime = Date.now();
    const executionTimes: number[] = [];

    // Generate 100 random booking decisions
    for (let i = 0; i < COUNT; i++) {
      const decisionStartTime = performance.now();

      const input: BookingDecisionInput = {
        totalAmount: Math.random() * 50000000, // 0 - 50M
        customer: {
          id: `cust-${i}`,
          status: ['new', 'active', 'vip'][Math.floor(Math.random() * 3)] as 'new' | 'active' | 'vip',
          completedBookingsCount: Math.floor(Math.random() * 100),
        },
        tenantId: 'benchmark-test',
      };

      await evaluateBookingApproval(input);

      const decisionEndTime = performance.now();
      executionTimes.push(decisionEndTime - decisionStartTime);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Calculate statistics
    const sorted = executionTimes.sort((a, b) => a - b);
    const average = executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    // Get metrics from collector
    const aggregated = metricsCollector.aggregate({
      tenantId: 'benchmark-test',
    });

    // Report results
    console.log('\n📊 Benchmark: 100 Decisions');
    console.log('─'.repeat(50));
    console.log(`Total Time: ${totalTime}ms`);
    console.log(`Average: ${average.toFixed(2)}ms`);
    console.log(`Median (p50): ${p50.toFixed(2)}ms`);
    console.log(`p95: ${p95.toFixed(2)}ms`);
    console.log(`p99: ${p99.toFixed(2)}ms`);
    console.log(`Min: ${min.toFixed(2)}ms`);
    console.log(`Max: ${max.toFixed(2)}ms`);
    console.log(`Throughput: ${(COUNT / (totalTime / 1000)).toFixed(2)} decisions/sec`);
    console.log('\n📈 Metrics from Collector:');
    console.log(`Auto Approval Rate: ${(aggregated.autoApprovalRate * 100).toFixed(2)}%`);
    console.log(`Rejection Rate: ${(aggregated.rejectionRate * 100).toFixed(2)}%`);
    console.log(`Manual Review Rate: ${(aggregated.manualReviewRate * 100).toFixed(2)}%`);
    console.log(`Average Confidence: ${(aggregated.averageConfidence * 100).toFixed(2)}%`);
    console.log('─'.repeat(50));

    // Assertions (performance targets)
    expect(average).toBeLessThan(15); // Target: <15ms average
    expect(p95).toBeLessThan(50); // Target: <50ms p95
    expect(aggregated.errorRate).toBe(0); // No errors
  }, 30000); // 30s timeout

  /**
   * Benchmark: 500 decisions
   * Target: <20ms average, <60ms p95
   */
  it('should handle 500 booking approval decisions efficiently', async () => {
    const COUNT = 500;
    const startTime = Date.now();
    const executionTimes: number[] = [];

    for (let i = 0; i < COUNT; i++) {
      const decisionStartTime = performance.now();

      const input: BookingDecisionInput = {
        totalAmount: Math.random() * 50000000,
        customer: {
          id: `cust-${i}`,
          status: ['new', 'active', 'vip'][Math.floor(Math.random() * 3)] as 'new' | 'active' | 'vip',
          completedBookingsCount: Math.floor(Math.random() * 100),
        },
        tenantId: 'benchmark-test',
      };

      await evaluateBookingApproval(input);

      const decisionEndTime = performance.now();
      executionTimes.push(decisionEndTime - decisionStartTime);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Calculate statistics
    const sorted = executionTimes.sort((a, b) => a - b);
    const average = executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    // Get metrics from collector
    const aggregated = metricsCollector.aggregate({
      tenantId: 'benchmark-test',
    });

    // Report results
    console.log('\n📊 Benchmark: 500 Decisions');
    console.log('─'.repeat(50));
    console.log(`Total Time: ${totalTime}ms`);
    console.log(`Average: ${average.toFixed(2)}ms`);
    console.log(`Median (p50): ${p50.toFixed(2)}ms`);
    console.log(`p95: ${p95.toFixed(2)}ms`);
    console.log(`p99: ${p99.toFixed(2)}ms`);
    console.log(`Throughput: ${(COUNT / (totalTime / 1000)).toFixed(2)} decisions/sec`);
    console.log('\n📈 Metrics:');
    console.log(`Auto Approval Rate: ${(aggregated.autoApprovalRate * 100).toFixed(2)}%`);
    console.log(`Rejection Rate: ${(aggregated.rejectionRate * 100).toFixed(2)}%`);
    console.log(`Average Confidence: ${(aggregated.averageConfidence * 100).toFixed(2)}%`);
    console.log('─'.repeat(50));

    // Assertions
    expect(average).toBeLessThan(20);
    expect(p95).toBeLessThan(60);
    expect(aggregated.errorRate).toBe(0);
  }, 60000); // 60s timeout

  /**
   * Benchmark: 1000 decisions
   * Target: <25ms average, <80ms p95
   */
  it('should handle 1000 booking approval decisions efficiently', async () => {
    const COUNT = 1000;
    const startTime = Date.now();
    const executionTimes: number[] = [];

    for (let i = 0; i < COUNT; i++) {
      const decisionStartTime = performance.now();

      const input: BookingDecisionInput = {
        totalAmount: Math.random() * 50000000,
        customer: {
          id: `cust-${i}`,
          status: ['new', 'active', 'vip'][Math.floor(Math.random() * 3)] as 'new' | 'active' | 'vip',
          completedBookingsCount: Math.floor(Math.random() * 100),
        },
        tenantId: 'benchmark-test',
      };

      await evaluateBookingApproval(input);

      const decisionEndTime = performance.now();
      executionTimes.push(decisionEndTime - decisionStartTime);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Calculate statistics
    const sorted = executionTimes.sort((a, b) => a - b);
    const average = executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];

    // Get metrics from collector
    const aggregated = metricsCollector.aggregate({
      tenantId: 'benchmark-test',
    });

    // Report results
    console.log('\n📊 Benchmark: 1000 Decisions');
    console.log('─'.repeat(50));
    console.log(`Total Time: ${totalTime}ms`);
    console.log(`Average: ${average.toFixed(2)}ms`);
    console.log(`Median (p50): ${p50.toFixed(2)}ms`);
    console.log(`p95: ${p95.toFixed(2)}ms`);
    console.log(`p99: ${p99.toFixed(2)}ms`);
    console.log(`Throughput: ${(COUNT / (totalTime / 1000)).toFixed(2)} decisions/sec`);
    console.log('\n📈 Metrics:');
    console.log(`Auto Approval Rate: ${(aggregated.autoApprovalRate * 100).toFixed(2)}%`);
    console.log(`Rejection Rate: ${(aggregated.rejectionRate * 100).toFixed(2)}%`);
    console.log(`Average Confidence: ${(aggregated.averageConfidence * 100).toFixed(2)}%`);
    console.log('─'.repeat(50));

    // Assertions
    expect(average).toBeLessThan(25);
    expect(p95).toBeLessThan(80);
    expect(aggregated.errorRate).toBe(0);
  }, 120000); // 120s timeout

  /**
   * Memory benchmark
   * Measures memory usage for 1000 decisions
   */
  it('should maintain reasonable memory usage', async () => {
    const COUNT = 1000;

    // Get baseline memory
    if (global.gc) global.gc();
    const baselineMemory = process.memoryUsage();

    // Run decisions
    for (let i = 0; i < COUNT; i++) {
      const input: BookingDecisionInput = {
        totalAmount: Math.random() * 50000000,
        customer: {
          id: `cust-${i}`,
          status: 'active',
          completedBookingsCount: 10,
        },
        tenantId: 'benchmark-test',
      };

      await evaluateBookingApproval(input);
    }

    // Measure peak memory
    const peakMemory = process.memoryUsage();

    // Calculate memory increase
    const heapUsedMB = (peakMemory.heapUsed - baselineMemory.heapUsed) / 1024 / 1024;
    const rssUsedMB = (peakMemory.rss - baselineMemory.rss) / 1024 / 1024;

    console.log('\n💾 Memory Benchmark: 1000 Decisions');
    console.log('─'.repeat(50));
    console.log(`Baseline Heap: ${(baselineMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Peak Heap: ${(peakMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Heap Increase: ${heapUsedMB.toFixed(2)} MB`);
    console.log(`RSS Increase: ${rssUsedMB.toFixed(2)} MB`);
    console.log(`Memory per Decision: ${(heapUsedMB * 1024 / COUNT).toFixed(2)} KB`);
    console.log('─'.repeat(50));

    // Assertion: Memory should not grow excessively
    expect(heapUsedMB).toBeLessThan(50); // <50MB for 1000 decisions
  }, 120000);
});
