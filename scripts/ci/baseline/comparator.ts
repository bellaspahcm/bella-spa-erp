/**
 * BASELINE COMPARATOR + POLICY RESOLVER
 * 
 * Compares current findings against baseline and applies policy
 * 
 * Core logic: NEW = CURRENT - BASELINE
 * 
 * Policy layers:
 * 1. ZERO-TOLERANCE: Any violation = BLOCK
 * 2. NO-NEW-DEBT: Existing = ALLOW, New = BLOCK, Resolved = ALLOW + ratchet
 * 3. NO-NEW-DEBT-WITH-REASON: + failure reason must match (for tests)
 * 4. CONDITIONAL-GRANDFATHERING: Modified = STRICT, Unchanged + baseline = ALLOW
 */

import {
  Baseline,
  FindingIdentity,
  ComparisonResult,
  PolicyLevel,
  MigrationFinding
} from './schema';

/**
 * Compare current findings against baseline
 * 
 * Returns:
 * - newFindings: Present in current but not baseline
 * - resolvedFindings: Present in baseline but not current
 * - existingFindings: Present in both
 */
export function compareFindings(
  current: FindingIdentity[],
  baseline: FindingIdentity[]
): {
  newFindings: FindingIdentity[];
  resolvedFindings: FindingIdentity[];
  existingFindings: FindingIdentity[];
} {
  // Build fingerprint sets for efficient lookup
  const currentSet = new Set(current.map(f => f.fingerprint));
  const baselineSet = new Set(baseline.map(f => f.fingerprint));
  
  // Build maps for full finding access
  const currentMap = new Map(current.map(f => [f.fingerprint, f]));
  const baselineMap = new Map(baseline.map(f => [f.fingerprint, f]));
  
  // Compute set differences
  const newFindings: FindingIdentity[] = [];
  const existingFindings: FindingIdentity[] = [];
  const resolvedFindings: FindingIdentity[] = [];
  
  // NEW = CURRENT - BASELINE
  for (const finding of current) {
    if (baselineSet.has(finding.fingerprint)) {
      existingFindings.push(finding);
    } else {
      newFindings.push(finding);
    }
  }
  
  // RESOLVED = BASELINE - CURRENT
  for (const finding of baseline) {
    if (!currentSet.has(finding.fingerprint)) {
      resolvedFindings.push(finding);
    }
  }
  
  return {
    newFindings,
    resolvedFindings,
    existingFindings
  };
}

/**
 * Apply ZERO-TOLERANCE policy
 * 
 * Any violation = BLOCK (no historical tolerance)
 */
function applyZeroTolerancePolicy(
  current: FindingIdentity[],
  scope: string
): ComparisonResult {
  if (current.length > 0) {
    return {
      scope,
      newFindings: current,
      resolvedFindings: [],
      existingFindings: [],
      verdict: 'block',
      reason: `Zero-tolerance policy: ${current.length} violation(s) detected`,
      canRatchet: false
    };
  }
  
  return {
    scope,
    newFindings: [],
    resolvedFindings: [],
    existingFindings: [],
    verdict: 'pass',
    canRatchet: false
  };
}

/**
 * Apply NO-NEW-DEBT policy
 * 
 * - Existing debt: tolerated (ALLOW)
 * - New debt: BLOCK
 * - Resolved debt: ALLOW + ratchet opportunity
 */
function applyNoNewDebtPolicy(
  current: FindingIdentity[],
  baseline: FindingIdentity[],
  scope: string
): ComparisonResult {
  const comparison = compareFindings(current, baseline);
  
  if (comparison.newFindings.length > 0) {
    return {
      scope,
      ...comparison,
      verdict: 'block',
      reason: `No-new-debt policy: ${comparison.newFindings.length} new violation(s) introduced`,
      canRatchet: false
    };
  }
  
  // No new debt introduced
  return {
    scope,
    ...comparison,
    verdict: 'pass',
    reason: comparison.resolvedFindings.length > 0
      ? `Debt decreased: ${comparison.resolvedFindings.length} violation(s) resolved`
      : `No new debt introduced (${comparison.existingFindings.length} existing tolerated)`,
    canRatchet: comparison.resolvedFindings.length > 0
  };
}

