/**
 * BELLA FACTORY — EVIDENCE ADAPTERS
 * 
 * Parse existing tool outputs → structured evidence
 * 
 * Principles:
 * - Consume ONLY existing tool outputs (no tool execution)
 * - Preserve original semantics (PASS/FAIL/TIMEOUT/HOTSPOT)
 * - No inference or invention
 */

import type {
  BuildEvidence,
  ArchitectureGuardEvidence,
  TestEvidence,
} from './evidence-contract';

// ============================================================================
// ARCHITECTURE GUARD ADAPTER
// ============================================================================

/**
 * Parse Architecture Guard stdout → structured evidence
 * 
 * Source: scripts/architecture/architecture-guard.ts
 * Output format: Console text with status + violations
 * Exit codes: 0 (PASS), 1-4 (FAIL), timeout (env failure)
 */
export function parseArchitectureGuard(
  stdout: string,
  exitCode: number,
  timedOut: boolean = false
): ArchitectureGuardEvidence {
  // Handle timeout (environmental failure)
  if (timedOut) {
    return {
      status: 'TIMEOUT',
      violations: [],
    };
  }

  // Exit 0 = PASS
  if (exitCode === 0) {
    return {
      status: 'PASS',
      violations: [],
    };
  }

  // Non-zero exit = FAIL with violations
  const violations: ArchitectureGuardEvidence['violations'] = [];

  // Parse violation patterns from stdout
  // Example: "❌ FROZEN_FILE_MISSING" or "❌ HASH_MISMATCH"
  const violationPattern = /❌\s+(\w+)\s+File:\s*(.+?)\s+Details:\s*([\s\S]+?)(?=\n\n|$)/g;
  let match;

  while ((match = violationPattern.exec(stdout)) !== null) {
    const [, type, file, details] = match;
    
    // Extract layer from file path (e.g., "src/platform/logistics/domain" → "logistics")
    const layerMatch = file.match(/platform\/(\w+)/);
    const layer = layerMatch ? layerMatch[1] : 'unknown';

    violations.push({
      layer,
      type: type.trim(),
      severity: 'ERROR',
      details: details.trim(),
    });
  }

  return {
    status: 'FAIL',
    violations,
  };
}

// ============================================================================
// BUILD (GATE B) ADAPTER
// ============================================================================

/**
 * Parse Gate B stdout → structured evidence per scope
 * 
 * Source: scripts/governance/scoped-typecheck.ts
 * Output format: Console text with per-scope results
 * Exit codes: 0 (all PASS), 1 (FAIL), 2 (HOTSPOT), 3 (INCOMPLETE)
 */
export function parseBuild(
  stdout: string,
  exitCode: number
): BuildEvidence[] {
  const evidence: BuildEvidence[] = [];

  // Parse scope results
  // Example patterns:
  // "✅ platform-healthcare: PASS (1.2s, 0 diagnostics)"
  // "❌ platform-host: FAIL (2.5s, 47 diagnostics)"
  // "🔥 platform-logistics: HOTSPOT (>180s timeout)"
  
  const passPattern = /✅\s+([\w-]+):\s+PASS\s+\(([0-9.]+)s,\s+(\d+)\s+diagnostics?\)/g;
  const failPattern = /❌\s+([\w-]+):\s+FAIL\s+\(([0-9.]+)s,\s+(\d+)\s+diagnostics?\)/g;
  const hotspotPattern = /🔥\s+([\w-]+):\s+HOTSPOT\s+\(>(\d+)s\s+timeout\)/g;

  // Parse PASS results
  let match;
  while ((match = passPattern.exec(stdout)) !== null) {
    const [, scope, durationSec, diagnosticCount] = match;
    evidence.push({
      scope,
      status: 'PASS',
      duration: parseFloat(durationSec) * 1000, // Convert to milliseconds
      diagnosticCount: parseInt(diagnosticCount, 10),
    });
  }

  // Parse FAIL results
  while ((match = failPattern.exec(stdout)) !== null) {
    const [, scope, durationSec, diagnosticCount] = match;
    
    // Extract sample diagnostics if present
    const diagnosticsPattern = new RegExp(
      `${scope}.*?diagnostics:[\\s\\S]*?(?=\\n\\n|$)`,
      'i'
    );
    const diagnosticsMatch = stdout.match(diagnosticsPattern);
    const diagnostics = diagnosticsMatch
      ? diagnosticsMatch[0].split('\n').slice(1, 4) // Sample first 3
      : undefined;

    evidence.push({
      scope,
      status: 'FAIL',
      duration: parseFloat(durationSec) * 1000,
      diagnosticCount: parseInt(diagnosticCount, 10),
      diagnostics,
    });
  }

  // Parse HOTSPOT results
  while ((match = hotspotPattern.exec(stdout)) !== null) {
    const [, scope, timeoutSec] = match;
    evidence.push({
      scope,
      status: 'HOTSPOT',
      duration: parseInt(timeoutSec, 10) * 1000, // Timeout threshold
      diagnosticCount: 0, // No diagnostics for timeout
    });
  }

  return evidence;
}

// ============================================================================
// TEST (JEST) ADAPTER
// ============================================================================

/**
 * Parse Jest JSON output → structured evidence per suite
 * 
 * Source: jest --json
 * Output format: JSON with test results
 */
export function parseTests(jestJson: any): TestEvidence[] {
  if (!jestJson || !jestJson.testResults) {
    return [];
  }

  return jestJson.testResults.map((suite: any) => {
    const suiteName = suite.name || 'unknown';
    const numFailingTests = suite.numFailingTests || 0;
    const numPassingTests = suite.numPassingTests || 0;
    const numPendingTests = suite.numPendingTests || 0;
    const numTotalTests = suite.numTotalTests || 0;

    // Determine suite status
    let status: TestEvidence['status'];
    if (numFailingTests > 0) {
      status = 'FAIL';
    } else if (numPendingTests === numTotalTests && numTotalTests > 0) {
      status = 'SKIP';
    } else {
      status = 'PASS';
    }

    // Extract failure details
    const failures: TestEvidence['failures'] =
      suite.testResults
        ?.filter((test: any) => test.status === 'failed')
        .map((test: any) => ({
          testName: test.fullName || test.title,
          errorMessage: test.failureMessages?.[0] || 'Unknown error',
        })) || [];

    return {
      suiteName,
      status,
      testCount: numTotalTests,
      passedCount: numPassingTests,
      failedCount: numFailingTests,
      skippedCount: numPendingTests,
      duration: suite.duration || 0,
      failures: failures.length > 0 ? failures : undefined,
    };
  });
}
