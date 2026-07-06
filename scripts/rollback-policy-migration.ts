/**
 * Policy Migration Rollback Script
 * 
 * Removes migrated policies from PolicyRegistry database.
 * Use this if migration needs to be rolled back.
 * 
 * Usage:
 *   ts-node scripts/rollback-policy-migration.ts [--confirm]
 * 
 * Options:
 *   --confirm    Required flag to actually delete (safety measure)
 * 
 * ⚠️ WARNING: This will permanently delete policies from database!
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/types/supabase';

// Policies to rollback (must match migration script)
const POLICIES_TO_ROLLBACK = [
  {
    policyId: 'leave-approval-policy',
    version: '1.0.0',
  },
];

/**
 * Create Supabase client for rollback operations
 */
function createSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables');
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Delete a policy and its audit trail
 */
async function deletePolicy(
  supabase: ReturnType<typeof createSupabaseClient>,
  policyId: string,
  version: string
): Promise<{ success: boolean; message: string }> {
  try {
    // Step 1: Delete from policy_history (audit trail)
    const { error: historyError } = await supabase
      .from('policy_history')
      .delete()
      .eq('policy_id', policyId)
      .eq('version', version);

    if (historyError) {
      return {
        success: false,
        message: `Failed to delete audit trail: ${historyError.message}`,
      };
    }

    // Step 2: Delete from policy_registry
    const { error: registryError } = await supabase
      .from('policy_registry')
      .delete()
      .eq('policy_id', policyId)
      .eq('version', version);

    if (registryError) {
      return {
        success: false,
        message: `Failed to delete policy: ${registryError.message}`,
      };
    }

    return {
      success: true,
      message: `✅ Deleted policy ${policyId} v${version}`,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Error: ${error.message}`,
    };
  }
}

/**
 * Main rollback function
 */
async function main() {
  const confirmed = process.argv.includes('--confirm');

  console.log('='.repeat(80));
  console.log('Policy Migration Rollback');
  console.log('='.repeat(80));
  console.log();

  if (!confirmed) {
    console.log('⚠️  WARNING: This will permanently delete policies from database!');
    console.log();
    console.log('Policies to be deleted:');
    POLICIES_TO_ROLLBACK.forEach(({ policyId, version }) => {
      console.log(`  - ${policyId} v${version}`);
    });
    console.log();
    console.log('To proceed, run with --confirm flag:');
    console.log('  ts-node scripts/rollback-policy-migration.ts --confirm');
    console.log();
    process.exit(0);
  }

  console.log('🔴 CONFIRMED - Proceeding with rollback...');
  console.log();

  // Create Supabase client
  const supabase = createSupabaseClient();

  // Delete each policy
  const results = [];
  for (const { policyId, version } of POLICIES_TO_ROLLBACK) {
    console.log(`Rolling back: ${policyId} v${version}`);

    const result = await deletePolicy(supabase, policyId, version);
    results.push(result);

    console.log(`  ${result.message}`);
    console.log();
  }

  // Summary
  console.log('='.repeat(80));
  console.log('Rollback Summary');
  console.log('='.repeat(80));
  console.log();

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`Total: ${results.length} policies`);
  console.log(`✅ Deleted: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log();

  if (failed > 0) {
    console.log('Failed deletions:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.message}`);
      });
    console.log();
  }

  if (successful > 0) {
    console.log('Rollback complete. Policies have been removed from database.');
    console.log();
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run rollback
main().catch((error) => {
  console.error('❌ Rollback failed:', error);
  process.exit(1);
});
