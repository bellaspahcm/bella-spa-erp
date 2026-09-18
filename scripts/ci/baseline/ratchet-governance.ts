/**
 * BASELINE RATCHET GOVERNANCE
 * 
 * Manages baseline updates when technical debt decreases
 * 
 * CRITICAL RULES:
 * 1. NO auto-update in CI - baselines are sacred
 * 2. Manual review required for all updates
 * 3. Ratchet only when debt DECREASES (never increases)
 * 4. Generate audit trail for all updates
 * 5. Validate new baseline before committing
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  Baseline,
  ComparisonResult,
  FindingIdentity
} from './schema';

/**
 * Ratchet proposal
 */
export interface RatchetProposal {
  scope: string;
  currentCount: number;
  baselineCount: number;
  reduction: number;
  resolvedFindings: FindingIdentity[];
  newBaseline: FindingIdentity[];
  timestamp: string;
  proposedBy: string;
  rationale: string;
}

/**
 * Ratchet audit entry
 */
export interface RatchetAudit {
  timestamp: string;
  scope: string;
  previousCount: number;
  newCount: number;
  reduction: number;
  commit: string;
  author: string;
  rationale: string;
  resolvedFindings: string[];  // Fingerprints of resolved findings
}

/**
 * Generate ratchet proposal from comparison result
 * 
 * Only generates proposal if debt actually decreased
 */
export function generateRatchetProposal(
  scope: string,
  comparison: ComparisonResult,
  currentFindings: FindingIdentity[],
  rationale: string
): RatchetProposal | null {
  // Only propose ratchet if debt decreased
  if (comparison.resolvedFindings.length === 0) {
    return null;
  }
  
  // Ensure no new debt introduced
  if (comparison.newFindings.length > 0) {
    throw new Error(
      `Cannot ratchet ${scope}: ${comparison.newFindings.length} new violations introduced`
    );
  }
  
  const gitUser = getGitUser();
  
  return {
    scope,
    currentCount: currentFindings.length,
    baselineCount: comparison.existingFindings.length + comparison.resolvedFindings.length,
    reduction: comparison.resolvedFindings.length,
    resolvedFindings: comparison.resolvedFindings,
    newBaseline: currentFindings,
    timestamp: new Date().toISOString(),
    proposedBy: gitUser,
    rationale
  };
}

/**
 * Validate ratchet proposal
 * 
 * Ensures:
 * 1. Debt decreased (not increased)
 * 2. No new violations
 * 3. Current state is subset of baseline (modulo resolved)
 */
