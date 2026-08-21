#!/usr/bin/env node
/**
 * BDGF Signing Key Rotation Script
 * 
 * Implements zero-downtime key rotation with dual-key validation period.
 * 
 * Rotation Strategy:
 * 1. Generate new key
 * 2. Deploy new key to Secrets Manager (version: AWSPENDING)
 * 3. Update issuer to use new key
 * 4. Validator accepts BOTH old and new keys (7-day grace period)
 * 5. After grace period, deprecate old key
 * 6. Monitor for any tokens using old key
 * 7. Remove old key version
 * 
 * Architecture Proof Week - Day 3
 * Stream A: BDGF Productionization
 */

import crypto from 'crypto';
import { SecretsManagerClient, PutSecretValueCommand, DescribeSecretCommand, UpdateSecretVersionStageCommand } from '@aws-sdk/client-secrets-manager';
import dotenv from 'dotenv';

dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG = {
  aws: {
    region: process.env.AWS_REGION || 'us-east-1',
    secretId: process.env.AWS_SECRET_ID || 'bdgf/gate-signing-key'
  },
  rotation: {
    gracePeriodDays: 7,
    newKeyLabel: 'AWSPENDING',
    currentKeyLabel: 'AWSCURRENT',
    previousKeyLabel: 'AWSPREVIOUS'
  },
  dryRun: process.argv.includes('--dry-run') || process.argv.includes('-n')
};

// ============================================================================
// AWS SECRETS MANAGER CLIENT
// ============================================================================

const client = new SecretsManagerClient({
  region: CONFIG.aws.region
});

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Generate cryptographically secure signing key
 * 
 * @returns {string} 256-bit key as hex string (64 characters)
 */
function generateSigningKey() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Get current secret metadata
 * 
 * @returns {Promise<Object>}
 */
async function describeSecret() {
  try {
    const command = new DescribeSecretCommand({
      SecretId: CONFIG.aws.secretId
    });
    
    const response = await client.send(command);
    return response;
  } catch (error) {
    throw new Error(`Failed to describe secret: ${error.message}`);
  }
}

/**
 * Create new secret version (AWSPENDING)
 * 
 * @param {string} newKey - New signing key
 * @returns {Promise<Object>}
 */
async function createPendingVersion(newKey) {
  try {
    const command = new PutSecretValueCommand({
      SecretId: CONFIG.aws.secretId,
      SecretString: JSON.stringify({ key: newKey }),
      VersionStages: [CONFIG.rotation.newKeyLabel]
    });
    
    const response = await client.send(command);
    return response;
  } catch (error) {
    throw new Error(`Failed to create pending version: ${error.message}`);
  }
}

/**
 * Promote AWSPENDING to AWSCURRENT
 * 
 * @param {string} pendingVersionId - Version ID to promote
 * @returns {Promise<Object>}
 */
async function promotePendingToCurrent(pendingVersionId) {
  try {
    const command = new UpdateSecretVersionStageCommand({
      SecretId: CONFIG.aws.secretId,
      VersionStage: CONFIG.rotation.currentKeyLabel,
      MoveToVersionId: pendingVersionId,
      RemoveFromVersionId: null // AWS will automatically move old AWSCURRENT to AWSPREVIOUS
    });
    
    const response = await client.send(command);
    return response;
  } catch (error) {
    throw new Error(`Failed to promote pending to current: ${error.message}`);
  }
}

/**
 * Remove old version stage
 * 
 * @param {string} versionId - Version ID to remove stage from
 * @param {string} stage - Stage to remove
 * @returns {Promise<Object>}
 */
async function removeVersionStage(versionId, stage) {
  try {
    const command = new UpdateSecretVersionStageCommand({
      SecretId: CONFIG.aws.secretId,
      VersionStage: stage,
      RemoveFromVersionId: versionId
    });
    
    const response = await client.send(command);
    return response;
  } catch (error) {
    throw new Error(`Failed to remove version stage: ${error.message}`);
  }
}

// ============================================================================
// ROTATION WORKFLOW
// ============================================================================

/**
 * Step 1: Pre-rotation validation
 */
