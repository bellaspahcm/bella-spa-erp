/**
 * Policy Migration Verification Script
 * 
 * Verifies that policies were migrated correctly to PolicyRegistry.
 * 
 * Usage:
 *   ts-node scripts/verify-policy-migration.ts
 * 
 * Checks:
 *   - Policy exists in database
 *   - All rules migrated correctly
 *   - Governance metadata present
 *   - Audit trail recorded
 */

import { PolicyRegistry } from '../src/lib/decision-engine/registry/PolicyRegistry';
import { leaveApprovalPolicy } from '../src/lib/decision-engine/policies/leave-approval-policy';

// Policies to verify
const POLICIES_TO_VERIFY = [
  {
    policyId: 'leave-approval-policy',
    version: '1.0.0',
    expectedName: leaveApprovalPolicy.name,
    expectedRulesCount: leaveApprovalPolicy.rules?.length || 0,
  },
];

interface VerificationResult {
  passed: boolean;
  policyId: string;
  version: string;
  checks: {
    exists: boolean;
    hasGovernance: boolean;
    rulesCountMatch: boolean;
    hasAuditTrail: boolean;
  };
  errors: string[];
}

/**
 * Verify a single policy
 */
async function verifyPolicy(
  policyId: string,
  version: string,
  expectedRulesCount: number
): Promise<VerificationResult> {
  const result: VerificationResult = {
    passed: false,
    policyId,
    version,
    checks: {
      exists: false,
      hasGovernance: false,
      rulesCountMatch: false,
      hasAuditTrail: false,
    },
    errors: [],
  };

  try {
    // Check 1: Policy exists
    const policy = await PolicyRegistry.get(policyId, version);
    result.checks.exists = true;

    // Check 2: Governance metadata present
    if (
      policy.businessOwner &&
      policy.businessOwnerEmail &&
      policy.technicalOwner &&
      policy.technicalOwnerEmail &&
      policy.ownerDepartment
    ) {
      result.checks.hasGovernance = true;
    } else {
      result.errors.push('Missing governance metadata');
    }

    // Check 3: Rules count matches
    const actualRulesCount = policy.config?.rules?.length || 0;
    if (actualRulesCount === expectedRulesCount) {
      result.checks.rulesCountMatch = true;
    } else {
      result.errors.push(
        `Rules count mismatch: expected ${expectedRulesCount}, got ${actualRulesCount}`
      );
    }

    // Check 4: Audit trail exists (check if policy has creation timestamp)
    if (policy.createdAt && policy.createdBy) {
      result.checks.hasAuditTrail = true;
    } else {
      result.errors.push('Missing audit trail (createdAt/createdBy)');
    }

    // Overall pass/fail
    result.passed =
      result.checks.exists &&
      result.checks.hasGovernance &&
      result.checks.rulesCountMatch &&
      result.checks.hasAuditTrail;
  } catch (error: any) {
    result.errors.push(`Policy not found: ${error.message}`);
  }

  return result;
}

/**
 * Main verification function
 */
async function main() {
  console.log('='.repeat(80));
  console.log('Policy Migration Verification');
  console.log('='.repeat(80));
  console.log();

  // Environment check
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('❌ Error: Supabase environment variables not set');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  console.log(`Verifying ${POLICIES_TO_VERIFY.length} policies...`);
  console.log();

  // Verify each policy
  const results: VerificationResult[] = [];
  for (const { policyId, version, expectedName, expectedRulesCount } of POLICIES_TO_VERIFY) {
    console.log(`Verifying: ${expectedName}`);
    console.log(`  Policy ID: ${policyId}`);
    console.log(`  Version: ${version}`);

    const result = await verifyPolicy(policyId, version, expectedRulesCount);
    results.push(result);

    // Show checks
    console.log('  Checks:');
    console.log(`    ✓ Policy exists: ${result.checks.exists ? '✅' : '❌'}`);
    console.log(`    ✓ Governance metadata: ${result.checks.hasGovernance ? '✅' : '❌'}`);
    console.log(
      `    ✓ Rules count (${expectedRulesCount}): ${result.checks.rulesCountMatch ? '✅' : '❌'}`
    );
    console.log(`    ✓ Audit trail: ${result.checks.hasAuditTrail ? '✅' : '❌'}`);

    if (result.errors.length > 0) {
      console.log('  Errors:');
      result.errors.forEach((error) => {
        console.log(`    - ${error}`);
      });
    }

    console.log(`  Result: ${result.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log();
  }

  // Summary
  console.log('='.repeat(80));
  console.log('Verification Summary');
  console.log('='.repeat(80));
  console.log();

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`Total: ${results.length} policies`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log();

  if (failed > 0) {
    console.log('Failed policies:');
    results
      .filter((r) => !r.passed)
      .forEach((r) => {
        console.log(`  - ${r.policyId} v${r.version}`);
        r.errors.forEach((error) => {
          console.log(`      ${error}`);
        });
      });
    console.log();
  }

  if (passed === results.length) {
    console.log('🎉 All policies migrated successfully!');
    console.log();
    console.log('Next steps:');
    console.log('  1. Update application code to use PolicyRegistry API');
    console.log('  2. Test policy execution with new registry');
    console.log('  3. Archive old policy files');
    console.log();
  }

  process.exit(failed > 0 ? 1 : 0);
}

// Run verification
main().catch((error) => {
  console.error('❌ Verification failed:', error);
  process.exit(1);
});