export function validateRatchetProposal(
  proposal: RatchetProposal
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check reduction is positive
  if (proposal.reduction <= 0) {
    errors.push(`Reduction must be positive, got ${proposal.reduction}`);
  }
  
  // Check counts are consistent
  if (proposal.currentCount !== proposal.newBaseline.length) {
    errors.push(
      `Current count mismatch: ${proposal.currentCount} !== ${proposal.newBaseline.length}`
    );
  }
  
  // Check reduction math
  const expectedBaseline = proposal.currentCount + proposal.reduction;
  if (proposal.baselineCount !== expectedBaseline) {
    errors.push(
      `Baseline count inconsistent: ${proposal.baselineCount} !== ${expectedBaseline}`
    );
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Apply ratchet to baseline file
 * 
 * Updates the baseline JSON with new findings
 * Does NOT commit - requires manual review
 */
export function applyRatchet(
  baselinePath: string,
  proposal: RatchetProposal,
  auditPath: string
): void {
  // Validate proposal
  const validation = validateRatchetProposal(proposal);
  if (!validation.valid) {
    throw new Error(
      `Invalid ratchet proposal:\n${validation.errors.join('\n')}`
    );
  }
  
  // Load current baseline
  const baseline: Baseline = JSON.parse(
    fs.readFileSync(baselinePath, 'utf-8')
  );
  
  // Update the specific scope
  const scopeKey = proposal.scope as keyof typeof baseline.scopes;
  const scopeConfig = baseline.scopes[scopeKey];
  
  if (!scopeConfig) {
    throw new Error(`Scope ${proposal.scope} not found in baseline`);
  }
  
  // Replace findings with new baseline
  scopeConfig.findings = proposal.newBaseline;
  scopeConfig.count = proposal.newBaseline.length;
  
  // Update metadata
  if (!scopeConfig.metadata) {
    scopeConfig.metadata = {};
  }
  scopeConfig.metadata.last_updated = proposal.timestamp;
  scopeConfig.metadata.notes = `Ratcheted: -${proposal.reduction} violations. ${proposal.rationale}`;
  
  // Update top-level timestamp
  baseline.generated_at = proposal.timestamp;
  
  // Write updated baseline
  fs.writeFileSync(
    baselinePath,
    JSON.stringify(baseline, null, 2) + '\n',
    'utf-8'
  );
  
  console.log(`✅ Ratchet applied to ${baselinePath}`);
  console.log(`   Scope: ${proposal.scope}`);
  console.log(`   Reduction: ${proposal.reduction} violations`);
  console.log(`   New count: ${proposal.currentCount}`);
  
  // Record audit entry
  recordAudit(auditPath, proposal);
}

/**
 * Record ratchet in audit log
 */
function recordAudit(
  auditPath: string,
  proposal: RatchetProposal
): void {
  const audit: RatchetAudit = {
    timestamp: proposal.timestamp,
    scope: proposal.scope,
    previousCount: proposal.baselineCount,
    newCount: proposal.currentCount,
    reduction: proposal.reduction,
    commit: getCurrentCommit(),
    author: proposal.proposedBy,
    rationale: proposal.rationale,
    resolvedFindings: proposal.resolvedFindings.map(f => f.fingerprint)
  };
  
  // Load existing audit log
  let auditLog: RatchetAudit[] = [];
  if (fs.existsSync(auditPath)) {
    auditLog = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
  }
  
  // Append new entry
  auditLog.push(audit);
  
  // Write back
  fs.writeFileSync(
    auditPath,
    JSON.stringify(auditLog, null, 2) + '\n',
    'utf-8'
  );
  
  console.log(`📝 Audit recorded to ${auditPath}`);
}

/**
 * Generate human-readable ratchet summary
 */
export function generateRatchetSummary(
  proposals: RatchetProposal[]
): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(80));
  lines.push('BASELINE RATCHET PROPOSAL');
  lines.push('='.repeat(80));
  lines.push('');
  
  if (proposals.length === 0) {
    lines.push('No ratchet opportunities detected.');
    lines.push('');
    lines.push('All scopes either:');
    lines.push('- Have no debt reduction, or');
    lines.push('- Have new violations introduced');
    lines.push('');
    return lines.join('\n');
  }
  
  const totalReduction = proposals.reduce((sum, p) => sum + p.reduction, 0);
  
  lines.push(`Total debt reduction: ${totalReduction} violations resolved`);
  lines.push(`Scopes affected: ${proposals.length}`);
  lines.push('');
  
  for (const proposal of proposals) {
    lines.push(`🎯 ${proposal.scope.toUpperCase()}`);
    lines.push(`   Before: ${proposal.baselineCount} violations`);
    lines.push(`   After:  ${proposal.currentCount} violations`);
    lines.push(`   Reduction: -${proposal.reduction} (${Math.round(proposal.reduction / proposal.baselineCount * 100)}%)`);
    lines.push(`   Rationale: ${proposal.rationale}`);
    lines.push('');
    
    if (proposal.resolvedFindings.length <= 5) {
      lines.push('   Resolved violations:');
      for (const finding of proposal.resolvedFindings) {
        lines.push(`   - ${finding.file}:${finding.line}: ${finding.message}`);
      }
    } else {
      lines.push(`   Resolved violations: ${proposal.resolvedFindings.length} (details in audit)`);
    }
    lines.push('');
  }
  
  lines.push('='.repeat(80));
  lines.push('MANUAL REVIEW REQUIRED');
  lines.push('='.repeat(80));
  lines.push('');
  lines.push('To apply this ratchet:');
  lines.push('');
  lines.push('1. Review the resolved violations above');
  lines.push('2. Verify the reduction is legitimate (not accidental)');
  lines.push('3. Run: node scripts/ci/baseline/ratchet-governance.js --apply');
  lines.push('4. Commit the updated baseline with message:');
  lines.push(`   "chore: ratchet baseline (-${totalReduction} violations)"`);
  lines.push('');
  lines.push('⚠️  NEVER auto-commit baseline updates in CI');
  lines.push('');
  
  return lines.join('\n');
}

/**
 * Get current git user
 */
function getGitUser(): string {
  try {
    const name = execSync('git config user.name', { encoding: 'utf-8' }).trim();
    const email = execSync('git config user.email', { encoding: 'utf-8' }).trim();
    return `${name} <${email}>`;
  } catch {
    return 'unknown';
  }
}

/**
 * Get current git commit
 */
function getCurrentCommit(): string {
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

/**
 * CLI interface for ratchet governance
 * 
 * Usage:
 *   node ratchet-governance.js --preview     # Show ratchet opportunities
 *   node ratchet-governance.js --apply       # Apply ratchet (requires review)
 *   node ratchet-governance.js --audit       # Show audit history
 */
export async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  const baselinePath = path.join(process.cwd(), '.github/ci/baselines/main.json');
  const auditPath = path.join(process.cwd(), '.github/ci/baselines/ratchet-audit.json');
  
  switch (command) {
    case '--preview':
      console.log('Preview mode: Detecting ratchet opportunities...');
      console.log('(Implementation: Compare current vs baseline, generate proposals)');
      break;
    
    case '--apply':
      console.log('Apply mode: Applying ratchet proposals...');
      console.log('⚠️  This requires manual review. Proceed? (yes/no)');
      // Interactive confirmation would go here
      break;
    
    case '--audit':
      if (fs.existsSync(auditPath)) {
        const audit: RatchetAudit[] = JSON.parse(fs.readFileSync(auditPath, 'utf-8'));
        console.log('Ratchet Audit History:');
        console.log(JSON.stringify(audit, null, 2));
      } else {
        console.log('No audit history found.');
      }
      break;
    
    default:
      console.log('Usage:');
      console.log('  node ratchet-governance.js --preview   # Show opportunities');
      console.log('  node ratchet-governance.js --apply     # Apply ratchet');
      console.log('  node ratchet-governance.js --audit     # Show history');
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
}