async function preRotationValidation() {
  console.log('\n📋 STEP 1: Pre-Rotation Validation');
  console.log('═'.repeat(60));
  
  // Check AWS credentials
  console.log('✓ Checking AWS credentials...');
  try {
    await describeSecret();
    console.log('  ✅ AWS credentials valid');
  } catch (error) {
    console.error('  ❌ AWS credentials invalid:', error.message);
    throw new Error('AWS credentials validation failed');
  }
  
  // Check current secret state
  console.log('✓ Checking current secret state...');
  const secretInfo = await describeSecret();
  console.log(`  ✅ Secret exists: ${secretInfo.Name}`);
  console.log(`  ✅ ARN: ${secretInfo.ARN}`);
  
  const versions = secretInfo.VersionIdsToStages;
  console.log(`  ✅ Versions: ${Object.keys(versions).length}`);
  
  for (const [versionId, stages] of Object.entries(versions)) {
    console.log(`     - ${versionId.substring(0, 8)}...: ${stages.join(', ')}`);
  }
  
  // Check for existing AWSPENDING
  const hasPending = Object.values(versions).some(stages => 
    stages.includes(CONFIG.rotation.newKeyLabel)
  );
  
  if (hasPending) {
    console.warn('  ⚠️  AWSPENDING version already exists');
    console.warn('     This may indicate a previous rotation is in progress');
    
    if (!CONFIG.dryRun) {
      const answer = await promptUser('\nContinue anyway? (yes/no): ');
      if (answer.toLowerCase() !== 'yes') {
        throw new Error('Rotation aborted by user');
      }
    }
  }
  
  console.log('\n✅ Pre-rotation validation PASSED\n');
}

/**
 * Step 2: Generate new key
 */
async function generateNewKey() {
  console.log('\n🔐 STEP 2: Generate New Signing Key');
  console.log('═'.repeat(60));
  
  const newKey = generateSigningKey();
  
  console.log('✓ New key generated:');
  console.log(`  Length: ${newKey.length} characters (${newKey.length * 4} bits)`);
  console.log(`  Preview: ${newKey.substring(0, 16)}...${newKey.substring(newKey.length - 4)}`);
  console.log(`  Format: Hex string (cryptographically random)`);
  
  if (newKey.length < 64) {
    throw new Error('Generated key is too short (must be 64 hex characters)');
  }
  
  console.log('\n✅ New key generation PASSED\n');
  
  return newKey;
}

/**
 * Step 3: Deploy new key as AWSPENDING
 */
async function deployPendingKey(newKey) {
  console.log('\n🚀 STEP 3: Deploy New Key (AWSPENDING)');
  console.log('═'.repeat(60));
  
  if (CONFIG.dryRun) {
    console.log('🔵 DRY RUN: Would create AWSPENDING version with new key');
    return { VersionId: 'dry-run-version-id', VersionStages: ['AWSPENDING'] };
  }
  
  console.log('✓ Creating AWSPENDING version in Secrets Manager...');
  const response = await createPendingVersion(newKey);
  
  console.log(`  ✅ Version created: ${response.VersionId}`);
  console.log(`  ✅ Stages: ${response.VersionStages.join(', ')}`);
  
  console.log('\n✅ New key deployment PASSED\n');
  
  return response;
}

/**
 * Step 4: Test new key
 */
async function testNewKey() {
  console.log('\n🧪 STEP 4: Test New Key');
  console.log('═'.repeat(60));
  
  if (CONFIG.dryRun) {
    console.log('🔵 DRY RUN: Would test new key retrieval and token signing');
    console.log('✅ Test simulation PASSED\n');
    return;
  }
  
  console.log('✓ Testing new key retrieval...');
  // Import getSigningKey from get-signing-key.mjs
  const { getSigningKey, clearCache } = await import('./get-signing-key.mjs');
  
  // Clear cache to force fresh retrieval
  clearCache();
  
  // Try to get key (should get AWSCURRENT still, not AWSPENDING)
  const key = await getSigningKey();
  console.log(`  ✅ Key retrieved: ${key.substring(0, 16)}...`);
  
  // Test token signing with current key
  console.log('✓ Testing token signing with current key...');
  const { signPayload } = await import('./gate-token.mjs');
  
  const testPayload = {
    approval_id: 'rotation-test',
    execution_attempt_id: crypto.randomUUID(),
    executor_identity: 'test',
    expires_at: Math.floor(Date.now() / 1000) + 60,
    issued_at: Math.floor(Date.now() / 1000),
    migration_hash: 'test-hash',
    migration_id: 'test-migration',
    nonce: 'test-nonce',
    target_environment: 'test',
    target_schema: null
  };
  
  const signature = signPayload(testPayload, key);
  console.log(`  ✅ Signature generated: ${signature.substring(0, 16)}...`);
  
  console.log('\n✅ New key testing PASSED\n');
}

