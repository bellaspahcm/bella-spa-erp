/**
 * MIGRATION ADAPTER
 * 
 * Parses migration check output and generates stable fingerprints
 * with PR-relative change detection
 * 
 * Input: migration-check output (custom format)
 * Output: FindingIdentity[] with stable fingerprints + grandfathering metadata
 * 
 * Fingerprint strategy:
 * - migration_id + rule + object
 * - PR-relative policy: "Is this migration changed by THIS PR?"
 * - Grandfathering: Unchanged migration + baseline match = ALLOW
 */

import { FindingIdentity, MigrationComponents, MigrationFinding, PRContext } from '../schema';
import { completeFinding } from '../fingerprint';
import { execSync } from 'child_process';

/**
 * Migration check violation
 */
interface MigrationViolation {
  migration_file: string;
  migration_id: string;      // 20260511500000
  rule: string;              // blocking-index, missing-concurrently, etc.
  object: string;            // Table/index/column name
  line: number;
  message: string;
  severity: 'error' | 'warning';
}

/**
 * Parse migration check output
 * 
 * Expected format (one per line):
 * migrations/20260511500000_create_inventory_items.sql:38:blocking-index:inventory_items_idx:error:Creating index without CONCURRENTLY...
 */
export function parseMigrationCheckOutput(output: string): MigrationViolation[] {
  const violations: MigrationViolation[] = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    
    // Parse format: file:line:rule:object:severity:message
    const parts = trimmed.split(':');
    if (parts.length < 6) continue;
    
    const [file, lineStr, rule, object, severity, ...messageParts] = parts;
    
    // Extract migration ID from filename
    const migrationIdMatch = /(\d{14,})/.exec(file);
    if (!migrationIdMatch) continue;
    
    violations.push({
      migration_file: file,
      migration_id: migrationIdMatch[1],
      rule,
      object,
      line: parseInt(lineStr, 10),
      message: messageParts.join(':'),
      severity: severity as 'error' | 'warning'
    });
  }
  
  return violations;
}

/**
 * Convert migration violation to FindingIdentity
 */
export function convertToFinding(violation: MigrationViolation): FindingIdentity {
  const components: MigrationComponents = {
    migration_id: violation.migration_id,
    rule: violation.rule,
    object: violation.object
  };
  
  return completeFinding({
    file: violation.migration_file,
    line: violation.line,
    tool: 'migration-check',
    severity: violation.severity,
    components,
    message: violation.message
  });
}

/**
 * Check if a migration file was modified by current PR
 * 
 * Uses: git diff --name-only merge-base..HEAD
 * 
 * CRITICAL: This determines whether to apply strict policy or allow grandfathering
 */
export function isMigrationModifiedByPR(
  migrationFile: string,
  prContext: PRContext
): boolean {
  try {
    const output = execSync(
      `git diff --name-only ${prContext.base}..${prContext.head}`,
      { encoding: 'utf-8' }
    );
    
    const modifiedFiles = output
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0)
      .map(f => f.replace(/\\/g, '/'));
    
    const normalized = migrationFile.replace(/\\/g, '/');
    
    return modifiedFiles.includes(normalized);
  } catch (error) {
    console.error('Failed to check migration modifications:', error);
    // Conservative: treat as modified if check fails
    return true;
  }
}

/**
 * Apply conditional grandfathering policy
 * 
 * Rules:
 * 1. PR modifies migration → STRICT (violation = BLOCK)
 * 2. PR does NOT modify migration + finding in baseline → ALLOW (grandfathered)
 * 3. PR does NOT modify migration + finding NOT in baseline → BLOCK (new violation in unchanged file = error)
 */
export function applyGrandfatheringPolicy(
  findings: FindingIdentity[],
  baselineFindings: FindingIdentity[],
  prContext: PRContext
): MigrationFinding[] {
  const baselineSet = new Set(baselineFindings.map(f => f.fingerprint));
  const migrationFindings: MigrationFinding[] = [];
  
  for (const finding of findings) {
    const isModified = isMigrationModifiedByPR(finding.file, prContext);
    const inBaseline = baselineSet.has(finding.fingerprint);
    
    // Determine grandfathering status
    let grandfathered = false;
    
    if (!isModified && inBaseline) {
      // Unchanged migration + historical violation = ALLOW
      grandfathered = true;
    }
    
    migrationFindings.push({
      ...finding,
      grandfathered
    } as MigrationFinding);
  }
  
  return migrationFindings;
}

/**
 * Main adapter function: parse migration check output → findings with policy
 */
export function adaptMigrationOutput(
  checkOutput: string,
  baselineFindings: FindingIdentity[],
  prContext: PRContext
): MigrationFinding[] {
  const violations = parseMigrationCheckOutput(checkOutput);
  const findings = violations.map(convertToFinding);
  
  return applyGrandfatheringPolicy(findings, baselineFindings, prContext);
}

/**
 * Filter to non-grandfathered violations (actual blockers)
 */
export function filterBlockingViolations(
  findings: MigrationFinding[]
): MigrationFinding[] {
  return findings.filter(f => !f.grandfathered);
}

/**
 * Get PR context from environment or git
 */
export function getPRContext(): PRContext {
  // Try environment variables first (CI)
  const base = process.env.PR_BASE_SHA || process.env.GITHUB_BASE_REF;
  const head = process.env.PR_HEAD_SHA || process.env.GITHUB_SHA || 'HEAD';
  const targetBranch = process.env.PR_TARGET_BRANCH || process.env.GITHUB_BASE_REF || 'main';
  
  if (base) {
    return { base, head, targetBranch };
  }
  
  // Fallback: compute merge-base locally
  try {
    const mergeBase = execSync(
      `git merge-base ${targetBranch} ${head}`,
      { encoding: 'utf-8' }
    ).trim();
    
    return {
      base: mergeBase,
      head,
      targetBranch
    };
  } catch (error) {
    console.error('Failed to compute merge-base:', error);
    throw new Error('Cannot determine PR context. Set PR_BASE_SHA or ensure git is available.');
  }
}

/**
 * Example usage:
 * 
 * ```typescript
 * import { adaptMigrationOutput, getPRContext, filterBlockingViolations } from './migration-adapter';
 * import { execSync } from 'child_process';
 * 
 * // Run migration check
 * let checkOutput = '';
 * try {
 *   checkOutput = execSync(
 *     'node scripts/migrations/zero-downtime-check.js',
 *     { encoding: 'utf-8' }
 *   );
 * } catch (error: any) {
 *   checkOutput = error.stdout || '';
 * }
 * 
 * // Get PR context
 * const prContext = getPRContext();
 * 
 * // Load baseline
 * const baseline = JSON.parse(fs.readFileSync('.github/ci/baselines/main.json', 'utf-8'));
 * const baselineFindings = baseline.scopes['migration-zero-downtime']?.findings || [];
 * 
 * // Convert with grandfathering
 * const findings = adaptMigrationOutput(checkOutput, baselineFindings, prContext);
 * 
 * // Filter to actual blockers
 * const blockers = filterBlockingViolations(findings);
 * 
 * if (blockers.length > 0) {
 *   console.error(`BLOCK: ${blockers.length} new migration violations`);
 *   process.exit(1);
 * }
 * 
 * console.log(`PASS: ${findings.length - blockers.length} grandfathered violations`);
 * ```
 */
