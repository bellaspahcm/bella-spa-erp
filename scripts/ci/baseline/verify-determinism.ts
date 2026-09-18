/**
 * BASELINE DETERMINISM VERIFIER
 * 
 * Verifies Invariant I3: Same artifacts → Same normalized findings
 * 
 * Usage:
 *   node verify-determinism.ts \
 *     --artifacts-dir ./artifacts \
 *     --run1 baseline1.json \
 *     --run2 baseline2.json
 * 
 * This script:
 * 1. Generates baseline from artifacts twice
 * 2. Compares semantic content (not metadata)
 * 3. Reports determinism status
 * 
 * PASS: Same fingerprints, same findings count
 * FAIL: Fingerprints differ OR counts differ
 */

import fs from 'fs';
import crypto from 'crypto';
import { Baseline } from './schema';
import { generateFromArtifacts } from './generate-from-artifacts';

interface DeterminismResult {
  deterministic: boolean;
  reasons: string[];
  details: {
    run1_commit: string;
    run2_commit: string;
    run1_timestamp: string;
    run2_timestamp: string;
    scopes: Record<string, {
      count_match: boolean;
      run1_count: number;
      run2_count: number;
      fingerprint_hash_match: boolean;
      run1_fingerprint_hash: string;
      run2_fingerprint_hash: string;
    }>;
  };
}

/**
 * Hash a sorted array of fingerprints
 */