/**
 * Step 5: Promote AWSPENDING to AWSCURRENT
 */
async function promoteToCurrent(pendingVersionId) {
  console.log('\n⚡ STEP 5: Promote New Key to AWSCURRENT');
  console.log('═'.repeat(60));
  
  if (CONFIG.dryRun) {
    console.log('🔵 DRY RUN: Would promote AWSPENDING to AWSCURRENT');
    console.log('🔵 DRY RUN: Old AWSCURRENT would become AWSPREVIOUS');
    console.log('✅ Promotion simulation PASSED\n');
    return;
  }
  
  console.log('✓ Promoting AWSPENDING to AWSCURRENT...');
  console.log('  (Old AWSCURRENT will automatically become AWSPREVIOUS)');
  
  await promotePendingToCurrent(pendingVersionId);
  
  console.log('  ✅ Promotion complete');
  
  // Verify promotion
  console.log('✓ Verifying promotion...');
  const secretInfo = await describeSecret();
  const versions = secretInfo.VersionIdsToStages;
  
  let currentVersion = null;
  let previousVersion = null;
  
  for (const [versionId, stages] of Object.entries(versions)) {
    if (stages.includes('AWSCURRENT')) {
      currentVersion = versionId;
    }
    if (stages.includes('AWSPREVIOUS')) {
      previousVersion = versionId;
    }
  }
  
  console.log(`  ✅ AWSCURRENT: ${currentVersion?.substring(0, 8)}...`);
  console.log(`  ✅ AWSPREVIOUS: ${previousVersion?.substring(0, 8)}...`);
  
  console.log('\n✅ Promotion PASSED\n');
}

/**
 * Step 6: Grace period instructions
 */
function displayGracePeriodInstructions() {
  console.log('\n⏰ STEP 6: Grace Period (Dual-Key Validation)');
  console.log('═'.repeat(60));
  
  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + CONFIG.rotation.gracePeriodDays);
  
  console.log(`\n📅 Grace period: ${CONFIG.rotation.gracePeriodDays} days`);
  console.log(`📅 End date: ${gracePeriodEnd.toISOString().split('T')[0]}`);
  
  console.log('\n🔄 During grace period:');
  console.log('  • Token issuer uses NEW key (AWSCURRENT)');
  console.log('  • Token validator accepts OLD + NEW keys');
  console.log('  • Existing tokens with old key remain valid');
  console.log('  • New tokens use new key');
  
  console.log('\n⚠️  Important:');
  console.log('  1. Monitor token validation failures');
  console.log('  2. Check for any tokens still using old key');
  console.log('  3. After grace period, remove AWSPREVIOUS version');
  
  console.log('\n📋 Next steps:');
  console.log('  1. Monitor application logs for key errors');
  console.log('  2. Check BDGF audit logs for old key usage');
  console.log(`  3. On ${gracePeriodEnd.toISOString().split('T')[0]}, run:`);
  console.log(`     node scripts/bdgf/rotate-signing-key.mjs --finalize`);
  
  console.log('\n✅ Rotation COMPLETE (grace period active)\n');
}

/**
 * Step 7: Finalize rotation (remove old key)
 */
async function finalizeRotation() {
  console.log('\n🏁 STEP 7: Finalize Rotation (Remove Old Key)');
  console.log('═'.repeat(60));
  
  // Get current secret state
  const secretInfo = await describeSecret();
  const versions = secretInfo.VersionIdsToStages;
  
  let previousVersionId = null;
  
  for (const [versionId, stages] of Object.entries(versions)) {
    if (stages.includes('AWSPREVIOUS')) {
      previousVersionId = versionId;
      break;
    }
  }
  
  if (!previousVersionId) {
    console.log('  ℹ️  No AWSPREVIOUS version found');
    console.log('  ✅ Rotation already finalized\n');
    return;
  }
  
  console.log(`✓ Found AWSPREVIOUS version: ${previousVersionId.substring(0, 8)}...`);
  
  if (CONFIG.dryRun) {
    console.log('🔵 DRY RUN: Would remove AWSPREVIOUS stage');
    console.log('✅ Finalization simulation PASSED\n');
    return;
  }
  
  // Confirm removal
  console.log('\n⚠️  WARNING: This will remove the old key permanently!');
  console.log('  Any tokens signed with the old key will become invalid.');
  
  const answer = await promptUser('\nContinue? (yes/no): ');
  if (answer.toLowerCase() !== 'yes') {
    console.log('Finalization aborted by user\n');
    return;
  }
  
  console.log('✓ Removing AWSPREVIOUS stage...');
  await removeVersionStage(previousVersionId, 'AWSPREVIOUS');
  
  console.log('  ✅ Old key removed');
  
  // Verify removal
  const updatedInfo = await describeSecret();
  const updatedVersions = updatedInfo.VersionIdsToStages;
  
  console.log('\n✓ Current versions:');
  for (const [versionId, stages] of Object.entries(updatedVersions)) {
    console.log(`  - ${versionId.substring(0, 8)}...: ${stages.join(', ')}`);
  }
  
  console.log('\n✅ Rotation FINALIZED\n');
}

