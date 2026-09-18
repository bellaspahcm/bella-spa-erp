/**
 * IDENTITY-AWARE NO-NEW-DEBT BASELINE SYSTEM
 * 
 * Canonical Finding Schema + Stable Fingerprinting
 * 
 * Design Principles:
 * 1. Fingerprint stability: NOT based on line/column (survives code movement)
 * 2. Semantic awareness: Captures sufficient context to detect real changes
 * 3. Tool-specific: Each tool has optimized fingerprint strategy
 * 4. Identity-first: Fingerprint is primary key, location is display metadata
 */

/**
 * Supported analysis tools
 */
export type Tool = 'typescript' | 'eslint' | 'jest' | 'migration-check';

/**
 * Finding severity
 */
export type Severity = 'error' | 'warning';

/**
 * Policy enforcement level
 */
export type PolicyLevel = 
  | 'zero-tolerance'              // Any violation blocks
  | 'no-new-debt'                 // Existing tolerated, new blocked
  | 'no-new-debt-with-reason'     // + failure reason must match
  | 'conditional-grandfathering'; // Modified = strict, unchanged = baseline

/**
 * Core fingerprint components for TypeScript diagnostics
 */
export interface TypeScriptComponents {
  code: string;           // TS2353, TS2322, etc.
  symbol?: string;        // Normalized symbol name
  message_sig: string;    // Message signature hash (semantic-aware)
}

/**
 * Core fingerprint components for ESLint violations
 */
export interface ESLintComponents {
  rule_id: string;        // react/no-unescaped-entities, @typescript-eslint/no-explicit-any
  context?: string;       // Normalized AST context hash
}

/**
 * Core fingerprint components for Jest test failures
 */
export interface JestComponents {
  suite: string;                // Full suite path
  test: string;                 // Test name
  failure_reason_hash: string;  // CRITICAL: Normalized error signature
                                // Same test with different failure = different finding
}

/**
 * Core fingerprint components for migration violations
 */
export interface MigrationComponents {
  migration_id: string;   // 20260511500000
  rule: string;           // blocking-index, missing-concurrently, etc.
  object: string;         // Normalized table/index/column name
}

/**
 * Union of all fingerprint component types
 */
export type FingerprintComponents = 
  | TypeScriptComponents
  | ESLintComponents
  | JestComponents
  | MigrationComponents;

/**
 * Canonical Finding Identity
 * 
 * The fingerprint is the stable identity that survives:
 * - Line additions/removals above the finding
 * - Code reformatting
 * - File renames (if tracked correctly)
 * 
 * But changes when:
 * - The actual error changes semantically
 * - Symbol/context changes
 * - Test failure reason changes
 */
export interface FindingIdentity {
  /**
   * Stable fingerprint - PRIMARY KEY
   * Format: tool:file:component1:component2:...
   * 
   * Examples:
   * - ts:src/file.ts:TS2353:turboConfig:abc123
   * - eslint:src/app/page.tsx:react/no-unescaped-entities:def456
   * - jest:PayrollProvider:maxBonus test:ghi789
   * - migration:20260511500000:blocking-index:inventory_items_idx
   */
  fingerprint: string;
  
  /**
   * Display location (may shift, NOT part of identity)
   */
  file: string;
  line?: number;
  column?: number;
  
  /**
   * Tool metadata
   */
  tool: Tool;
  severity: Severity;
  
  /**
   * Fingerprint components (tool-specific)
   */
  components: FingerprintComponents;
  
  /**
   * Human-readable message (for display/debugging)
   */
  message: string;
  
  /**
   * When this finding was first detected (for ratchet governance)
   */
  first_seen?: string; // ISO date
}

/**
 * Scope-specific baseline configuration
 */
export interface BaselineScope {
  /**
   * Policy enforcement level for this scope
   */
  policy: PolicyLevel;
  
  /**
   * Findings in this scope
   */
  findings: FindingIdentity[];
  
  /**
   * Total count (for quick validation)
   */
  count: number;
  
  /**
   * Optional: Additional metadata
   */
  metadata?: {
    last_updated?: string;
    notes?: string;
  };
}

/**
 * Migration-specific metadata
 */
export interface MigrationFinding extends FindingIdentity {
  /**
   * Whether this violation is grandfathered
   * (existed before current policy, unchanged by PRs)
   */
  grandfathered?: boolean;
  
  /**
   * Last PR that modified this migration
   */
  last_modified_by?: string;
}

/**
 * Policy definitions
 */
export interface PolicyDefinition {
  description: string;
  enforcement: string; // Human-readable enforcement rule
}

/**
 * Complete baseline file structure
 */
export interface Baseline {
  /**
   * Schema version (for future evolution)
   */
  version: string;
  
  /**
   * When this baseline was generated
   */
  generated_at: string; // ISO timestamp
  
  /**
   * Git commit this baseline represents
   */
  commit: string;
  
  /**
   * Scopes (TypeScript, ESLint, Jest, Migration)
   */
  scopes: {
    'typescript-full'?: BaselineScope;
    'eslint-changed'?: BaselineScope;
    'jest-affected'?: BaselineScope;
    'migration-zero-downtime'?: BaselineScope;
  };
  
  /**
   * Policy definitions
   */
  policies: Record<PolicyLevel, PolicyDefinition>;
}

/**
 * Comparison result
 */
export interface ComparisonResult {
  /**
   * Scope being compared
   */
  scope: string;
  
  /**
   * Findings present in current but not baseline
   */
  newFindings: FindingIdentity[];
  
  /**
   * Findings present in baseline but not current
   */
  resolvedFindings: FindingIdentity[];
  
  /**
   * Findings present in both (matched by fingerprint)
   */
  existingFindings: FindingIdentity[];
  
  /**
   * Overall verdict
   */
  verdict: 'pass' | 'block';
  
  /**
   * Reason for verdict
   */
  reason?: string;
  
  /**
   * Ratchet opportunity (debt decreased)
   */
  canRatchet: boolean;
}

/**
 * Git diff context for PR-relative checks
 */
export interface PRContext {
  /**
   * Merge base between PR and target branch
   */
  base: string;
  
  /**
   * PR head commit
   */
  head: string;
  
  /**
   * Target branch name
   */
  targetBranch: string;
}
