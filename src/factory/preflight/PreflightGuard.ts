/**
 * Factory Preflight Guard — Main Orchestrator
 * 
 * Origin: Bella Land E2E remediation learning
 * Purpose: Catch environment configuration issues before expensive E2E runs
 * 
 * Success metric: Detect issues in ~5s vs ~30min E2E debugging
 */

import type {
  PreflightCheck,
  PreflightConfig,
  PreflightSummary,
  PreflightCheckSummary,
} from './types';

export class PreflightGuard {
  private checks: PreflightCheck[] = [];

  /**
   * Register a preflight check
   */
  registerCheck(check: PreflightCheck): void {
    this.checks.push(check);
  }

  /**
   * Register multiple preflight checks
   */
  registerChecks(checks: PreflightCheck[]): void {
    this.checks.push(...checks);
  }

  /**
   * Run all registered checks
   */
  async run(config: PreflightConfig): Promise<PreflightSummary> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // Filter checks by requested categories
    const relevantChecks = this.checks.filter(check =>
      config.checks.includes(check.category)
    );

    // Skip optional checks if requested
    const checksToRun = config.skipOptional
      ? relevantChecks.filter(check => check.required)
      : relevantChecks;

    if (config.verbose) {
      console.log(`\n🔍 FACTORY PREFLIGHT — ${config.product}`);
      console.log(`Running ${checksToRun.length} checks...\n`);
    }

    // Run all checks in parallel for speed
    const results = await Promise.all(
      checksToRun.map(async check => {
        try {
          const result = await check.check();
          return {
            check,
            result,
          };
        } catch (err) {
          return {
            check,
            result: {
              passed: false,
              status: 'FAIL' as const,
              message: `Check threw exception: ${check.name}`,
              evidence: err instanceof Error ? err.message : String(err),
              timestamp: new Date().toISOString(),
            },
          };
        }
      })
    );

    // Aggregate results
    const checksummaries: PreflightCheckSummary[] = results.map(({ check, result }) => ({
      id: check.id,
      name: check.name,
      category: check.category,
      status: result.status,
      message: result.message,
      suggestion: result.suggestion,
      required: check.required,
    }));

    const passed_count = results.filter(r => r.result.passed).length;
    const failed_count = results.filter(
      r => !r.result.passed && r.result.status === 'FAIL'
    ).length;
    const warned_count = results.filter(r => r.result.status === 'WARN').length;
    const skipped_count = results.filter(r => r.result.status === 'SKIP').length;

    // Collect blockers (required checks that failed)
    const blockers = results
      .filter(r => r.check.required && !r.result.passed)
      .map(r => r.result.message);

    // Collect warnings
    const warnings = results
      .filter(r => r.result.status === 'WARN')
      .map(r => r.result.message);

    const timeElapsed = Date.now() - startTime;

    const summary: PreflightSummary = {
      passed: blockers.length === 0,
      totalChecks: checksToRun.length,
      passed_count,
      failed_count,
      warned_count,
      skipped_count,
      checks: checksummaries,
      blockers,
      warnings,
      timeElapsed,
      timestamp,
    };

    if (config.verbose) {
      this.printSummary(summary);
    }

    return summary;
  }

  /**
   * Print human-readable summary
   */
  private printSummary(summary: PreflightSummary): void {
    console.log('\n' + '='.repeat(60));
    console.log('PREFLIGHT SUMMARY');
    console.log('='.repeat(60));

    // Print checks by category
    const categories = ['database', 'environment', 'configuration'] as const;
    
    for (const category of categories) {
      const categoryChecks = summary.checks.filter(c => c.category === category);
      if (categoryChecks.length === 0) continue;

      console.log(`\n${category.toUpperCase()} Checks:`);
      
      for (const check of categoryChecks) {
        const icon =
          check.status === 'PASS'
            ? '✅'
            : check.status === 'FAIL'
            ? '❌'
            : check.status === 'WARN'
            ? '⚠️'
            : '⏭️';
        
        console.log(`  ${icon} ${check.name}: ${check.message}`);
        
        if (check.suggestion && check.status !== 'PASS') {
          console.log(`     💡 ${check.suggestion}`);
        }
      }
    }

    // Print overall result
    console.log('\n' + '-'.repeat(60));
    console.log(`Total: ${summary.totalChecks} checks`);
    console.log(`✅ Passed: ${summary.passed_count}`);
    console.log(`❌ Failed: ${summary.failed_count}`);
    console.log(`⚠️  Warned: ${summary.warned_count}`);
    console.log(`⏭️  Skipped: ${summary.skipped_count}`);
    console.log(`⏱️  Time: ${summary.timeElapsed}ms`);

    if (summary.blockers.length > 0) {
      console.log('\n🚫 BLOCKERS (must fix before E2E):');
      summary.blockers.forEach(blocker => console.log(`   - ${blocker}`));
    }

    if (summary.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (non-blocking):');
      summary.warnings.forEach(warning => console.log(`   - ${warning}`));
    }

    console.log('\n' + '='.repeat(60));
    
    if (summary.passed) {
      console.log('✅ PREFLIGHT PASSED — Environment ready for testing');
    } else {
      console.log('❌ PREFLIGHT FAILED — Fix blockers before proceeding');
    }
    
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Clear all registered checks (useful for testing)
   */
  clear(): void {
    this.checks = [];
  }
}
