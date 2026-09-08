/**
 * BELLA FACTORY — EVIDENCE COLLECTION CONTRACT (TRIMMED)
 * 
 * Minimal contract for automated evidence gathering from existing verification tools.
 * 
 * Purpose: Aggregate machine-generated results → reproducible evidence bundle
 * 
 * Principles:
 * 1. Consume existing outputs only (does NOT re-run tools)
 * 2. No invented/inferred evidence (preserve original tool semantics)
 * 3. No qualification judgments (collector gathers, human qualifies)
 * 
 * Trimmed from 226 LOC / 15 exports → ~106 LOC / 8 exports (53% reduction)
 */

// ============================================================================
// EVIDENCE FROM EXISTING TOOLS
// ============================================================================

/**
 * Evidence from TypeScript build verification (Gate B)
 * 
 * Source: npm run governance:typecheck (console stdout)
 * Canonical: scripts/governance/scoped-typecheck.ts
 */
export interface BuildEvidence {
  scope: string;                            // Scope name (e.g., 'platform-healthcare')
  status: 'PASS' | 'FAIL' | 'HOTSPOT';     // HOTSPOT = timeout (no verdict)
  duration: number;                         // Milliseconds
  diagnosticCount: number;                  // Number of TypeScript diagnostics
  diagnostics?: string[];                   // Sample diagnostics if FAIL
}

/**
 * Evidence from Architecture Guard
 * 
 * Source: npm run arch:guard (console stdout + exit code)
 * Canonical: scripts/architecture/architecture-guard.ts
 */
export interface ArchitectureGuardEvidence {
  status: 'PASS' | 'FAIL' | 'TIMEOUT';     // Added TIMEOUT for environmental failures
  violations: Array<{
    layer: string;                          // E7.1, E7.2, E7.3, etc.
    type: string;                           // FROZEN_FILE_MISSING, HASH_MISMATCH, etc.
    severity: 'ERROR' | 'WARNING';
    details: string;
  }>;
}

/**
 * Evidence from test execution (Jest)
 * 
 * Source: jest --json (JSON output file)
 * Canonical: Jest test results
 * 
 * Note: Conformance tests are filtered from this by suite name pattern
 */
export interface TestEvidence {
  suiteName: string;                        // Test suite name
  status: 'PASS' | 'FAIL' | 'SKIP';
  testCount: number;
  passedCount: number;
  failedCount: number;
  skippedCount: number;
  duration: number;                         // Milliseconds
  failures?: Array<{
    testName: string;
    errorMessage: string;
  }>;
}

// ============================================================================
// EVIDENCE BUNDLE
// ============================================================================

/**
 * Complete evidence bundle for one Product manufacturing run
 * 
 * Contract:
 * - All evidence fields from existing tool outputs
 * - No invented/inferred data
 * - No qualification judgments (QUALIFIED/FAILED removed)
 * - Human decides qualification from evidence
 */
export interface ProductEvidenceBundle {
  // Product identity (user-provided, not inferred)
  productId: string;
  version: string;
  
  // Manufacturing input (optional deterministic hash)
  specHash?: string;                        // Hash of input spec (if generated)
  
  // Verification evidence (from existing tools)
  // All optional: undefined = not collected
  build?: BuildEvidence[];
  architectureGuard?: ArchitectureGuardEvidence;
  tests?: TestEvidence[];
  
  // Collection metadata
  collectionTimestamp: string;              // ISO 8601 timestamp
  
  // Execution context (for reproducibility)
  execution?: {
    gitCommit?: string;                     // Codebase SHA
    nodeVersion?: string;                   // Runtime version
    toolVersions?: Record<string, string>;  // Tool versions (tsc, jest, etc.)
  };
}

// ============================================================================
// EVIDENCE COLLECTOR
// ============================================================================

/**
 * Evidence collector configuration
 */
export interface EvidenceCollectorConfig {
  productId: string;
  version: string;
  specHash?: string;                        // Optional input hash
  
  // Execution context
  gitCommit?: string;
  nodeVersion?: string;
  toolVersions?: Record<string, string>;
  
  // Output path
  outputPath?: string;                      // Default: .factory/evidence/{productId}-{timestamp}.json
}

/**
 * Minimal evidence collector interface
 * 
 * Contract:
 * - Consumes existing tool outputs (does NOT re-run)
 * - Read-only operations
 * - Deterministic where inputs are deterministic
 */
export interface IEvidenceCollector {
  /**
   * Collect evidence from existing tool outputs
   * 
   * @param config Collection configuration
   * @returns Evidence bundle + output path
   */
  collect(config: EvidenceCollectorConfig): Promise<{
    bundle: ProductEvidenceBundle;
    bundlePath: string;
  }>;
  
  /**
   * Load existing evidence bundle from disk
   * 
   * @param bundlePath Path to evidence JSON
   * @returns Parsed bundle
   */
  load(bundlePath: string): ProductEvidenceBundle;
}

// ============================================================================
// ADAPTER FUNCTIONS (Not Interfaces)
// ============================================================================

/**
 * Parse Architecture Guard output → structured evidence
 * 
 * @param stdout Console output from arch:guard
 * @param exitCode Process exit code (0=PASS, 1-4=FAIL)
 * @returns Structured evidence
 */
export type ParseArchitectureGuardFn = (
  stdout: string,
  exitCode: number
) => ArchitectureGuardEvidence;

/**
 * Parse Gate B typecheck output → structured evidence
 * 
 * @param stdout Console output from governance:typecheck
 * @param exitCode Process exit code (0=PASS, 1=FAIL, 2=HOTSPOT)
 * @returns Evidence per scope
 */
export type ParseBuildFn = (
  stdout: string,
  exitCode: number
) => BuildEvidence[];

/**
 * Parse Jest JSON output → structured evidence
 * 
 * @param jestJson Jest --json output object
 * @returns Evidence per test suite
 */
export type ParseTestsFn = (jestJson: any) => TestEvidence[];
