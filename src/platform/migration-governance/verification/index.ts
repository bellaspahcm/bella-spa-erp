/**
 * Phase 4B.3 — Database Verification Public API
 * 
 * Contract: P0_3_PHASE4B_3_CONTRACT.md v1.0.0 (commit 37ae4544)
 * 
 * Public entry point for 4B.3 Verification Engine.
 * 
 * Usage:
 * ```typescript
 * import { verifyMigration } from './verification';
 * 
 * const result = await verifyMigration({
 *   migration_id: '20260825_add_appointments',
 *   migration_file: 'supabase/migrations/20260825_add_appointments.sql',
 *   commit_sha: 'abc123',
 *   approval_id: 'appr-001',
 *   environment: 'production',
 *   database_url: process.env.DATABASE_URL!,
 * });
 * 
 * if (!result.deployment_eligible) {
 *   console.error('Deployment BLOCKED:', result.overall_result);
 *   process.exit(1);
 * }
 * ```
 */

export * from './types';
export { VerificationEngine } from './verification-engine';
export { ExpectedStateResolver } from './expected-state-resolver';
export { createDatabaseAdapter, SupabaseAdapter, SelfHostedAdapter } from './database-adapter';

import { VerificationEngine } from './verification-engine';
import { VerificationInput, VerificationResult } from './types';

/**
 * Convenience function: Verify migration
 * 
 * @param input - Verification input (from BDGF/4B.2)
 * @returns Verification result
 */
export async function verifyMigration(input: VerificationInput): Promise<VerificationResult> {
  const engine = new VerificationEngine();
  return await engine.execute(input);
}
