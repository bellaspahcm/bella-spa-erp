/**
 * ESLINT ADAPTER
 * 
 * Parses ESLint JSON output and generates stable fingerprints
 * 
 * Input: eslint --format json output
 * Output: FindingIdentity[] with stable fingerprints
 * 
 * Fingerprint strategy:
 * - file + rule_id + AST context hash
 * - Line/column stored but NOT part of identity
 * - Context captures structural position in code
 */

import { FindingIdentity, ESLintComponents } from '../schema';
import { completeFinding, generateASTContextHash } from '../fingerprint';

/**
 * ESLint JSON output structure
 */
interface ESLintResult {
  filePath: string;
  messages: ESLintMessage[];
  errorCount: number;
  warningCount: number;
}

interface ESLintMessage {
  ruleId: string | null;
  severity: 1 | 2;  // 1 = warning, 2 = error
  message: string;
  line: number;
  column: number;
  nodeType?: string;
  messageId?: string;
  endLine?: number;
  endColumn?: number;
}

/**
 * Parse ESLint JSON output
 */
export function parseESLintJSON(jsonOutput: string): ESLintResult[] {
  if (!jsonOutput || jsonOutput.trim() === '') {
    return [];
  }
  try {
    return JSON.parse(jsonOutput) as ESLintResult[];
  } catch (error: any) {
    console.error('Failed to parse ESLint JSON:', error);
    console.error('JSON output length:', jsonOutput.length);
    console.error('First 200 chars:', jsonOutput.substring(0, 200));
    console.error('Last 200 chars:', jsonOutput.substring(Math.max(0, jsonOutput.length - 200)));
    throw new Error(
      `FAIL-CLOSED: ESLint output is invalid or truncated JSON (${error?.message || error}). ` +
      `GOVERNANCE: Parser failure MUST NOT become 0 findings.`
    );
  }
}

/**
 * Convert ESLint message to FindingIdentity with stable fingerprint
 */
export function convertToFinding(
  filePath: string,
  message: ESLintMessage
): FindingIdentity | null {
  // Skip findings without ruleId (parsing errors, etc.)
  if (!message.ruleId) {
    return null;
  }
  
  const severity = message.severity === 2 ? 'error' : 'warning';
  
  // Generate AST context hash
  // This helps distinguish same rule violations in different code contexts
  const context = generateASTContextHash(
    message.ruleId,
    message.nodeType,
    message.messageId
  );
  
  const components: ESLintComponents = {
    rule_id: message.ruleId,
    context
  };
  
  return completeFinding({
    file: filePath,
    line: message.line,
    column: message.column,
    tool: 'eslint',
    severity,
    components,
    message: message.message
  });
}

/**
 * Main adapter function: parse ESLint JSON → stable findings
 */
export function adaptESLintOutput(eslintJSON: string): FindingIdentity[] {
  const results = parseESLintJSON(eslintJSON);
  const findings: FindingIdentity[] = [];
  
  for (const result of results) {
    for (const message of result.messages) {
      const finding = convertToFinding(result.filePath, message);
      if (finding) {
        findings.push(finding);
      }
    }
  }
  
  return findings;
}

/**
 * Filter findings by severity
 */
export function filterBySeverity(
  findings: FindingIdentity[],
  severity: 'error' | 'warning'
): FindingIdentity[] {
  return findings.filter(f => f.severity === severity);
}

/**
 * Filter findings by rule ID pattern
 */
export function filterByRulePattern(
  findings: FindingIdentity[],
  pattern: RegExp
): FindingIdentity[] {
  return findings.filter(f => {
    const components = f.components as ESLintComponents;
    return pattern.test(components.rule_id);
  });
}

/**
 * Group findings by rule ID
 */
export function groupByRule(
  findings: FindingIdentity[]
): Map<string, FindingIdentity[]> {
  const groups = new Map<string, FindingIdentity[]>();
  
  for (const finding of findings) {
    const components = finding.components as ESLintComponents;
    const ruleId = components.rule_id;
    const list = groups.get(ruleId) || [];
    list.push(finding);
    groups.set(ruleId, list);
  }
  
  return groups;
}

/**
 * Get changed files from git (for changed-file lint scope)
 */
export async function getChangedFiles(base: string, head: string): Promise<string[]> {
  const { execSync } = await import('child_process');
  
  try {
    const output = execSync(
      `git diff --name-only ${base}..${head}`,
      { encoding: 'utf-8' }
    );
    
    return output
      .split('\n')
      .map(f => f.trim())
      .filter(f => f.length > 0);
  } catch (error) {
    console.error('Failed to get changed files:', error);
    return [];
  }
}

/**
 * Filter findings to only changed files (for PR scope)
 */
export function filterChangedFiles(
  findings: FindingIdentity[],
  changedFiles: string[]
): FindingIdentity[] {
  const changedSet = new Set(
    changedFiles.map(f => f.replace(/\\/g, '/').toLowerCase())
  );
  
  return findings.filter(f => {
    const normalized = f.file.replace(/\\/g, '/').toLowerCase();
    return changedSet.has(normalized);
  });
}

/**
 * Example usage:
 * 
 * ```typescript
 * import { adaptESLintOutput, getChangedFiles, filterChangedFiles } from './eslint-adapter';
 * import { execSync } from 'child_process';
 * 
 * // Run ESLint with JSON format
 * let eslintOutput = '';
 * try {
 *   eslintOutput = execSync(
 *     'npx eslint . --format json',
 *     { encoding: 'utf-8' }
 *   );
 * } catch (error: any) {
 *   eslintOutput = error.stdout || '[]';
 * }
 * 
 * // Convert to findings
 * const allFindings = adaptESLintOutput(eslintOutput);
 * 
 * // Filter to changed files only (for PR checks)
 * const changedFiles = await getChangedFiles('origin/main', 'HEAD');
 * const prFindings = filterChangedFiles(allFindings, changedFiles);
 * 
 * console.log(`Found ${prFindings.length} findings in changed files`);
 * ```
 */
