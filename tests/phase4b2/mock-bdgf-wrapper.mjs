#!/usr/bin/env node

/**
 * MOCK BDGF WRAPPER
 * 
 * Phase 4B.2 Test Harness - Isolated BDGF Mock
 * 
 * Purpose: Simulate BDGF wrapper behavior without production access
 * 
 * CLI Contract (matches real BDGF):
 *   node mock-bdgf-wrapper.mjs <approval_id> <migration_file>
 * 
 * Environment Variables:
 *   MOCK_BDGF_BEHAVIOR: "success" | "failure" | "invalid-approval" | "hash-mismatch"
 *   DATABASE_EXECUTOR_URL: MUST NOT be production
 *   TARGET_ENVIRONMENT: MUST be "test"
 * 
 * Safety:
 *   - Aborts if production credentials detected
 *   - Logs invocation for test verification
 *   - No database access
 *   - No real approval verification
 */

// ============================================================================
// PRODUCTION SAFETY GUARD
// ============================================================================

const PRODUCTION_ACCESS = 'FORBIDDEN';

function abortIfProduction() {
  const dbUrl = process.env.DATABASE_EXECUTOR_URL || '';
  const targetEnv = process.env.TARGET_ENVIRONMENT || '';
  
  // Check for production indicators
  const productionPatterns = [
    /supabase\.co/,
    /production/i,
    /prod\./,
    /@db-production/,
  ];
  
  const hasProductionUrl = productionPatterns.some(pattern => pattern.test(dbUrl));
  const isProductionEnv = targetEnv.toLowerCase() === 'production';
  
  if (hasProductionUrl || isProductionEnv) {
    console.error('');
    console.error('❌ PRODUCTION ACCESS VIOLATION');
    console.error('');
    console.error('Test harness attempted to access production resources.');
    console.error(`DATABASE_EXECUTOR_URL: ${dbUrl ? '[REDACTED - contains production pattern]' : '[not set]'}`);
    console.error(`TARGET_ENVIRONMENT: ${targetEnv}`);
    console.error('');
    console.error('Test harness policy: PRODUCTION_ACCESS = FORBIDDEN');
    console.error('');
    process.exit(99); // Special exit code for production violation
  }
  
  // Verify test environment
  if (targetEnv !== 'test') {
    console.error('');
    console.error('⚠️  WARNING: TARGET_ENVIRONMENT should be "test"');
    console.error(`Current value: "${targetEnv}"`);
    console.error('');
  }
}

// ============================================================================
// CLI CONTRACT VALIDATION
// ============================================================================

function validateCliArgs() {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.error('');
    console.error('❌ Invalid CLI arguments');
    console.error('');
    console.error('Usage: node mock-bdgf-wrapper.mjs <approval_id> <migration_file>');
    console.error('');
    console.error(`Received ${args.length} arguments:`, args);
    console.error('');
    process.exit(1);
  }
  
  return {
    approvalId: args[0],
    migrationFile: args[1],
  };
}

// ============================================================================
// MOCK BEHAVIOR
// ============================================================================

function getMockBehavior() {
  const behavior = process.env.MOCK_BDGF_BEHAVIOR || 'success';
  
  const validBehaviors = ['success', 'failure', 'invalid-approval', 'hash-mismatch', 'expired-approval'];
  
  if (!validBehaviors.includes(behavior)) {
    console.error(`⚠️  Unknown MOCK_BDGF_BEHAVIOR: ${behavior}, defaulting to 'success'`);
    return 'success';
  }
  
  return behavior;
}

// ============================================================================
// INVOCATION LOGGING (for test verification)
// ============================================================================

async function logInvocation(approvalId, migrationFile, behavior) {
  const invocation = {
    timestamp: new Date().toISOString(),
    approval_id: approvalId,
    migration_file: migrationFile,
    mock_behavior: behavior,
    environment: process.env.TARGET_ENVIRONMENT || 'unknown',
    database_url_present: !!process.env.DATABASE_EXECUTOR_URL,
    gate_key_present: !!process.env.GATE_SIGNING_KEY,
  };
  
  // Write to invocation log (for test assertions)
  // Use absolute path from environment or compute from script location
  const { promises: fs } = await import('fs');
  const { fileURLToPath } = await import('url');
  const { dirname, join } = await import('path');
  
  // Get directory of this script
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  
  // Always write to test directory (not temp repo)
  const logPath = join(__dirname, 'mock-invocation.json');
  
  try {
    await fs.writeFile(logPath, JSON.stringify(invocation, null, 2));
  } catch (err) {
    console.error(`⚠️  Failed to write invocation log: ${err.message}`);
    console.error(`   Attempted path: ${logPath}`);
  }
  
  return invocation;
}

// ============================================================================
// MOCK EXECUTION
// ============================================================================

async function executeMock(approvalId, migrationFile, behavior) {
  console.log('');
  console.log('🎭 MOCK BDGF WRAPPER');
  console.log('');
  console.log(`Approval ID: ${approvalId}`);
  console.log(`Migration File: ${migrationFile}`);
  console.log(`Mock Behavior: ${behavior}`);
  console.log('');
  
  // Simulate BDGF processing delay
  await new Promise(resolve => setTimeout(resolve, 100));
  
  switch (behavior) {
    case 'success':
      console.log('✅ Mock approval verification: PASS');
      console.log('✅ Mock hash verification: PASS');
      console.log('✅ Mock gate token issued');
      console.log('✅ Mock migration execution: SUCCESS');
      console.log('');
      console.log('Migration applied successfully (MOCK)');
      return 0;
      
    case 'failure':
      console.log('❌ Mock migration execution: FAILED');
      console.log('');
      console.error('Error: Mock migration syntax error');
      return 1;
      
    case 'invalid-approval':
      console.log('❌ Mock approval verification: FAILED');
      console.log('');
      console.error(`Error: Approval ${approvalId} not found or invalid`);
      return 2;
      
    case 'hash-mismatch':
      console.log('❌ Mock hash verification: FAILED');
      console.log('');
      console.error('Error: Migration file hash does not match approval');
      return 3;
      
    case 'expired-approval':
      console.log('❌ Mock approval verification: FAILED');
      console.log('');
      console.error(`Error: Approval ${approvalId} has expired`);
      return 4;
      
    default:
      console.error(`❌ Unknown mock behavior: ${behavior}`);
      return 99;
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  try {
    // GUARDRAIL 2: Production safety check
    abortIfProduction();
    
    // GUARDRAIL 1: CLI contract validation
    const { approvalId, migrationFile } = validateCliArgs();
    
    const behavior = getMockBehavior();
    
    // Log invocation for test verification
    await logInvocation(approvalId, migrationFile, behavior);
    
    // Execute mock behavior
    const exitCode = await executeMock(approvalId, migrationFile, behavior);
    
    process.exit(exitCode);
    
  } catch (error) {
    console.error('');
    console.error('❌ Mock BDGF wrapper error:', error.message);
    console.error('');
    process.exit(98);
  }
}

main();
