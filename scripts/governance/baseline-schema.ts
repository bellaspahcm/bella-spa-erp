/**
 * Baseline Schema for Phase 1 Regression Protection Mode
 * 
 * Purpose: Enable identity-based diagnostic comparison (not just count-based)
 * 
 * Principle: A diagnostic fingerprint must uniquely identify a specific compiler error
 * so that baseline comparison can distinguish:
 *   - New regression (unknown fingerprint appears)
 *   - Resolved issue (known fingerprint disappears)
 *   - Unchanged issue (known fingerprint persists)
 * 
 * Fingerprint Components:
 *   file + line + column + code + normalized message
 * 
 * Why not just count?
 *   Education: 102 → 103 could mean:
 *     - 1 new error (regression)
 *     - 5 resolved + 6 new (net +1, but regression exists)
 *   Fingerprinting detects both scenarios correctly.
 */

// ============================================================================
// TYPES
// ============================================================================

/**
 * Unique identifier for a TypeScript diagnostic
 * 
 * Extracted from: file.ts(line,col): error TS####: message
 */
export interface DiagnosticFingerprint {
  /** Relative file path from workspace root */
  file: string;
  
  /** Line number (1-indexed, as reported by tsc) */
  line: number;
  
  /** Column number (1-indexed, as reported by tsc) */
  column: number;
  
  /** TypeScript diagnostic code (e.g., "TS2322", "TS2345") */
  code: string;
  
  /** Normalized message pattern (type names replaced with ${TYPE}) */
  messagePattern: string;
}

/**
 * Baseline state for a single scope
 */
export interface ScopeBaseline {
  /** Scope name (e.g., "core", "finance", "education") */
  scope: string;
  
  /** Status at baseline capture time */
  status: 'PASS' | 'FAIL' | 'HOTSPOT';
  
  /** Diagnostic fingerprints (empty for PASS/HOTSPOT) */
  diagnostics: DiagnosticFingerprint[];
  
  /** Capture metadata */
  capturedAt: string; // ISO 8601 timestamp
  duration: number;   // milliseconds
}

/**
 * Complete baseline manifest
 */
export interface BaselineManifest {
  /** Schema version for future compatibility */
  version: '1.0.0';
  
  /** When this baseline was captured */
  capturedAt: string; // ISO 8601 timestamp
  
  /** Git commit hash at capture time (if available) */
  gitCommit?: string;
  
  /** Per-scope baselines */
  scopes: ScopeBaseline[];
  
  /** Summary statistics */
  summary: {
    pass: number;
    fail: number;
    hotspot: number;
    total: number;
    totalDiagnostics: number;
  };
}

/**
 * Regression analysis result
 */
export interface RegressionAnalysis {
  /** Scope being analyzed */
  scope: string;
  
  /** Current status */
  currentStatus: 'PASS' | 'FAIL' | 'HOTSPOT';
  
  /** Baseline status */
  baselineStatus: 'PASS' | 'FAIL' | 'HOTSPOT';
  
  /** New diagnostics (not in baseline) */
  newDiagnostics: DiagnosticFingerprint[];
  
  /** Resolved diagnostics (in baseline, not in current) */
  resolvedDiagnostics: DiagnosticFingerprint[];
  
  /** Unchanged diagnostics (in both baseline and current) */
  unchangedDiagnostics: DiagnosticFingerprint[];
  
  /** Regression verdict */
  verdict: 'ALLOW' | 'BLOCK';
  
  /** Human-readable reason */
  reason: string;
}

/**
 * Full regression check result
 */
export interface RegressionCheckResult {
  /** Per-scope analyses */
  scopes: RegressionAnalysis[];
  
  /** Summary */
  summary: {
    allowed: number;
    blocked: number;
    total: number;
  };
  
  /** Overall verdict */
  verdict: 'ALLOW' | 'BLOCK';
  
  /** Baseline metadata */
  baseline: {
    capturedAt: string;
    gitCommit?: string;
  };
  