function hashFingerprints(fingerprints: string[]): string {
  const sorted = [...fingerprints].sort();
  const content = sorted.join('\n');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Compare two baselines semantically
 */
export function verifyDeterminism(baseline1: Baseline, baseline2: Baseline): DeterminismResult {
  const result: DeterminismResult = {
    deterministic: true,
    reasons: [],
    details: {
      run1_commit: baseline1.commit,
      run2_commit: baseline2.commit,
      run1_timestamp: baseline1.generated_at,
      run2_timestamp: baseline2.generated_at,
      scopes: {}
    }
  };
  
  // I2: Source commit must match
  if (baseline1.commit !== baseline2.commit) {
    result.deterministic = false;
    result.reasons.push(
      `Source commit mismatch: ${baseline1.commit} vs ${baseline2.commit}`
    );
  }
  
  if (baseline1.provenance?.source_commit !== baseline2.provenance?.source_commit) {
    result.deterministic = false;
    result.reasons.push(
      `Provenance source_commit mismatch: ` +
      `${baseline1.provenance?.source_commit} vs ${baseline2.provenance?.source_commit}`
    );
  }
  
  // I3: Compare each scope
  const allScopes = new Set([
    ...Object.keys(baseline1.scopes),
    ...Object.keys(baseline2.scopes)
  ]);
  
  for (const scope of allScopes) {
    const scope1 = baseline1.scopes[scope as keyof typeof baseline1.scopes];
    const scope2 = baseline2.scopes[scope as keyof typeof baseline2.scopes];
    
    if (!scope1 || !scope2) {
      result.deterministic = false;
      result.reasons.push(`Scope ${scope} missing in one baseline`);
      continue;
    }
    
    // Count comparison
    const countMatch = scope1.count === scope2.count;
    
    // Fingerprint comparison
    const fingerprints1 = scope1.findings.map(f => f.fingerprint);
    const fingerprints2 = scope2.findings.map(f => f.fingerprint);
    
    const hash1 = hashFingerprints(fingerprints1);
    const hash2 = hashFingerprints(fingerprints2);
    const fingerprintMatch = hash1 === hash2;
    
    result.details.scopes[scope] = {
      count_match: countMatch,
      run1_count: scope1.count,
      run2_count: scope2.count,
      fingerprint_hash_match: fingerprintMatch,
      run1_fingerprint_hash: hash1,
      run2_fingerprint_hash: hash2
    };
    
    if (!countMatch) {
      result.deterministic = false;
      result.reasons.push(
        `${scope}: count mismatch (${scope1.count} vs ${scope2.count})`
      );
    }
    
    if (!fingerprintMatch) {
      result.deterministic = false;
      result.reasons.push(
        `${scope}: fingerprint set mismatch (hash ${hash1.substring(0, 8)} vs ${hash2.substring(0, 8)})`
      );
    }
  }
  
  return result;
}

/**
 * CLI interface
 */
async function main() {
  const args = process.argv.slice(2);
  
  const artifactsDirIndex = args.indexOf('--artifacts-dir');
  const run1Index = args.indexOf('--run1');
  const run2Index = args.indexOf('--run2');
  
  const artifactsDir = artifactsDirIndex !== -1 ? args[artifactsDirIndex + 1] : undefined;
  const run1Path = run1Index !== -1 ? args[run1Index + 1] : undefined;
  const run2Path = run2Index !== -1 ? args[run2Index + 1] : undefined;
  
  if (!artifactsDir) {
    console.error('Usage: node verify-determinism.ts --artifacts-dir <path> [--run1 <path> --run2 <path>]');
    console.error('');
    console.error('If --run1 and --run2 are not provided, will generate twice from artifacts');
    process.exit(1);
  }
  
  try {
    console.log('='.repeat(80));
    console.log('BASELINE DETERMINISM VERIFICATION');
    console.log('='.repeat(80));
    console.log('');
    
    let baseline1: Baseline;
    let baseline2: Baseline;
    
    if (run1Path && run2Path) {
      // Compare existing baselines
      console.log('Loading existing baselines...');
      baseline1 = JSON.parse(fs.readFileSync(run1Path, 'utf-8')) as Baseline;
      baseline2 = JSON.parse(fs.readFileSync(run2Path, 'utf-8')) as Baseline;
      console.log(`Run 1: ${run1Path}`);
      console.log(`Run 2: ${run2Path}`);
    } else {
      // Generate twice from same artifacts
      console.log('Generating baseline (run 1)...');
      baseline1 = await generateFromArtifacts(artifactsDir);
      console.log('');
      
      console.log('Generating baseline (run 2)...');
      baseline2 = await generateFromArtifacts(artifactsDir);
      console.log('');
    }
    
    // Verify determinism
    console.log('Comparing baselines...');
    console.log('');
    const result = verifyDeterminism(baseline1, baseline2);
    
    // Display results
    console.log('='.repeat(80));
    if (result.deterministic) {
      console.log('✅ DETERMINISM VERIFIED');
    } else {
      console.log('❌ DETERMINISM FAILED');
    }
    console.log('='.repeat(80));
    console.log('');
    
    console.log('Details:');
    console.log(`  Source commit: ${result.details.run1_commit}`);
    console.log(`  Run 1 timestamp: ${result.details.run1_timestamp}`);
    console.log(`  Run 2 timestamp: ${result.details.run2_timestamp}`);
    console.log('');
    
    console.log('Scope comparison:');
    for (const [scope, details] of Object.entries(result.details.scopes)) {
      const countStatus = details.count_match ? '✅' : '❌';
      const fpStatus = details.fingerprint_hash_match ? '✅' : '❌';
      
      console.log(`  ${scope}:`);
      console.log(`    ${countStatus} Count: ${details.run1_count} vs ${details.run2_count}`);
      console.log(`    ${fpStatus} Fingerprints: ${details.run1_fingerprint_hash.substring(0, 8)} vs ${details.run2_fingerprint_hash.substring(0, 8)}`);
    }
    console.log('');
    
    if (!result.deterministic) {
      console.log('Reasons for non-determinism:');
      result.reasons.forEach(reason => console.log(`  - ${reason}`));
      console.log('');
      process.exit(1);
    }
    
    console.log('INVARIANT I3 VERIFIED: Same artifacts → Same normalized findings');
    console.log('');
    
  } catch (error) {
    console.error('Error verifying determinism:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}
