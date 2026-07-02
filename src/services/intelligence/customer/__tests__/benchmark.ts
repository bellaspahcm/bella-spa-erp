/**
 * Performance Benchmarks for Customer Intelligence
 * 
 * Measures query performance, cache effectiveness, and throughput
 * for Customer Intelligence operations.
 * 
 * Run with: npx ts-node src/services/intelligence/customer/__tests__/benchmark.ts
 * 
 * Metrics tracked:
 * - Query execution time (p50, p95, p99)
 * - Cache hit rate
 * - Throughput (queries/second)
 * - Memory usage
 * 
 * Prerequisites:
 * - Test database with sample data
 * - Environment variables configured
 */

import { CustomerIntelligenceService } from '../service';
import { MemoryCacheService } from '../../cache/memory-cache';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

const TEST_TENANT_ID = process.env.TEST_TENANT_ID || 'test-tenant-id';
const WARMUP_ITERATIONS = 10;
const BENCHMARK_ITERATIONS = 100;

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function calculatePercentile(values: number[], percentile: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

function formatDuration(ms: number): string {
  if (ms < 1) return `${(ms * 1000).toFixed(2)}μs`;
  if (ms < 1000) return `${ms.toFixed(2)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatMemory(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)}MB`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Benchmark Runner
// ─────────────────────────────────────────────────────────────────────────────

async function benchmark(
  name: string,
  fn: () => Promise<any>,
  iterations: number = BENCHMARK_ITERATIONS
): Promise<void> {
  console.log(`\n📊 Running benchmark: ${name}`);
  console.log(`   Iterations: ${iterations}`);

  const durations: number[] = [];
  const startMemory = process.memoryUsage().heapUsed;

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    await fn();
    const duration = performance.now() - start;
    durations.push(duration);

    if ((i + 1) % 10 === 0) {
      process.stdout.write(`\r   Progress: ${i + 1}/${iterations}`);
    }
  }

  const endMemory = process.memoryUsage().heapUsed;
  const memoryDelta = endMemory - startMemory;

  console.log(`\n   ✓ Complete`);
  console.log(`\n   Results:`);
  console.log(`   - p50 (median): ${formatDuration(calculatePercentile(durations, 50))}`);
  console.log(`   - p95:          ${formatDuration(calculatePercentile(durations, 95))}`);
  console.log(`   - p99:          ${formatDuration(calculatePercentile(durations, 99))}`);
  console.log(`   - min:          ${formatDuration(Math.min(...durations))}`);
  console.log(`   - max:          ${formatDuration(Math.max(...durations))}`);
  console.log(`   - avg:          ${formatDuration(durations.reduce((a, b) => a + b, 0) / durations.length)}`);
  console.log(`   - memory Δ:     ${formatMemory(memoryDelta)}`);
  console.log(`   - throughput:   ${(1000 / (durations.reduce((a, b) => a + b, 0) / durations.length)).toFixed(2)} ops/sec`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Benchmark Suite
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║     Customer Intelligence Performance Benchmarks                 ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');

  const cache = new MemoryCacheService();
  const service = new CustomerIntelligenceService(cache);

  console.log(`\n🔧 Configuration:`);
  console.log(`   - Tenant ID: ${TEST_TENANT_ID}`);
  console.log(`   - Warmup Iterations: ${WARMUP_ITERATIONS}`);
  console.log(`   - Benchmark Iterations: ${BENCHMARK_ITERATIONS}`);

  // ───────────────────────────────────────────────────────────────────────────
  // Warmup
  // ───────────────────────────────────────────────────────────────────────────

  console.log(`\n🔥 Warming up...`);
  for (let i = 0; i < WARMUP_ITERATIONS; i++) {
    await service.getCustomerSegmentation(TEST_TENANT_ID);
    process.stdout.write(`\r   Progress: ${i + 1}/${WARMUP_ITERATIONS}`);
  }
  console.log(`\n   ✓ Warmup complete`);

  // ───────────────────────────────────────────────────────────────────────────
  // Benchmarks
  // ───────────────────────────────────────────────────────────────────────────

  // 1. Customer Segmentation (Cache Hit)
  await benchmark(
    'Customer Segmentation (Cache Hit)',
    () => service.getCustomerSegmentation(TEST_TENANT_ID)
  );

  // 2. Customer Segmentation (Cache Miss)
  await benchmark(
    'Customer Segmentation (Cache Miss)',
    async () => {
      await service.clearCache(TEST_TENANT_ID);
      return service.getCustomerSegmentation(TEST_TENANT_ID);
    },
    Math.floor(BENCHMARK_ITERATIONS / 10) // Fewer iterations to avoid too many DB hits
  );

  // 3. Customer LTV (Cache Hit)
  await benchmark(
    'Customer LTV (Cache Hit)',
    () => service.getCustomerLTV(TEST_TENANT_ID)
  );

  // 4. Churn Risk Analysis (Cache Hit)
  await benchmark(
    'Churn Risk Analysis (Cache Hit)',
    () => service.getChurnRiskAnalysis(TEST_TENANT_ID)
  );

  // 5. RFM Analysis (Cache Hit)
  await benchmark(
    'RFM Analysis (Cache Hit)',
    () => service.getRFMAnalysis(TEST_TENANT_ID)
  );

  // 6. Segment Distribution (Cache Hit)
  await benchmark(
    'Segment Distribution (Cache Hit)',
    () => service.getSegmentDistribution(TEST_TENANT_ID)
  );

  // 7. Cohort Analysis (Cache Hit)
  await benchmark(
    'Cohort Analysis (Cache Hit)',
    () => service.getCohortAnalysis(TEST_TENANT_ID)
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Cache Effectiveness Test
  // ───────────────────────────────────────────────────────────────────────────

  console.log(`\n\n📈 Cache Effectiveness Test`);
  
  let cacheHits = 0;
  let cacheMisses = 0;

  await service.clearCache(TEST_TENANT_ID);

  for (let i = 0; i < 50; i++) {
    const result = await service.getCustomerSegmentation(TEST_TENANT_ID);
    if (result.metadata.cacheHit) {
      cacheHits++;
    } else {
      cacheMisses++;
    }
  }

  const hitRate = (cacheHits / (cacheHits + cacheMisses)) * 100;
  console.log(`\n   Results:`);
  console.log(`   - Cache Hits:   ${cacheHits}`);
  console.log(`   - Cache Misses: ${cacheMisses}`);
  console.log(`   - Hit Rate:     ${hitRate.toFixed(2)}%`);

  // ───────────────────────────────────────────────────────────────────────────
  // Concurrent Requests Test
  // ───────────────────────────────────────────────────────────────────────────

  console.log(`\n\n🔀 Concurrent Requests Test (10 parallel queries)`);
  
  const concurrentStart = performance.now();
  const promises = Array(10)
    .fill(null)
    .map(() => service.getCustomerSegmentation(TEST_TENANT_ID));

  await Promise.all(promises);
  const concurrentDuration = performance.now() - concurrentStart;

  console.log(`\n   Results:`);
  console.log(`   - Total Time:   ${formatDuration(concurrentDuration)}`);
  console.log(`   - Avg per req:  ${formatDuration(concurrentDuration / 10)}`);

  // ───────────────────────────────────────────────────────────────────────────
  // Churn Risk Calculation Performance Test
  // ───────────────────────────────────────────────────────────────────────────

  console.log(`\n\n🧮 Churn Risk Calculation Performance (client-side)`);

  const { calculateChurnRisk } = await import('../churn-risk');
  
  const testFactors = {
    daysSinceLastBooking: 95,
    bookingFrequencyChangePct: -30,
    revenueChangePct: -20,
    avgReviewRating: 3.8,
  };

  await benchmark(
    'Churn Risk Calculation (TypeScript)',
    async () => calculateChurnRisk(testFactors),
    1000 // More iterations since it's pure computation
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Filtered Query Performance
  // ───────────────────────────────────────────────────────────────────────────

  console.log(`\n\n🔍 Filtered Query Performance`);

  await benchmark(
    'Filter by Segment (Champions)',
    () => service.getCustomerSegmentation(TEST_TENANT_ID, 'Champions'),
    50
  );

  await benchmark(
    'Filter by Risk Level (High)',
    () => service.getChurnRiskAnalysis(TEST_TENANT_ID, 'High'),
    50
  );

  await benchmark(
    'Filter by Value Tier (VIP)',
    () => service.getCustomerLTV(TEST_TENANT_ID, undefined, 'VIP'),
    50
  );

  await benchmark(
    'Filter by Cohort Month (2025-01)',
    () => service.getCustomerLTV(TEST_TENANT_ID, '2025-01'),
    50
  );

  // ───────────────────────────────────────────────────────────────────────────
  // Summary
  // ───────────────────────────────────────────────────────────────────────────

  console.log(`\n\n╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║     Benchmark Complete                                           ║`);
  console.log(`╚══════════════════════════════════════════════════════════════════╝\n`);

  console.log(`📌 Key Takeaways:`);
  console.log(`   - Cache hits should be <50ms`);
  console.log(`   - Cache misses should be <300ms`);
  console.log(`   - Cache hit rate should be >95% after warmup`);
  console.log(`   - Churn risk calculations should be <1ms (pure TypeScript)`);
  console.log(`   - Filtered queries should be comparable to full queries\n`);

  process.exit(0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Run
// ─────────────────────────────────────────────────────────────────────────────

main().catch((error) => {
  console.error('\n❌ Benchmark failed:', error);
  process.exit(1);
});