  /** Check timestamp */
  checkedAt: string;
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Parse a TypeScript diagnostic line into a fingerprint
 * 
 * Input format: file.ts(line,col): error TS####: message
 * 
 * Example:
 *   src/platform/education/service.ts(55,9): error TS2322: Type 'string' is not assignable to type 'number'.
 * 
 * Extracts:
 *   file: src/platform/education/service.ts
 *   line: 55
 *   column: 9
 *   code: TS2322
 *   message: Type 'string' is not assignable to type 'number'.
 */
export function parseDiagnostic(diagnostic: string): DiagnosticFingerprint | null {
  // Match: file.ts(line,col): error TS####: message
  const match = diagnostic.match(/^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/);
  
  if (!match) {
    return null;
  }
  
  const [, file, lineStr, colStr, code, message] = match;
  
  return {
    file: file.trim(),
    line: parseInt(lineStr, 10),
    column: parseInt(colStr, 10),
    code: code.trim(),
    messagePattern: normalizeMessage(message.trim()),
  };
}

/**
 * Normalize a diagnostic message for stable comparison
 * 
 * Goal: Make fingerprints resilient to minor message variations
 * 
 * Transformations:
 *   - Replace quoted type names with ${TYPE}
 *   - Replace numbers with ${NUM}
 *   - Normalize whitespace
 * 
 * Examples:
 *   "Type 'string' is not assignable to type 'number'"
 *   → "Type ${TYPE} is not assignable to type ${TYPE}"
 * 
 *   "Expected 2 arguments, but got 1"
 *   → "Expected ${NUM} arguments, but got ${NUM}"
 */
export function normalizeMessage(message: string): string {
  let normalized = message;
  
  // Replace quoted strings (type names, property names)
  normalized = normalized.replace(/'[^']+'/g, '${TYPE}');
  
  // Replace standalone numbers
  normalized = normalized.replace(/\b\d+\b/g, '${NUM}');
  
  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  return normalized;
}

/**
 * Convert a fingerprint to a stable string for Set operations
 */
export function fingerprintToString(fp: DiagnosticFingerprint): string {
  return `${fp.file}:${fp.line}:${fp.column}:${fp.code}:${fp.messagePattern}`;
}

/**
 * Compare two fingerprints for equality
 */
export function fingerprintsEqual(a: DiagnosticFingerprint, b: DiagnosticFingerprint): boolean {
  return fingerprintToString(a) === fingerprintToString(b);
}

/**
 * Determine regression verdict for a scope
 * 
 * Rules (Phase 1 Regression Protection Mode):
 * 
 * 1. PASS → PASS: ALLOW (no change)
 * 2. PASS → FAIL: BLOCK (new regression)
 * 3. PASS → HOTSPOT: BLOCK (degradation)
 * 4. FAIL → PASS: ALLOW (improvement, celebrate!)
 * 5. FAIL → FAIL with new diagnostics: BLOCK (regression within baseline scope)
 * 6. FAIL → FAIL with only resolved diagnostics: ALLOW (improvement)
 * 7. FAIL → FAIL with no changes: ALLOW (baseline preserved)
 * 8. FAIL → HOTSPOT: BLOCK (degradation)
 * 9. HOTSPOT → PASS: ALLOW (improvement)
 * 10. HOTSPOT → FAIL: BLOCK (now have diagnostics, need review)
 * 11. HOTSPOT → HOTSPOT: ALLOW (baseline preserved)
 */
export function determineVerdict(
  baselineStatus: 'PASS' | 'FAIL' | 'HOTSPOT',
  currentStatus: 'PASS' | 'FAIL' | 'HOTSPOT',
  newDiagnostics: DiagnosticFingerprint[],
  resolvedDiagnostics: DiagnosticFingerprint[]
): { verdict: 'ALLOW' | 'BLOCK'; reason: string } {
  // PASS → anything but PASS = regression
  if (baselineStatus === 'PASS' && currentStatus !== 'PASS') {
    return {
      verdict: 'BLOCK',
      reason: `Regression: ${baselineStatus} → ${currentStatus}`,
    };
  }
  
  // FAIL → PASS = improvement
  if (baselineStatus === 'FAIL' && currentStatus === 'PASS') {
    return {
      verdict: 'ALLOW',
      reason: `Improvement: ${resolvedDiagnostics.length} diagnostics resolved`,
    };
  }
  
  // FAIL → HOTSPOT = degradation
  if (baselineStatus === 'FAIL' && currentStatus === 'HOTSPOT') {
    return {
      verdict: 'BLOCK',
      reason: 'Degradation: FAIL → HOTSPOT (timeout introduced)',
    };
  }
  
  // FAIL → FAIL with new diagnostics = regression
  if (baselineStatus === 'FAIL' && currentStatus === 'FAIL' && newDiagnostics.length > 0) {
    return {
      verdict: 'BLOCK',
      reason: `Regression: ${newDiagnostics.length} new diagnostic(s) introduced`,
    };
  }
  
  // FAIL → FAIL with only resolved/unchanged = improvement or baseline
  if (baselineStatus === 'FAIL' && currentStatus === 'FAIL') {
    if (resolvedDiagnostics.length > 0) {
      return {
        verdict: 'ALLOW',
        reason: `Improvement: ${resolvedDiagnostics.length} diagnostic(s) resolved, no new regressions`,
      };
    } else {
      return {
        verdict: 'ALLOW',
        reason: 'Baseline preserved: no new regressions',
      };
    }
  }
  
  // HOTSPOT → PASS = improvement
  if (baselineStatus === 'HOTSPOT' && currentStatus === 'PASS') {
    return {
      verdict: 'ALLOW',
      reason: 'Improvement: HOTSPOT → PASS',
    };
  }
  
  // HOTSPOT → FAIL = need review (diagnostics now visible)
  if (baselineStatus === 'HOTSPOT' && currentStatus === 'FAIL') {
    return {
      verdict: 'BLOCK',
      reason: 'HOTSPOT → FAIL: diagnostics now visible, requires review',
    };
  }
  
  // HOTSPOT → HOTSPOT = baseline preserved
  if (baselineStatus === 'HOTSPOT' && currentStatus === 'HOTSPOT') {
    return {
      verdict: 'ALLOW',
      reason: 'Baseline preserved: HOTSPOT remains',
    };
  }
  
  // PASS → PASS = no change
  if (baselineStatus === 'PASS' && currentStatus === 'PASS') {
    return {
      verdict: 'ALLOW',
      reason: 'No change: PASS maintained',
    };
  }
  
  // Fallback (should not reach)
  return {
    verdict: 'BLOCK',
    reason: `Unknown transition: ${baselineStatus} → ${currentStatus}`,
  };
}
