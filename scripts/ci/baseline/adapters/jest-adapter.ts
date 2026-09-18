/**
 * JEST ADAPTER
 * 
 * Parses Jest JSON output and generates stable fingerprints
 * 
 * Input: jest --json output
 * Output: FindingIdentity[] with stable fingerprints
 * 
 * Fingerprint strategy:
 * - suite + test + failure_reason_hash
 * - CRITICAL: Same test with different failure reason = different finding
 * - This prevents historical baseline from masking new failures
 */

import { FindingIdentity, JestComponents } from '../schema';
import { completeFinding, generateFailureReasonHash } from '../fingerprint';

/**
 * Jest JSON output structure (subset of relevant fields)
 */
interface JestResult {
  testResults: JestTestResult[];
  numFailedTests: number;
  numPassedTests: number;
  success: boolean;
}

interface JestTestResult {
  name: string;  // Test file path
  status: 'passed' | 'failed';
  assertionResults: JestAssertion[];
}

interface JestAssertion {
  ancestorTitles: string[];  // Suite hierarchy
  title: string;             // Test name
  status: 'passed' | 'failed' | 'pending' | 'skipped';
  fullName: string;
  failureMessages: string[];
  location?: {
    line: number;
    column: number;
  };
}

/**
 * Parse Jest JSON output
 */
export function parseJestJSON(jsonOutput: string): JestResult {
  try {
    return JSON.parse(jsonOutput) as JestResult;
  } catch (error) {
    console.error('Failed to parse Jest JSON:', error);
    return {
      testResults: [],
      numFailedTests: 0,
      numPassedTests: 0,
      success: true
    };
  }
}

/**
 * Extract stack trace from failure message
 */
function extractStackTrace(failureMessage: string): string | undefined {
  const lines = failureMessage.split('\n');
  const stackStart = lines.findIndex(line => line.trim().startsWith('at '));
  
  if (stackStart === -1) return undefined;
  
  return lines.slice(stackStart).join('\n');
}

/**
 * Extract error message (first line before stack)
 */
function extractErrorMessage(failureMessage: string): string {
  const lines = failureMessage.split('\n');
  
  // Find first non-empty line that's not part of stack
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('at ') && !trimmed.startsWith('Error:')) {
      return trimmed;
    }
  }
  
  return failureMessage.split('\n')[0] || 'Unknown error';
}

/**
 * Convert Jest assertion to FindingIdentity with stable fingerprint
 */
export function convertToFinding(
  testFile: string,
  assertion: JestAssertion
): FindingIdentity | null {
  // Only process failed tests
  if (assertion.status !== 'failed') {
    return null;
  }
  
  // Build suite path from ancestor titles
  const suite = assertion.ancestorTitles.join(' > ');
  const test = assertion.title;
  
  // Get first failure message (there may be multiple assertions)
  const failureMessage = assertion.failureMessages[0] || 'Unknown failure';
  
  // Extract error message and stack
  const errorMessage = extractErrorMessage(failureMessage);
  const stack = extractStackTrace(failureMessage);
  
  // Generate failure reason hash
  // CRITICAL: This captures the semantic nature of the failure
  // Same test with different failure type = different finding
  const failure_reason_hash = generateFailureReasonHash(errorMessage, stack);
  
  const components: JestComponents = {
    suite,
    test,
    failure_reason_hash
  };
  
  return completeFinding({
    file: testFile,
    line: assertion.location?.line,
    column: assertion.location?.column,
    tool: 'jest',
    severity: 'error',
    components,
    message: errorMessage
  });
}

/**
 * Main adapter function: parse Jest JSON → stable findings
 */
export function adaptJestOutput(jestJSON: string): FindingIdentity[] {
  const result = parseJestJSON(jestJSON);
  const findings: FindingIdentity[] = [];
  
  for (const testResult of result.testResults) {
    for (const assertion of testResult.assertionResults) {
      const finding = convertToFinding(testResult.name, assertion);
      if (finding) {
        findings.push(finding);
      }
    }
  }
  
  return findings;
}

/**
 * Filter findings by test file pattern
 */
export function filterByTestPattern(
  findings: FindingIdentity[],
  pattern: RegExp
): FindingIdentity[] {
  return findings.filter(f => pattern.test(f.file));
}

/**
 * Group findings by suite
 */
export function groupBySuite(
  findings: FindingIdentity[]
): Map<string, FindingIdentity[]> {
  const groups = new Map<string, FindingIdentity[]>();
  
  for (const finding of findings) {
    const components = finding.components as JestComponents;
    const suite = components.suite;
    const list = groups.get(suite) || [];
    list.push(finding);
    groups.set(suite, list);
  }
  
  return groups;
}

/**
 * Detect if finding is same test but different failure
 * (used for adversarial verification)
 */
export function isSameTestDifferentFailure(
  baseline: FindingIdentity,
  current: FindingIdentity
): boolean {
  const baselineComps = baseline.components as JestComponents;
  const currentComps = current.components as JestComponents;
  
  // Same suite + test
  const sameTest = 
    baselineComps.suite === currentComps.suite &&
    baselineComps.test === currentComps.test;
  
  // Different failure reason
  const differentReason = 
    baselineComps.failure_reason_hash !== currentComps.failure_reason_hash;
  
  return sameTest && differentReason;
}

/**
 * Example usage:
 * 
 * ```typescript
 * import { adaptJestOutput } from './jest-adapter';
 * import { execSync } from 'child_process';
 * 
 * // Run Jest with JSON reporter
 * let jestOutput = '';
 * try {
 *   jestOutput = execSync(
 *     'npx jest --json --testPathPattern="src/platform"',
 *     { encoding: 'utf-8' }
 *   );
 * } catch (error: any) {
 *   // Jest outputs JSON even on failure
 *   jestOutput = error.stdout || '{}';
 * }
 * 
 * // Convert to findings
 * const findings = adaptJestOutput(jestOutput);
 * 
 * console.log(`Found ${findings.length} test failures`);
 * 
 * // Group by suite for reporting
 * const bySuite = groupBySuite(findings);
 * for (const [suite, failures] of bySuite) {
 *   console.log(`${suite}: ${failures.length} failures`);
 * }
 * ```
 */