/**
 * Apply NO-NEW-DEBT-WITH-REASON policy (for Jest tests)
 * 
 * Same as NO-NEW-DEBT but fingerprint includes failure reason
 * 
 * Critical difference:
 * - Same test, same failure reason: existing debt (ALLOW)
 * - Same test, different failure reason: new finding (BLOCK)
 */
function applyNoNewDebtWithReasonPolicy(
  current: FindingIdentity[],
  baseline: FindingIdentity[],
  scope: string
): ComparisonResult {
  // Same logic as NO-NEW-DEBT
  // The difference is already encoded in the fingerprint
  // (fingerprint includes failure_reason_hash)
  return applyNoNewDebtPolicy(current, baseline, scope);
}

/**
 * Apply CONDITIONAL-GRANDFATHERING policy (for migrations)
 * 
 * - PR-modified migration: STRICT (any violation = BLOCK)
 * - PR-unchanged migration + baseline match: ALLOW (grandfathered)
 * - PR-unchanged migration + new violation: BLOCK (error in analysis)
 */
function applyConditionalGrandfatheringPolicy(
  current: MigrationFinding[],
  baseline: FindingIdentity[],
  scope: string
): ComparisonResult {
  const comparison = compareFindings(current, baseline);
  
  // Filter to non-grandfathered findings (actual blockers)
  const nonGrandfathered = current.filter(f => !f.grandfathered);
  const grandfathered = current.filter(f => f.grandfathered);
  
  // ANY non-grandfathered violation = BLOCK
  // This includes:
  // 1. New violations in modified migrations
  // 2. Historical violations in modified migrations (must be fixed now)
  if (nonGrandfathered.length > 0) {
    return {
      scope,
      ...comparison,
      verdict: 'block',
      reason: `Conditional grandfathering: ${nonGrandfathered.length} violation(s) in modified migrations`,
      canRatchet: false
    };
  }
  
  // All current violations are grandfathered (unchanged migration + baseline match)
  return {
    scope,
    ...comparison,
    verdict: 'pass',
    reason: `${grandfathered.length} grandfathered violation(s), ${comparison.resolvedFindings.length} resolved`,
    canRatchet: comparison.resolvedFindings.length > 0
  };
}

/**
 * Apply appropriate policy based on scope configuration
 */
export function applyPolicy(
  scope: string,
  policy: PolicyLevel,
  current: FindingIdentity[],
  baseline: FindingIdentity[]
): ComparisonResult {
  switch (policy) {
    case 'zero-tolerance':
      return applyZeroTolerancePolicy(current, scope);
    
    case 'no-new-debt':
      return applyNoNewDebtPolicy(current, baseline, scope);
    
    case 'no-new-debt-with-reason':
      return applyNoNewDebtWithReasonPolicy(current, baseline, scope);
    
    case 'conditional-grandfathering':
      return applyConditionalGrandfatheringPolicy(
        current as MigrationFinding[],
        baseline,
        scope
      );
    
    default:
      throw new Error(`Unknown policy: ${policy}`);
  }
}

/**
 * Compare full baseline against current state
 * 
 * Returns ComparisonResult for each scope
 */
export function compareBaseline(
  current: Baseline,
  baseline: Baseline
): Map<string, ComparisonResult> {
  const results = new Map<string, ComparisonResult>();
  
  // Compare each scope
  for (const [scopeName, scopeConfig] of Object.entries(baseline.scopes)) {
    if (!scopeConfig) continue;
    
    const currentScope = current.scopes[scopeName as keyof typeof current.scopes];
    const currentFindings = currentScope?.findings || [];
    const baselineFindings = scopeConfig.findings || [];
    const policy = scopeConfig.policy;
    
    const result = applyPolicy(
      scopeName,
      policy,
      currentFindings,
      baselineFindings
    );
    
    results.set(scopeName, result);
  }
  
  return results;
}

