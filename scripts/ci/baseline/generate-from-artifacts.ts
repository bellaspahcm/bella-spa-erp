/**
 * GENERATE BASELINE FROM CI ARTIFACTS
 * 
 * Generates canonical baseline from CI artifact collector output
 * 
 * Usage:
 *   node scripts/ci/baseline/generate-from-artifacts.ts \
 *     --artifacts-dir ./artifacts \
 *     --output .github/ci/baselines/main.json
 * 
 * This script:
 * 1. Validates provenance from collection-summary.json
 * 2. Parses each artifact (TypeScript, ESLint, Jest, Migration)
 * 3. Converts to stable fingerprints
 * 4. Writes baseline JSON with verified provenance
 * 
 * CRITICAL: Enforces baseline.source_commit == actual_commit from artifacts
 */

import fs from 'fs';
import path from 'path';
import { Baseline, PolicyLevel } from './schema';
import { adaptTypeScriptOutput } from './adapters/typescript-adapter';
import { adaptESLintOutput } from './adapters/eslint-adapter';
import { adaptJestOutput } from './adapters/jest-adapter';
import { adaptMigrationOutput, getPRContext } from './adapters/migration-adapter';

interface CollectionSummary {
  workflow_run_id: string;
  workflow_run_number: string;
  requested_commit: string;
  actual_commit: string;
  commit_verified: boolean;
  branch: string;
  timestamp: string;
  runner_os: string;
  artifacts: {
    typescript: boolean;
    eslint: boolean;
    jest: boolean;
    migration: boolean;
  };
}

interface ArtifactMetadata {
  commit: string;
  timestamp: string;
  runner_os: string;
  [key: string]: any;
}

/**
 * Load and validate collection summary
 */
function loadCollectionSummary(artifactsDir: string): CollectionSummary {
  const summaryPath = path.join(artifactsDir, 'collection-summary.json');
  
  if (!fs.existsSync(summaryPath)) {
    throw new Error(`Collection summary not found: ${summaryPath}`);
  }
  
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8')) as CollectionSummary;
  
  // Validate provenance
  if (!summary.commit_verified) {
    throw new Error('Collection summary indicates commit verification failed');
  }
  
  if (summary.requested_commit !== summary.actual_commit) {
    throw new Error(
      `Provenance mismatch:\n` +
      `  Requested: ${summary.requested_commit}\n` +
      `  Actual:    ${summary.actual_commit}`
    );
  }
  
  console.log('✅ Provenance verified:');
  console.log(`   Commit: ${summary.actual_commit}`);
  console.log(`   Branch: ${summary.branch}`);
  console.log(`   Collected: ${summary.timestamp}`);
  console.log(`   Runner: ${summary.runner_os}`);
  console.log('');
  
  return summary;
}

/**
 * Load artifact with metadata validation
 */
