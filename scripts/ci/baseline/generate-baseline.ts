/**
 * BASELINE GENERATOR
 * 
 * Generates baseline.json from current main branch state
 * 
 * Usage:
 *   node scripts/ci/baseline/generate-baseline.ts --output .github/ci/baselines/main.json
 * 
 * This script:
 * 1. Runs all checks (TypeScript, ESLint, Jest, Migration)
 * 2. Converts output to stable fingerprints
 * 3. Writes baseline JSON with policy configuration
 * 
 * IMPORTANT: Run this on clean main branch state
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Baseline, PolicyLevel } from './schema';
import { adaptTypeScriptOutput } from './adapters/typescript-adapter';
import { adaptESLintOutput } from './adapters/eslint-adapter';
import { adaptJestOutput } from './adapters/jest-adapter';
import { adaptMigrationOutput, getPRContext } from './adapters/migration-adapter';

/**
 * Run TypeScript compiler and capture output
 */
function runTypeScriptCheck(): string {
  console.log('Running TypeScript check...');
  try {
    execSync('npx tsc --noEmit', { encoding: 'utf-8', stdio: 'pipe' });
    return '';  // No errors
  } catch (error: any) {
    return error.stderr || error.stdout || '';
  }
}

/**
 * Run ESLint and capture JSON output
 */
function runESLintCheck(): string {
  console.log('Running ESLint check...');
  try {
    const output = execSync(
      'npx eslint . --format json',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    return output;
  } catch (error: any) {
    // ESLint outputs JSON even on failure (in stdout)
    return error.stdout || '[]';
  }
}

/**
 * Run Jest and capture JSON output
 */
function runJestCheck(): string {
  console.log('Running Jest check...');
  try {
    const output = execSync(
      'npx jest --json --testPathPattern="src/"',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    return output;
  } catch (error: any) {
    // Jest outputs JSON even on failure
    return error.stdout || '{}';
  }
}

/**
 * Run migration check
 */
function runMigrationCheck(): string {
  console.log('Running migration check...');
  try {
    const output = execSync(
      'node scripts/migrations/zero-downtime-check.js',
      { encoding: 'utf-8', stdio: 'pipe' }
    );
    return output;
  } catch (error: any) {
    return error.stdout || '';
  }
}

/**
 * Get current git commit
 */
function getCurrentCommit(): string {
  return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
}

/**
 * Generate baseline from current state
 */
export async function generateBaseline(outputPath?: string): Promise<Baseline> {
  console.log('='.repeat(80));
  console.log('GENERATING BASELINE');
  console.log('='.repeat(80));
  console.log('');
  
  // Run all checks
  const tscOutput = runTypeScriptCheck();
  const eslintOutput = runESLintCheck();
  const jestOutput = runJestCheck();
  const migrationOutput = runMigrationCheck();
  
  // Convert to findings
  console.log('Converting to stable fingerprints...');
  const tsFindings = adaptTypeScriptOutput(tscOutput);
  const eslintFindings = adaptESLintOutput(eslintOutput);
  const jestFindings = adaptJestOutput(jestOutput);
  
  // For migrations, use empty baseline (first generation)
  const prContext = getPRContext();
  const migrationFindings = adaptMigrationOutput(migrationOutput, [], prContext);
  
  console.log('');
  console.log('Findings detected:');
  console.log(`  TypeScript: ${tsFindings.length}`);
  console.log(`  ESLint:     ${eslintFindings.length}`);
  console.log(`  Jest:       ${jestFindings.length}`);
  console.log(`  Migration:  ${migrationFindings.length}`);
  console.log('');
  
  // Build baseline structure
  const baseline: Baseline = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    commit: getCurrentCommit(),
    scopes: {
      'typescript-full': {
        policy: 'no-new-debt' as PolicyLevel,
        findings: tsFindings,
        count: tsFindings.length,
        metadata: {
          last_updated: new Date().toISOString(),
          notes: 'Initial baseline generation'
        }
      },
      'eslint-changed': {
        policy: 'no-new-debt' as PolicyLevel,
        findings: eslintFindings,
        count: eslintFindings.length,
        metadata: {
          last_updated: new Date().toISOString(),
          notes: 'Initial baseline generation - applies to changed files only'
        }
      },
      'jest-affected': {
        policy: 'no-new-debt-with-reason' as PolicyLevel,
        findings: jestFindings,
        count: jestFindings.length,
        metadata: {
          last_updated: new Date().toISOString(),
          notes: 'Initial baseline generation - includes failure reason in identity'
        }
      },
      'migration-zero-downtime': {
        policy: 'conditional-grandfathering' as PolicyLevel,
        findings: migrationFindings,
        count: migrationFindings.length,
        metadata: {
          last_updated: new Date().toISOString(),
          notes: 'Initial baseline generation - PR-relative grandfathering'
        }
      }
    },
    policies: {
      'zero-tolerance': {
        description: 'Any violation blocks CI',
        enforcement: 'No historical tolerance, all violations block'
      },
      'no-new-debt': {
        description: 'Existing debt tolerated, new debt blocked',
        enforcement: 'NEW = CURRENT - BASELINE. If NEW > 0, BLOCK'
      },
      'no-new-debt-with-reason': {
        description: 'Same as no-new-debt but includes failure reason',
        enforcement: 'Same test with different failure = new finding'
      },
      'conditional-grandfathering': {
        description: 'Modified migrations strictly enforced, unchanged grandfathered',
        enforcement: 'PR-modified migration violations BLOCK, unchanged + baseline match ALLOW'
      }
    }
  };
  
  // Write to file if path provided
  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(
      outputPath,
      JSON.stringify(baseline, null, 2) + '\n',
      'utf-8'
    );
    
    console.log(`✅ Baseline written to: ${outputPath}`);
    console.log('');
  }
  
  return baseline;
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const outputIndex = args.indexOf('--output');
  const output = outputIndex !== -1 ? args[outputIndex + 1] : undefined;
  
  if (!output) {
    console.error('Usage: node generate-baseline.ts --output <path>');
    console.error('Example: node generate-baseline.ts --output .github/ci/baselines/main.json');
    process.exit(1);
  }
  
  try {
    await generateBaseline(output);
    console.log('='.repeat(80));
    console.log('BASELINE GENERATION COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Next steps:');
    console.log('1. Review the baseline file');
    console.log('2. Commit to repository');
    console.log('3. Update CI workflows to use baseline comparison');
    console.log('');
  } catch (error) {
    console.error('Error generating baseline:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
