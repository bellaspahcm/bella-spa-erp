/**
 * Decision Engine Performance Benchmark Script
 * 
 * Runs performance benchmarks and generates investor-grade report.
 * 
 * Usage: npx tsx scripts/benchmark-decision-engine.ts
 */

import { evaluateBookingApproval, type BookingDecisionInput } from '../src/services/booking-decision-service';
import { metricsCollector } from '../src/lib/decision-engine/observability';

async function runBenchmark(name: string, count: number, targetAvg: number, targetP95: number) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📊 Benchmark: ${name} (${count} decisions)`);
  console.log(`${'='.repeat(60)}`);

  const executionTimes: number[] = [];
  const startTime = Date.now();

  for (let i = 0; i < count; i++) {
    const decisionStart = performance.now();

    const input: BookingDecisionInput = {
      totalAmount: Math.random() * 50000000, // 0-50M VND
      customer: {
        id: `cust-${i}`,
        status: ['new', 'active', 'vip'][Math.floor(Math.random() * 3)] as 'new' | 'active' | 'vip',
        completedBookingsCount: Math.floor(Math.random() * 100),
      },
      tenantId: 'benchmark-test',
    };

    await evaluateBookingApproval(input);

    const decisionEnd = performance.now();
    executionTimes.push(decisionEnd - decisionStart);
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
  const throughput = count / (totalTime / 1000);

  // Get metrics from collector
  const aggregated = metricsCollector.aggregate({
    tenantId: 'benchmark-test',
  });

  // Print results
  console.log(`\n⏱️  Performance Metrics:`);
  console.log(`   Total Time: ${totalTime}ms`);
  console.log(`   Average: ${average.toFixed(2)}ms (target: <${targetAvg}ms)`);
  console.log(`   Median (p50): ${p50.toFixed(2)}ms`);
  console.log(`   p95: ${p95.toFixed(2)}ms (target: <${targetP95}ms)`);
  console.log(`   p99: ${p99.toFixed(2)}ms`);
  console.log(`   Min: ${min.toFixed(2)}ms`);
  console.log(`   Max: ${max.toFixed(2)}ms`);
  console.log(`   Throughput: ${throughput.toFixed(2)} decisions/sec`);

  console.log(`\n📈 Decision Outcomes:`);
  console.log(`   Auto Approval Rate: ${(aggregated.autoApprovalRate * 100).toFixed(2)}%`);
  console.log(`   Rejection Rate: ${(aggregated.rejectionRate * 100).toFixed(2)}%`);
  console.log(`   Manual Review Rate: ${(aggregated.manualReviewRate * 100).toFixed(2)}%`);
  console.log(`   Average Confidence: ${(aggregated.averageConfidence * 100).toFixed(2)}%`);
  console.log(`   Error Rate: ${(aggregated.errorRate * 100).toFixed(2)}%`);

  console.log(`\n✅ Target Validation:`);
  const avgPass = average < targetAvg;
  const p95Pass = p95 < targetP95;
  console.log(`   Average <${targetAvg}ms: ${avgPass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`   P95 <${targetP95}ms: ${p95Pass ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`   Zero Errors: ${aggregated.errorRate === 0 ? '✓ PASS' : '✗ FAIL'}`);

  return {
    count,
    totalTime,
    average,
    p50,
    p95,
    p99,
    min,
    max,
    throughput,
    autoApprovalRate: aggregated.autoApprovalRate,
    rejectionRate: aggregated.rejectionRate,
    manualReviewRate: aggregated.manualReviewRate,
    averageConfidence: aggregated.averageConfidence,
    errorRate: aggregated.errorRate,
    targetsMet: avgPass && p95Pass && aggregated.errorRate === 0,
  };
}

async function main() {
  console.log('\n🚀 Decision Engine Performance Benchmarks');
  console.log(`   Version: 1.0.0`);
  console.log(`   Date: ${new Date().toISOString()}`);
  console.log(`   Platform: ${process.platform}`);
  console.log(`   Node: ${process.version}`);

  // Clear metrics before benchmarks
  metricsCollector.clear();

  // Run benchmarks
  const results = {
    benchmark100: await runBenchmark('100 Decisions', 100, 15, 50),
    benchmark500: await runBenchmark('500 Decisions', 500, 20, 60),
    benchmark1000: await runBenchmark('1000 Decisions', 1000, 25, 80),
  };

  // Memory benchmark
  console.log(`\n${'='.repeat(60)}`);
  console.log(`💾 Memory Benchmark`);
  console.log(`${'='.repeat(60)}`);

  if (global.gc) global.gc();
  const baselineMemory = process.memoryUsage();

  metricsCollector.clear();

  for (let i = 0; i < 1000; i++) {
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

  const peakMemory = process.memoryUsage();
  const heapUsedMB = (peakMemory.heapUsed - baselineMemory.heapUsed) / 1024 / 1024;
  const rssUsedMB = (peakMemory.rss - baselineMemory.rss) / 1024 / 1024;

  console.log(`\n   Baseline Heap: ${(baselineMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Peak Heap: ${(peakMemory.heapUsed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   Heap Increase: ${heapUsedMB.toFixed(2)} MB`);
  console.log(`   RSS Increase: ${rssUsedMB.toFixed(2)} MB`);
  console.log(`   Memory per Decision: ${(heapUsedMB * 1024 / 1000).toFixed(2)} KB`);
  console.log(`\n✅ Target Validation:`);
  console.log(`   Heap <50MB for 1000 decisions: ${heapUsedMB < 50 ? '✓ PASS' : '✗ FAIL'}`);

  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log(`📋 Performance Summary`);
  console.log(`${'='.repeat(60)}`);

  console.log(`\n🎯 All Benchmarks:`);
  console.log(`   100 decisions: ${results.benchmark100.average.toFixed(2)}ms avg, ${results.benchmark100.p95.toFixed(2)}ms p95 - ${results.benchmark100.targetsMet ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`   500 decisions: ${results.benchmark500.average.toFixed(2)}ms avg, ${results.benchmark500.p95.toFixed(2)}ms p95 - ${results.benchmark500.targetsMet ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`   1000 decisions: ${results.benchmark1000.average.toFixed(2)}ms avg, ${results.benchmark1000.p95.toFixed(2)}ms p95 - ${results.benchmark1000.targetsMet ? '✓ PASS' : '✗ FAIL'}`);
  console.log(`   Memory: ${heapUsedMB.toFixed(2)} MB - ${heapUsedMB < 50 ? '✓ PASS' : '✗ FAIL'}`);

  const allPass = 
    results.benchmark100.targetsMet &&
    results.benchmark500.targetsMet &&
    results.benchmark1000.targetsMet &&
    heapUsedMB < 50;

  console.log(`\n🏆 Overall Result: ${allPass ? '✅ ALL TARGETS MET' : '❌ SOME TARGETS MISSED'}`);
  console.log(`${'='.repeat(60)}\n`);

  // Export JSON report
  const report = {
    metadata: {
      version: '1.0.0',
      date: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
    },
    benchmarks: {
      small: results.benchmark100,
      medium: results.benchmark500,
      large: results.benchmark1000,
    },
    memory: {
      baselineHeapMB: baselineMemory.heapUsed / 1024 / 1024,
      peakHeapMB: peakMemory.heapUsed / 1024 / 1024,
      heapIncreaseMB: heapUsedMB,
      rssIncreaseMB: rssUsedMB,
      memoryPerDecisionKB: heapUsedMB * 1024 / 1000,
      targetMet: heapUsedMB < 50,
    },
    summary: {
      allTargetsMet: allPass,
    },
  };

  const fs = await import('fs/promises');
  await fs.writeFile(
    'benchmark-results.json',
    JSON.stringify(report, null, 2)
  );

  console.log(`📄 Detailed report saved to: benchmark-results.json\n`);
}

main().catch(console.error);
