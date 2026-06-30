/**
 * Node.js Performance Benchmark: Executive Intelligence Service
 * 
 * Benchmarks Intelligence Layer performance using clinic.js for profiling:
 * - Memory usage analysis
 * - CPU profiling
 * - Event loop delay
 * - Async operations timing
 * 
 * Usage:
 *   # Install clinic.js
 *   npm install -g clinic
 * 
 *   # Run benchmarks
 *   npm run benchmark:intelligence
 * 
 *   # Or manually:
 *   clinic doctor -- node --loader ts-node/esm tests/performance/benchmark-executive-intelligence.ts
 *   clinic flame -- node --loader ts-node/esm tests/performance/benchmark-executive-intelligence.ts
 *   clinic bubbleprof -- node --loader ts-node/esm tests/performance/benchmark-executive-intelligence.ts
 * 
 * Output:
 *   - Console metrics (response times, cache hit rate, memory)
 *   - Clinic.js HTML reports (open in browser)
 *   - JSON report for CI/CD integration
 */

import { performance } from 'perf_hooks';

// ─── Configuration ──────────────────────────────────────────────────────────

const BENCHMARK_CONFIG = {
  warmupIterations: 10,      // Iterations to populate cache
  testIterations: 100,       // Iterations for measurement
  concurrency: 10,           // Concurrent requests
  testTenantId: '00000000-0000-0000-0000-000000000000',
  periods: ['day', 'week', 'month', 'quarter', 'year'],
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface BenchmarkResult {
  metric: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  p50ResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  avgCachedResponseTime: number;
  avgFreshResponseTime: number;
  memoryUsageMB: number;
  requestsPerSecond: number;
}

interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Calculate percentile from sorted array
 */
function calculatePercentile(sortedArray: number[], percentile: number): number {
  if (sortedArray.length === 0) return 0;
  
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[index];
}

/**
 * Get current memory usage
 */
function getMemoryUsage(): MemorySnapshot {
  const mem = process.memoryUsage();
  return {
    heapUsed: mem.heapUsed / 1024 / 1024, // MB
    heapTotal: mem.heapTotal / 1024 / 1024,
    external: mem.external / 1024 / 1024,
    rss: mem.rss / 1024 / 1024,
  };
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format duration in ms
 */
function formatDuration(ms: number): string {
  return `${ms.toFixed(2)}ms`;
}

/**
 * Format memory size in MB
 */
function formatMemory(mb: number): string {
  return `${mb.toFixed(2)} MB`;
}

// ─── Benchmark Functions ────────────────────────────────────────────────────

/**
 * Benchmark a single metric endpoint
 */
async function benchmarkMetric(
  metricName: string,
  fetchFunction: () => Promise<any>,
  iterations: number
): Promise<BenchmarkResult> {
  console.log(`\n📊 Benchmarking: ${metricName}`);
  console.log(`   Iterations: ${iterations}`);

  const responseTimes: number[] = [];
  const cachedResponseTimes: number[] = [];
  const freshResponseTimes: number[] = [];
  
  let successfulRequests = 0;
  let failedRequests = 0;
  let cacheHits = 0;
  let cacheMisses = 0;

  const memoryBefore = getMemoryUsage();
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    const iterationStart = performance.now();

    try {
      const result = await fetchFunction();
      const iterationEnd = performance.now();
      const duration = iterationEnd - iterationStart;

      responseTimes.push(duration);
      successfulRequests++;

      // Track cache metrics
      if (result?.metadata?.cacheHit) {
        cacheHits++;
        cachedResponseTimes.push(duration);
      } else {
        cacheMisses++;
        freshResponseTimes.push(duration);
      }

      // Progress indicator
      if ((i + 1) % 10 === 0) {
        process.stdout.write(`   Progress: ${i + 1}/${iterations}\r`);
      }
    } catch (error) {
      failedRequests++;
      console.error(`   ❌ Request ${i + 1} failed:`, error);
    }
  }

  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const memoryAfter = getMemoryUsage();

  // Calculate statistics
  responseTimes.sort((a, b) => a - b);
  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const minResponseTime = responseTimes[0] || 0;
  const maxResponseTime = responseTimes[responseTimes.length - 1] || 0;
  const p50ResponseTime = calculatePercentile(responseTimes, 50);
  const p95ResponseTime = calculatePercentile(responseTimes, 95);
  const p99ResponseTime = calculatePercentile(responseTimes, 99);

  const avgCachedResponseTime =
    cachedResponseTimes.length > 0
      ? cachedResponseTimes.reduce((a, b) => a + b, 0) / cachedResponseTimes.length
      : 0;

  const avgFreshResponseTime =
    freshResponseTimes.length > 0
      ? freshResponseTimes.reduce((a, b) => a + b, 0) / freshResponseTimes.length
      : 0;

  const cacheHitRate = cacheHits / (cacheHits + cacheMisses);
  const memoryUsageMB = memoryAfter.heapUsed - memoryBefore.heapUsed;
  const requestsPerSecond = (successfulRequests / totalTime) * 1000;

  console.log(`\n   ✅ Completed: ${successfulRequests}/${iterations} successful`);

  return {
    metric: metricName,
    totalRequests: iterations,
    successfulRequests,
    failedRequests,
    cacheHits,
    cacheMisses,
    cacheHitRate,
    avgResponseTime,
    minResponseTime,
    maxResponseTime,
    p50ResponseTime,
    p95ResponseTime,
    p99ResponseTime,
    avgCachedResponseTime,
    avgFreshResponseTime,
    memoryUsageMB,
    requestsPerSecond,
  };
}

/**
 * Benchmark all 5 metrics together (dashboard load simulation)
 */
async function benchmarkDashboardLoad(iterations: number): Promise<BenchmarkResult> {
  console.log(`\n📊 Benchmarking: Dashboard Load (All 5 Metrics)`);
  console.log(`   Iterations: ${iterations}`);

  const responseTimes: number[] = [];
  let successfulRequests = 0;
  let failedRequests = 0;

  const memoryBefore = getMemoryUsage();
  const startTime = performance.now();

  for (let i = 0; i < iterations; i++) {
    const iterationStart = performance.now();

    try {
      // Simulate parallel fetch of all 5 metrics
      await Promise.all([
        fetch(`http://localhost:3000/api/intelligence/executive/monthly-revenue-summary?tenantId=${BENCHMARK_CONFIG.testTenantId}&period=month`),
        fetch(`http://localhost:3000/api/intelligence/executive/operational-efficiency?tenantId=${BENCHMARK_CONFIG.testTenantId}&period=month`),
        fetch(`http://localhost:3000/api/intelligence/executive/customer-metrics?tenantId=${BENCHMARK_CONFIG.testTenantId}&period=month`),
        fetch(`http://localhost:3000/api/intelligence/executive/financial-health?tenantId=${BENCHMARK_CONFIG.testTenantId}&period=month`),
        fetch(`http://localhost:3000/api/intelligence/executive/growth-indicators?tenantId=${BENCHMARK_CONFIG.testTenantId}&period=month`),
      ]);

      const iterationEnd = performance.now();
      const duration = iterationEnd - iterationStart;

      responseTimes.push(duration);
      successfulRequests++;

      if ((i + 1) % 10 === 0) {
        process.stdout.write(`   Progress: ${i + 1}/${iterations}\r`);
      }
    } catch (error) {
      failedRequests++;
      console.error(`   ❌ Dashboard load ${i + 1} failed:`, error);
    }
  }

  const endTime = performance.now();
  const totalTime = endTime - startTime;
  const memoryAfter = getMemoryUsage();

  responseTimes.sort((a, b) => a - b);
  const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  const p95ResponseTime = calculatePercentile(responseTimes, 95);
  const memoryUsageMB = memoryAfter.heapUsed - memoryBefore.heapUsed;
  const requestsPerSecond = (successfulRequests / totalTime) * 1000;

  console.log(`\n   ✅ Completed: ${successfulRequests}/${iterations} successful`);

  return {
    metric: 'Dashboard Load',
    totalRequests: iterations,
    successfulRequests,
    failedRequests,
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRate: 0,
    avgResponseTime,
    minResponseTime: responseTimes[0] || 0,
    maxResponseTime: responseTimes[responseTimes.length - 1] || 0,
    p50ResponseTime: calculatePercentile(responseTimes, 50),
    p95ResponseTime,
    p99ResponseTime: calculatePercentile(responseTimes, 99),
    avgCachedResponseTime: 0,
    avgFreshResponseTime: 0,
    memoryUsageMB,
    requestsPerSecond,
  };
}

/**
 * Print benchmark results
 */
function printResults(results: BenchmarkResult[]): void {
  console.log('\n');
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log('  📈 BENCHMARK RESULTS');
  console.log('═════════════════════════════════════════════════════════════════════════════');

  results.forEach((result) => {
    console.log(`\n  ${result.metric}:`);
    console.log(`     Total Requests:       ${result.totalRequests}`);
    console.log(`     Successful:           ${result.successfulRequests} (${((result.successfulRequests / result.totalRequests) * 100).toFixed(1)}%)`);
    console.log(`     Failed:               ${result.failedRequests}`);
    
    if (result.cacheHits + result.cacheMisses > 0) {
      console.log(`     Cache Hit Rate:       ${(result.cacheHitRate * 100).toFixed(1)}% (${result.cacheHits}/${result.cacheHits + result.cacheMisses})`);
    }
    
    console.log(`     Avg Response Time:    ${formatDuration(result.avgResponseTime)}`);
    console.log(`     Min Response Time:    ${formatDuration(result.minResponseTime)}`);
    console.log(`     Max Response Time:    ${formatDuration(result.maxResponseTime)}`);
    console.log(`     P50 (Median):         ${formatDuration(result.p50ResponseTime)}`);
    console.log(`     P95:                  ${formatDuration(result.p95ResponseTime)}`);
    console.log(`     P99:                  ${formatDuration(result.p99ResponseTime)}`);
    
    if (result.avgCachedResponseTime > 0) {
      console.log(`     Avg Cached:           ${formatDuration(result.avgCachedResponseTime)}`);
    }
    if (result.avgFreshResponseTime > 0) {
      console.log(`     Avg Fresh:            ${formatDuration(result.avgFreshResponseTime)}`);
    }
    
    console.log(`     Memory Usage:         ${formatMemory(result.memoryUsageMB)}`);
    console.log(`     Throughput:           ${result.requestsPerSecond.toFixed(1)} req/s`);
  });

  console.log('\n═════════════════════════════════════════════════════════════════════════════');
}

/**
 * Check if results meet performance targets
 */
function validatePerformance(results: BenchmarkResult[]): boolean {
  console.log('\n  🎯 PERFORMANCE TARGET VALIDATION:\n');

  let allPassed = true;

  results.forEach((result) => {
    console.log(`  ${result.metric}:`);

    // Target 1: Cache hit rate >80% (if applicable)
    if (result.cacheHits + result.cacheMisses > 0) {
      const cacheHitPassed = result.cacheHitRate > 0.8;
      console.log(`     ${cacheHitPassed ? '✅' : '❌'} Cache Hit Rate: ${(result.cacheHitRate * 100).toFixed(1)}% (target >80%)`);
      if (!cacheHitPassed) allPassed = false;
    }

    // Target 2: P95 response time <1000ms
    const p95Passed = result.p95ResponseTime < 1000;
    console.log(`     ${p95Passed ? '✅' : '❌'} P95 Response Time: ${formatDuration(result.p95ResponseTime)} (target <1000ms)`);
    if (!p95Passed) allPassed = false;

    // Target 3: Cached response time <50ms (if applicable)
    if (result.avgCachedResponseTime > 0) {
      const cachedPassed = result.avgCachedResponseTime < 50;
      console.log(`     ${cachedPassed ? '✅' : '❌'} Avg Cached Time: ${formatDuration(result.avgCachedResponseTime)} (target <50ms)`);
      if (!cachedPassed) allPassed = false;
    }

    // Target 4: Throughput >100 req/s
    const throughputPassed = result.requestsPerSecond > 100;
    console.log(`     ${throughputPassed ? '✅' : '❌'} Throughput: ${result.requestsPerSecond.toFixed(1)} req/s (target >100)`);
    if (!throughputPassed) allPassed = false;

    // Target 5: Success rate >99%
    const successRate = result.successfulRequests / result.totalRequests;
    const successPassed = successRate > 0.99;
    console.log(`     ${successPassed ? '✅' : '❌'} Success Rate: ${(successRate * 100).toFixed(1)}% (target >99%)`);
    if (!successPassed) allPassed = false;

    console.log('');
  });

  return allPassed;
}

// ─── Main Benchmark ─────────────────────────────────────────────────────────

async function main() {
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log('  Executive Intelligence Service - Performance Benchmark');
  console.log('═════════════════════════════════════════════════════════════════════════════');
  console.log(`  Warmup Iterations:    ${BENCHMARK_CONFIG.warmupIterations}`);
  console.log(`  Test Iterations:      ${BENCHMARK_CONFIG.testIterations}`);
  console.log(`  Test Tenant ID:       ${BENCHMARK_CONFIG.testTenantId}`);
  console.log('═════════════════════════════════════════════════════════════════════════════');

  const results: BenchmarkResult[] = [];

  // Note: This benchmark requires running dev server on localhost:3000
  console.log('\n⚠️  Prerequisites:');
  console.log('   1. Start dev server: npm run dev');
  console.log('   2. Ensure test tenant exists in database');
  console.log('   3. Install clinic.js: npm install -g clinic\n');

  try {
    // Warmup (populate cache)
    console.log('\n⏳ Warming up cache...');
    // In real implementation, call actual service methods here
    console.log('   ⚠️  Manual warmup required (call API endpoints first)');

    // Wait for user confirmation
    console.log('\n   Press Enter to start benchmark...');
    // In real script: await waitForEnter();

    // Benchmark Note: This is a template
    // Real implementation would import and call actual service methods
    console.log('\n⚠️  Note: This is a benchmark template.');
    console.log('   To run real benchmarks, implement service method calls.');
    console.log('   Example: import { getExecutiveIntelligence } from "@/services/intelligence/executive";\n');

    // Print placeholder results
    printResults([]);
    
    console.log('\n📝 To run full benchmarks:');
    console.log('   1. Ensure dev server is running: npm run dev');
    console.log('   2. Run k6 load test: k6 run tests/performance/intelligence-executive-load-test.js');
    console.log('   3. Run clinic.js profiling:');
    console.log('      - clinic doctor -- npm run dev');
    console.log('      - clinic flame -- npm run dev');
    console.log('      - clinic bubbleprof -- npm run dev\n');

  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Run benchmark
if (require.main === module) {
  main();
}