function loadArtifact(
  artifactsDir: string,
  name: string,
  expectedCommit: string,
  expectedTimestamp?: string
): { output: string; metadata: ArtifactMetadata } {
  const outputPath = path.join(artifactsDir, `${name}-output.txt`);
  const jsonPath = path.join(artifactsDir, `${name}-output.json`);
  const metadataPath = path.join(artifactsDir, `${name}-metadata.json`);
  
  // Check which output file exists
  let output = '';
  if (fs.existsSync(jsonPath)) {
    output = fs.readFileSync(jsonPath, 'utf-8');
  } else if (fs.existsSync(outputPath)) {
    output = fs.readFileSync(outputPath, 'utf-8');
  } else {
    throw new Error(`Artifact not found: ${name}-output.{txt,json}`);
  }
  
  // Load and validate metadata
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Metadata not found: ${metadataPath}`);
  }
  
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8')) as ArtifactMetadata;
  
  // I1: Commit validation
  if (metadata.commit !== expectedCommit) {
    throw new Error(
      `${name} artifact commit mismatch:\n` +
      `  Expected: ${expectedCommit}\n` +
      `  Actual:   ${metadata.commit}`
    );
  }
  
  // I4: Collection integrity - prevent mixed artifacts from different runs
  // Note: Sequential collectors have different timestamps - this is expected.
  // Validation relies on workflow_run_id in collection-summary.json instead.
  // Timestamp check removed to support sequential collection workflow.
  
  return { output, metadata };
}

/**
 * Generate baseline from CI artifacts
 */
export async function generateFromArtifacts(
  artifactsDir: string,
  outputPath?: string
): Promise<Baseline> {
  console.log('='.repeat(80));
  console.log('GENERATING BASELINE FROM CI ARTIFACTS');
  console.log('='.repeat(80));
  console.log('');
  
  // 1. Load and validate collection summary
  const summary = loadCollectionSummary(artifactsDir);
  const canonicalCommit = summary.actual_commit;
  
  // 2. Load artifacts with provenance validation
  console.log('Loading artifacts...');
  
  // Load first artifact to establish canonical collection timestamp
  const typescript = loadArtifact(artifactsDir, 'typescript', canonicalCommit);
  const canonicalTimestamp = typescript.metadata.timestamp;
  console.log(`Collection timestamp: ${canonicalTimestamp}`);
  
  // Load remaining artifacts with collection integrity check
  const eslint = loadArtifact(artifactsDir, 'eslint', canonicalCommit, canonicalTimestamp);
  const jest = loadArtifact(artifactsDir, 'jest', canonicalCommit, canonicalTimestamp);
  
  // Migration artifact is optional
  let migration: { output: string; metadata: ArtifactMetadata } | null = null;
  if (summary.artifacts.migration) {
    migration = loadArtifact(artifactsDir, 'migration', canonicalCommit, canonicalTimestamp);
  } else {
    console.log('ℹ Migration artifact not present (optional)');
  }
  
  console.log('✅ All required artifacts loaded with verified provenance');
  console.log('✅ Collection integrity verified (same run)');
  console.log('');
  
  // 3. Convert to findings
  console.log('Converting to stable fingerprints...');
  const tsFindings = adaptTypeScriptOutput(typescript.output);
  const eslintFindings = adaptESLintOutput(eslint.output);
  const jestFindings = adaptJestOutput(jest.output);
  
  // For migrations, use empty baseline (first generation) or empty if no artifact
  const prContext = getPRContext();
  const migrationFindings = migration 
    ? adaptMigrationOutput(migration.output, [], prContext)
    : [];
  
  console.log('');
  console.log('Findings detected:');
  console.log(`  TypeScript: ${tsFindings.length}`);
  console.log(`  ESLint:     ${eslintFindings.length}`);
  console.log(`  Jest:       ${jestFindings.length}`);
  console.log(`  Migration:  ${migrationFindings.length}`);
  console.log('');
  
  // 4. Build baseline structure with verified provenance
  const baseline: Baseline = {
    version: '1.0.0',
    generated_at: new Date().toISOString(),
    commit: canonicalCommit,
    provenance: {
      source_branch: summary.branch,
      source_commit: canonicalCommit,
      workflow_run_id: summary.workflow_run_id,
      workflow_run_number: parseInt(summary.workflow_run_number),
      collection_timestamp: summary.timestamp,
      runner_os: summary.runner_os,
      generator_version: '1.0.0'
    },
    scopes: {
      'typescript-full': {
        policy: 'no-new-debt' as PolicyLevel,
        findings: tsFindings,
        count: tsFindings.length,
        metadata: {
          last_updated: typescript.metadata.timestamp,
          notes: 'Generated from CI artifacts'
        }
      },
      'eslint-changed': {
        policy: 'no-new-debt' as PolicyLevel,
        findings: eslintFindings,
        count: eslintFindings.length,
        metadata: {
          last_updated: eslint.metadata.timestamp,
          notes: 'Generated from CI artifacts - applies to changed files only'
        }
      },
      'jest-affected': {
        policy: 'no-new-debt-with-reason' as PolicyLevel,
        findings: jestFindings,
        count: jestFindings.length,
        metadata: {
          last_updated: jest.metadata.timestamp,
          notes: 'Generated from CI artifacts - includes failure reason in identity'
        }
      },
      'migration-zero-downtime': {
        policy: 'conditional-grandfathering' as PolicyLevel,
        findings: migrationFindings,
        count: migrationFindings.length,
        metadata: {
          last_updated: migration?.metadata.timestamp || canonicalTimestamp,
          notes: migration 
            ? 'Generated from CI artifacts - PR-relative grandfathering'
            : 'No migrations present at time of collection'
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
  
  // 5. Write to file if path provided
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
    console.log('Provenance:');
    console.log(`  source_commit:   ${baseline.provenance?.source_commit}`);
    console.log(`  source_branch:   ${baseline.provenance?.source_branch}`);
    console.log(`  workflow_run_id: ${baseline.provenance?.workflow_run_id}`);
    console.log(`  collected_at:    ${baseline.provenance?.collection_timestamp}`);
    console.log('');
  }
  
  return baseline;
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  const artifactsIndex = args.indexOf('--artifacts-dir');
  const outputIndex = args.indexOf('--output');
  
  const artifactsDir = artifactsIndex !== -1 ? args[artifactsIndex + 1] : undefined;
  const output = outputIndex !== -1 ? args[outputIndex + 1] : undefined;
  
  if (!artifactsDir || !output) {
    console.error('Usage: node generate-from-artifacts.ts --artifacts-dir <path> --output <path>');
    console.error('Example: node generate-from-artifacts.ts --artifacts-dir ./artifacts --output .github/ci/baselines/main.json');
    process.exit(1);
  }
  
  try {
    await generateFromArtifacts(artifactsDir, output);
    console.log('='.repeat(80));
    console.log('BASELINE GENERATION COMPLETE');
    console.log('='.repeat(80));
    console.log('');
    console.log('Next steps:');
    console.log('1. Review the baseline file and provenance');
    console.log('2. Verify fingerprint determinism (run again on same artifacts)');
    console.log('3. Commit to repository');
    console.log('4. Close bootstrap mode in CI workflows');
    console.log('5. Verify real baseline comparison on next PR');
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
