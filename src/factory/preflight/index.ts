/**
 * Factory Preflight Guard — Public API
 * 
 * Usage:
 * ```typescript
 * import { runPreflight, createBellaLandPreflight } from '@/factory/preflight';
 * 
 * // In E2E test setup
 * beforeAll(async () => {
 *   const result = await runPreflight({
 *     product: 'bella-land',
 *     checks: ['database', 'environment'],
 *     verbose: true
 *   });
 *   
 *   if (!result.passed) {
 *     throw new Error('Preflight failed - environment not ready');
 *   }
 * });
 * ```
 */

export { PreflightGuard } from './PreflightGuard';
export { DatabaseChecks } from './checks/DatabaseChecks';
export { EnvironmentChecks } from './checks/EnvironmentChecks';

export type {
  PreflightCheck,
  PreflightResult,
  PreflightSummary,
  PreflightConfig,
  PreflightCategory,
  PreflightStatus,
  DatabasePrivilege,
  RLSCheck,
  EnvironmentVariable,
} from './types';

import { PreflightGuard } from './PreflightGuard';
import { DatabaseChecks } from './checks/DatabaseChecks';
import { EnvironmentChecks } from './checks/EnvironmentChecks';
import type { PreflightConfig, PreflightSummary } from './types';

/**
 * Run preflight checks with given configuration
 */
export async function runPreflight(
  config: PreflightConfig
): Promise<PreflightSummary> {
  const guard = new PreflightGuard();

  // Register checks based on requested categories
  if (config.checks.includes('database')) {
    const dbChecks = new DatabaseChecks();
    guard.registerCheck(dbChecks.createConnectionCheck());
  }

  if (config.checks.includes('environment')) {
    const envChecks = new EnvironmentChecks();
    guard.registerCheck(
      envChecks.createEnvVarsCheck([
        { name: 'SUPABASE_URL', required: true },
        { name: 'NEXT_PUBLIC_SUPABASE_URL', required: true },
        { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', required: true },
        { name: 'SUPABASE_SERVICE_ROLE_KEY', required: true, sensitive: true },
      ])
    );
    guard.registerCheck(envChecks.createNodeVersionCheck('18.0.0'));
  }

  return await guard.run(config);
}

/**
 * Create preflight configuration for Bella Land Product
 * 
 * This is the Product that provided evidence for F-G1 implementation
 */
export function createBellaLandPreflight(): PreflightConfig {
  return {
    product: 'bella-land',
    checks: ['database', 'environment'],
    verbose: true,
  };
}

/**
 * Create comprehensive preflight configuration for any Product
 */
export function createProductPreflight(productName: string): PreflightConfig {
  return {
    product: productName,
    checks: ['database', 'environment', 'configuration'],
    verbose: true,
  };
}