/**
 * Compute overall verdict from scope results
 */
export function computeOverallVerdict(
  results: Map<string, ComparisonResult>
): {
  verdict: 'pass' | 'block';
  passedScopes: string[];
  blockedScopes: string[];
  ratchetOpportunities: string[];
} {
  const passedScopes: string[] = [];
  const blockedScopes: string[] = [];
  const ratchetOpportunities: string[] = [];
  
  for (const [scope, result] of results) {
    if (result.verdict === 'pass') {
      passedScopes.push(scope);
      if (result.canRatchet) {
        ratchetOpportunities.push(scope);
      }
    } else {
      blockedScopes.push(scope);
    }
  }
  
  return {
    verdict: blockedScopes.length > 0 ? 'block' : 'pass',
    passedScopes,
    blockedScopes,
    ratchetOpportunities
  };
}

/**
 * Generate human-readable report
 */
export function generateReport(
  results: Map<string, ComparisonResult>,
  overall: ReturnType<typeof computeOverallVerdict>
): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(80));
  lines.push('BASELINE COMPARISON REPORT');
  lines.push('='.repeat(80));
  lines.push('');
  
  // Overall verdict
  lines.push(`OVERALL VERDICT: ${overall.verdict.toUpperCase()}`);
  lines.push('');
  
  // Scope details
  for (const [scope, result] of results) {
    const icon = result.verdict === 'pass' ? '✅' : '❌';
    lines.push(`${icon} ${scope.toUpperCase()}`);
    lines.push(`   Policy: ${result.verdict === 'pass' ? 'PASS' : 'BLOCK'}`);
    lines.push(`   Reason: ${result.reason || 'N/A'}`);
    lines.push('');
    
    if (result.newFindings.length > 0) {
      lines.push(`   NEW VIOLATIONS (${result.newFindings.length}):`);
      for (const finding of result.newFindings.slice(0, 5)) {
        lines.push(`   - ${finding.file}:${finding.line}: ${finding.message}`);
      }
      if (result.newFindings.length > 5) {
        lines.push(`   ... and ${result.newFindings.length - 5} more`);
      }
      lines.push('');
    }
    
    if (result.resolvedFindings.length > 0) {
      lines.push(`   RESOLVED VIOLATIONS (${result.resolvedFindings.length}):`);
      for (const finding of result.resolvedFindings.slice(0, 3)) {
        lines.push(`   - ${finding.file}:${finding.line}: ${finding.message}`);
      }
      if (result.resolvedFindings.length > 3) {
        lines.push(`   ... and ${result.resolvedFindings.length - 3} more`);
      }
      lines.push('');
    }
    
    if (result.existingFindings.length > 0) {
      lines.push(`   EXISTING VIOLATIONS (${result.existingFindings.length}): tolerated`);
      lines.push('');
    }
  }
  
  // Ratchet opportunities
  if (overall.ratchetOpportunities.length > 0) {
    lines.push('🎯 RATCHET OPPORTUNITIES:');
    for (const scope of overall.ratchetOpportunities) {
      lines.push(`   - ${scope}: Debt decreased, baseline can be updated`);
    }
    lines.push('');
  }
  
  lines.push('='.repeat(80));
  
  return lines.join('\n');
}

/**
 * Example usage:
 * 
 * ```typescript
 * import { compareBaseline, computeOverallVerdict, generateReport } from './comparator';
 * import fs from 'fs';
 * 
 * // Load baselines
 * const baseline = JSON.parse(fs.readFileSync('.github/ci/baselines/main.json', 'utf-8'));
 * const current = JSON.parse(fs.readFileSync('.github/ci/baselines/current.json', 'utf-8'));
 * 
 * // Compare
 * const results = compareBaseline(current, baseline);
 * const overall = computeOverallVerdict(results);
 * 
 * // Generate report
 * const report = generateReport(results, overall);
 * console.log(report);
 * 
 * // Exit with appropriate code
 * process.exit(overall.verdict === 'pass' ? 0 : 1);
 * ```
 */