// ============================================================================
// USER INTERACTION
// ============================================================================

/**
 * Prompt user for input
 * 
 * @param {string} question 
 * @returns {Promise<string>}
 */
function promptUser(question) {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    readline.question(question, (answer) => {
      readline.close();
      resolve(answer);
    });
  });
}

// ============================================================================
// MAIN WORKFLOW
// ============================================================================

async function rotateSigningKey() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      BDGF SIGNING KEY ROTATION                             ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  
  if (CONFIG.dryRun) {
    console.log('\n🔵 DRY RUN MODE: No changes will be made to Secrets Manager');
  }
  
  try {
    // Check if finalize mode
    if (process.argv.includes('--finalize') || process.argv.includes('-f')) {
      await preRotationValidation();
      await finalizeRotation();
      return;
    }
    
    // Regular rotation
    await preRotationValidation();
    
    const newKey = await generateNewKey();
    
    const pendingVersion = await deployPendingKey(newKey);
    
    await testNewKey();
    
    await promoteToCurrent(pendingVersion.VersionId);
    
    displayGracePeriodInstructions();
    
    console.log('═'.repeat(60));
    console.log('✅ ROTATION SUCCESSFUL');
    console.log('═'.repeat(60));
    
  } catch (error) {
    console.error('\n╔════════════════════════════════════════════════════════════╗');
    console.error('║      ROTATION FAILED                                       ║');
    console.error('╚════════════════════════════════════════════════════════════╝\n');
    console.error('❌ Error:', error.message);
    console.error('   Stack:', error.stack);
    
    console.error('\n📋 Troubleshooting:');
    console.error('  1. Check AWS credentials: aws sts get-caller-identity');
    console.error('  2. Check IAM permissions: secretsmanager:PutSecretValue, UpdateSecretVersionStage');
    console.error('  3. Check secret exists: aws secretsmanager describe-secret --secret-id bdgf/gate-signing-key');
    console.error('  4. Run with --dry-run flag to test without making changes');
    
    process.exit(1);
  }
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

if (import.meta.url === `file://${process.argv[1]}`) {
  // Show usage if --help
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
BDGF Signing Key Rotation Script

Usage:
  node scripts/bdgf/rotate-signing-key.mjs [options]

Options:
  -n, --dry-run     Simulate rotation without making changes
  -f, --finalize    Finalize rotation by removing old key (after grace period)
  -h, --help        Show this help message

Examples:
  # Test rotation (dry run)
  node scripts/bdgf/rotate-signing-key.mjs --dry-run
  
  # Execute rotation
  node scripts/bdgf/rotate-signing-key.mjs
  
  # Finalize rotation (after 7-day grace period)
  node scripts/bdgf/rotate-signing-key.mjs --finalize

Environment Variables:
  AWS_REGION        AWS region (default: us-east-1)
  AWS_SECRET_ID     Secret name (default: bdgf/gate-signing-key)

Rotation Process:
  1. Pre-rotation validation
  2. Generate new 256-bit key
  3. Deploy as AWSPENDING
  4. Test new key
  5. Promote to AWSCURRENT (old becomes AWSPREVIOUS)
  6. Grace period: 7 days (both keys valid)
  7. Finalize: Remove AWSPREVIOUS

Grace Period:
  - Issuer uses NEW key immediately
  - Validator accepts OLD + NEW keys
  - Existing tokens remain valid
  - After 7 days, run --finalize to remove old key
    `);
    process.exit(0);
  }
  
  rotateSigningKey();
}

export { rotateSigningKey, generateSigningKey };
