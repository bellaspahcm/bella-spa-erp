/**
 * Policy Migration Script
 * 
 * Migrates existing policies from code files to PolicyRegistry database.
 * 
 * Usage:
 *   ts-node scripts/migrate-policies-to-registry.ts [--dry-run] [--force]
 * 
 * Options:
 *   --dry-run    Show what would be migrated without making changes
 *   --force      Overwrite existing policies in database
 * 
 * Prerequisites:
 *   - Database tables (policy_registry, policy_history) must exist
 *   - SUPABASE_SERVICE_ROLE_KEY must be set
 */

import { PolicyRegistry } from '../src/lib/decision-engine/registry/PolicyRegistry';
import { leaveApprovalPolicy } from '../src/lib/decision-engine/policies/leave-approval-policy';
import type { RegisterPolicyInput } from '../src/lib/decision-engine/registry/types';

// Migration configuration
const MIGRATION_CONFIG = {
  userId: 'system-migration', // System user for migration
  dryRun: process.argv.includes('--dry-run'),
  force: process.argv.includes('--force'),
  verbose: process.argv.includes('--verbose'),
};

// Policies to migrate
const POLICIES_TO_MIGRATE = [
  {
    file: 'leave-approval-policy.ts',
    policy: leaveApprovalPolicy,
    metadata: {
      category: 'leave' as const,
      businessOwner: 'HR Department',
      businessOwnerEmail: 'hr@bella.vn',
      technicalOwner: 'System Admin',
      technicalOwnerEmail: 'admin@bella.vn',
      ownerDepartment: 'HR',
      effectiveDate: '2026-01-01',
      description: 'Legacy leave approval policy migrated from code',
    },
  },
];

/**
 * Transform legacy policy format to PolicyRegistry format
 */
function transformLegacyPolicy(legacyPolicy: any, metadata: any): RegisterPolicyInput {
  return {
    policy: {
      id: 'leave-approval-policy', // Normalized ID
      version: legacyPolicy.version || '1.0.0',
      name: legacyPolicy.name,
      description: legacyPolicy.description,
      rules: legacyPolicy.rules || [],
    },
    category: metadata.category,
    businessOwner: metadata.businessOwner,
    businessOwnerEmail: metadata.businessOwnerEmail,
    technicalOwner: metadata.technicalOwner,
    technicalOwnerEmail: metadata.technicalOwnerEmail,
    ownerDepartment: metadata.ownerDepartment,
    effectiveDate: metadata.effectiveDate,
    metadata: {
      source: 'migration',
      originalFile: metadata.file,
      migratedAt: new Date().toISOString(),
      documentation: metadata.description,
    },
  };
}

/**
 * Check if policy already exists in registry
 */
async function policyExists(policyId: string, version: string): Promise<boolean> {
  try {
    await PolicyRegistry.get(policyId, version);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Migrate a single policy
 */
async function migratePolicy(
  legacyPolicy: any,
  metadata: any,
  config: typeof MIGRATION_CONFIG
): Promise<{ success: boolean; message: string; policyId: string; version: string }> {
  const input = transformLegacyPolicy(legacyPolicy, metadata);
  const policyId = input.policy.id;
  const version = input.policy.version;

  // Check if policy already exists
  const exists = await policyExists(policyId, version);

  if (exists && !config.force) {
    return {
      success: false,
      message: `Policy ${policyId} v${version} already exists (use --force to overwrite)`,
      policyId,
      version,
    };
  }

  if (config.dryRun) {
    return {
      success: true,
      message: `[DRY RUN] Would migrate policy ${policyId} v${version}`,
      policyId,
      version,
    };
  }

  try {
    // Register policy
    const registered = await PolicyRegistry.register(input, config.userId);

    if (config.verbose) {
      console.log('Registered policy:', {
        id: registered.policyId,
        version: registered.version,
        status: registered.status,
        createdAt: registered.createdAt,
      });
    }

    // Auto-publish if force flag is set
    if (config.force) {
      await PolicyRegistry.publish(
        policyId,
        version,
        config.userId,
        'Auto-published during migration'
      );

      return {
        success: true,
        message: `✅ Migrated and published policy ${policyId} v${version}`,
        policyId,
        version,
      };
    }

    return {
      success: true,
      message: `✅ Migrated policy ${policyId} v${version} (status: draft)`,
      policyId,
      version,
    };
  } catch (error: any) {
    return {
      success: false,
      message: `❌ Failed to migrate policy ${policyId} v${version}: ${error.message}`,
      policyId,
      version,
    };
  }
}

/**
 * Main migration function
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Policy Migration Script');
  console.log('='.repeat(80));
  console.log();

  // Show configuration
  console.log('Configuration:');
  console.log(`  Dry Run: ${MIGRATION_CONFIG.dryRun ? 'Yes' : 'No'}`);
  console.log(`  Force: ${MIGRATION_CONFIG.force ? 'Yes' : 'No'}`);
  console.log(`  Verbose: ${MIGRATION_CONFIG.verbose ? 'Yes' : 'No'}`);
  console.log(`  User ID: ${MIGRATION_CONFIG.userId}`);
  console.log();

  // Environment check
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ Error: Supabase environment variables not set');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log(`Found ${POLICIES_TO_MIGRATE.length} policies to migrate`);
  console.log();

  // Migrate each policy
  const results = [];
  for (const { file, policy, metadata } of POLICIES_TO_MIGRATE) {
    console.log(`Migrating: ${file}`);
    console.log(`  Policy: ${policy.name} v${policy.version}`);
    console.log(`  Rules: ${policy.rules?.length || 0} rules`);

    const result = await migratePolicy(policy, { ...metadata, file }, MIGRATION_CONFIG);
    results.push(result);

    console.log(`  ${result.message}`);
    console.log();
  }

  // Summary
  console.log('='.repeat(80));
  console.log('Migration Summary');
  console.log('='.repeat(80));
  console.log();

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`Total: ${results.length} policies`);
  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log();

  if (MIGRATION_CONFIG.dryRun) {
    console.log('🔍 This was a dry run - no changes were made');
    console.log('   Run without --dry-run to apply changes');
    console.log();
  }

  if (failed > 0) {
    console.log('Failed policies:');
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        console.log(`  - ${r.policyId} v${r.version}: ${r.message}`);
      });
    console.log();
  }

  // Next steps
  if (successful > 0 && !MIGRATION_CONFIG.dryRun) {
    console.log('Next steps:');
    console.log('  1. Review migrated policies in database');
    console.log('  2. Publish draft policies when ready');
    console.log('  3. Update application code to use PolicyRegistry');
    console.log('  4. Archive old policy files after verification');
    console.log();
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run migration
main().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
