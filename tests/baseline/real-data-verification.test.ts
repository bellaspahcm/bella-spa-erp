/**
 * REAL-DATA VERIFICATION SUITE
 * 
 * Extended verification with negative proof
 * 
 * Purpose: Prove system is NOT more lenient, just smarter
 * - Positive proof: Tolerates historical debt (Cases A, C, E, F)
 * - Negative proof: Still catches new violations (Cases B, D, G)
 * 
 * GATE: All 7 cases MUST PASS before deployment
 */

import { describe, it, expect } from '@jest/globals';
import {
  FindingIdentity,
  Baseline,
  TypeScriptComponents,
  MigrationFinding,
  MigrationComponents
} from '../../scripts/ci/baseline/schema';
import { completeFinding, generateMessageSignature } from '../../scripts/ci/baseline/fingerprint';
import { compareBaseline, computeOverallVerdict } from '../../scripts/ci/baseline/comparator';

describe('Real-Data Verification Suite', () => {
  
  /**
   * CASE A: CURRENT == BASELINE
   * 
   * No changes made, current state identical to baseline
   * Expected: NEW = ∅, PASS
   * Proves: System tolerates historical debt
   */
  it('Case A: Identical state should pass (historical debt tolerated)', () => {
    const historicalFindings: FindingIdentity[] = [
      completeFinding({
        file: 'src/legacy.ts',
        line: 10,
        tool: 'typescript',
        severity: 'error',
        components: {
          code: 'TS2353',
          symbol: 'legacyError',
          message_sig: generateMessageSignature('Property legacyError does not exist', 'legacyError')
        } as TypeScriptComponents,
        message: 'Property legacyError does not exist'
      }),
      completeFinding({
        file: 'src/old-issue.ts',
        line: 20,
        tool: 'typescript',
        severity: 'error',
        components: {
          code: 'TS2322',
          symbol: 'oldType',
          message_sig: generateMessageSignature('Type mismatch', 'oldType')
        } as TypeScriptComponents,
        message: 'Type mismatch'
      })
    ];
    
    const baseline: Baseline = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      commit: 'baseline-commit',
      scopes: {
        'typescript-full': {
          policy: 'no-new-debt',
          findings: historicalFindings,
          count: historicalFindings.length
        }
      },
      policies: {
        'zero-tolerance': { description: '', enforcement: '' },
        'no-new-debt': { description: '', enforcement: '' },
        'no-new-debt-with-reason': { description: '', enforcement: '' },
        'conditional-grandfathering': { description: '', enforcement: '' }
      }
    };
    
    // Current state identical to baseline
    const current: Baseline = {
      ...baseline,
      generated_at: new Date().toISOString(),
      commit: 'current-commit'
    };
    
    const results = compareBaseline(current, baseline);
    const overall = computeOverallVerdict(results);
    
    expect(overall.verdict).toBe('pass');
    expect(overall.blockedScopes).toHaveLength(0);
    
    const tsResult = results.get('typescript-full');
    expect(tsResult?.newFindings).toHaveLength(0);
    expect(tsResult?.existingFindings).toHaveLength(2);
  });
  
  /**
   * CASE B: Add 1 genuinely new finding
   * 
   * Introduce a new violation not in baseline
   * Expected: NEW = 1, BLOCK
   * Proves: System catches new violations
   */
  it('Case B: New finding should be blocked (negative detection works)', () => {
    const historicalFindings: FindingIdentity[] = [
      completeFinding({
        file: 'src/legacy.ts',
        line: 10,
        tool: 'typescript',
        severity: 'error',
        components: {
          code: 'TS2353',
          symbol: 'legacyError',
          message_sig: generateMessageSignature('Property legacyError does not exist', 'legacyError')
        } as TypeScriptComponents,
        message: 'Property legacyError does not exist'
      })
    ];
    
    const baseline: Baseline = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      commit: 'baseline-commit',
      scopes: {
        'typescript-full': {
          policy: 'no-new-debt',
          findings: historicalFindings,
          count: historicalFindings.length
        }
      },
      policies: {
        'zero-tolerance': { description: '', enforcement: '' },
        'no-new-debt': { description: '', enforcement: '' },
        'no-new-debt-with-reason': { description: '', enforcement: '' },
        'conditional-grandfathering': { description: '', enforcement: '' }
      }
    };
    
    // Current introduces 1 NEW finding
    const newFinding = completeFinding({
      file: 'src/new-regression.ts',
      line: 50,
      tool: 'typescript',
      severity: 'error',
      components: {
        code: 'TS2322',
        symbol: 'newBug',
        message_sig: generateMessageSignature('Type string not assignable to number', 'newBug')
      } as TypeScriptComponents,
      message: 'Type string not assignable to number'
    });
    
    const current: Baseline = {
      ...baseline,
      generated_at: new Date().toISOString(),
      commit: 'current-commit',
      scopes: {
        'typescript-full': {
          policy: 'no-new-debt',
          findings: [...historicalFindings, newFinding],
          count: historicalFindings.length + 1
        }
      }
    };
    
    const results = compareBaseline(current, baseline);
    const overall = computeOverallVerdict(results);
    
    // MUST block
    expect(overall.verdict).toBe('block');
    expect(overall.blockedScopes).toContain('typescript-full');
    
    const tsResult = results.get('typescript-full');
    expect(tsResult?.newFindings).toHaveLength(1);
    expect(tsResult?.verdict).toBe('block');
  });
  
  /**
   * CASE C: Move code (line shift)
   * 
   * Same finding moved to different line
   * Expected: Fingerprint unchanged, NEW = ∅, PASS
   * Proves: Fingerprint stability works
   */
  it('Case C: Line shift should not create new finding (fingerprint stability)', () => {
    const originalFinding = completeFinding({
      file: 'src/stable.ts',
      line: 10,
      tool: 'typescript',
      severity: 'error',
      components: {
        code: 'TS2353',
        symbol: 'stableError',
        message_sig: generateMessageSignature('Property stableError does not exist', 'stableError')
      } as TypeScriptComponents,
      message: 'Property stableError does not exist'
    });
    
    const baseline: Baseline = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      commit: 'baseline-commit',
      scopes: {
        'typescript-full': {
          policy: 'no-new-debt',
          findings: [originalFinding],
          count: 1
        }
      },
      policies: {
        'zero-tolerance': { description: '', enforcement: '' },
        'no-new-debt': { description: '', enforcement: '' },
        'no-new-debt-with-reason': { description: '', enforcement: '' },
        'conditional-grandfathering': { description: '', enforcement: '' }
      }
    };
    
    // Same finding, line shifted from 10 → 25
    const shiftedFinding = completeFinding({
      file: 'src/stable.ts',
      line: 25,  // Line changed
      tool: 'typescript',
      severity: 'error',
      components: {
        code: 'TS2353',
        symbol: 'stableError',  // Same symbol
        message_sig: generateMessageSignature('Property stableError does not exist', 'stableError')  // Same message
      } as TypeScriptComponents,
      message: 'Property stableError does not exist'
    });
    
    // Fingerprints should match (line not part of identity)
    expect(shiftedFinding.fingerprint).toBe(originalFinding.fingerprint);
    
    const current: Baseline = {
      ...baseline,
      generated_at: new Date().toISOString(),
      commit: 'current-commit',
      scopes: {
        'typescript-full': {
          policy: 'no-new-debt',
          findings: [shiftedFinding],
          count: 1
        }
      }
    };
    
    const results = compareBaseline(current, baseline);
    const overall = computeOverallVerdict(results);
    
    expect(overall.verdict).toBe('pass');
    
    const tsResult = results.get('typescript-full');
    expect(tsResult?.newFindings).toHaveLength(0);
    expect(tsResult?.existingFindings).toHaveLength(1);
  });
  
  /**
   * CASE D: Change finding identity (symbol/message)
   * 
   * Same file, same code, but semantic change
   * Expected: Fingerprint changed, NEW = 1, RESOLVED = 1, classified correctly
   * Proves: Semantic awareness works
   */
  it('Case D: Semantic change should create new finding (not grandfather)', () => {
    const originalFinding = completeFinding({
      file: 'src/semantic.ts',
      line: 10,
      tool: 'typescript',
      severity: 'error',
      components: {
        code: 'TS2322',
        symbol: 'value',
        message_sig: generateMessageSignature('Type string not assignable to number', 'value')
      } as TypeScriptComponents,
      message: 'Type string not assignable to number'
    });
    
    const baseline: Baseline = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      commit: 'baseline-commit',
      scopes: {
        'typescript-full': {
          policy: 'no-new-debt',
          findings: [originalFinding],
          count: 1
        }
      },
      policies: {
        'zero-tolerance': { description: '', enforcement: '' },
        'no-new-debt': { description: '', enforcement: '' },
        'no-new-debt-with-reason': { description: '', enforcement: '' },
        'conditional-grandfathering': { description: '', enforcement: '' }
      }
    };
    
    // Same file, same code, but DIFFERENT semantic (boolean instead of string)
    const changedFinding = completeFinding({
      file: 'src/semantic.ts',
      line: 10,
      tool: 'typescript',
      severity: 'error',
      components: {
        code: 'TS2322',  // Same code
        symbol: 'value',  // Same symbol
        message_sig: generateMessageSignature('Type boolean not assignable to number', 'value')  // Different semantic
      } as TypeScriptComponents,
      message: 'Type boolean not assignable to number'
    });
    
    // Fingerprints should differ (message signature changed)
    expect(changedFinding.fingerprint).not.toBe(originalFinding.fingerprint);
    
    const current: Baseline = {
      ...baseline,
      generated_at: new Date().toISOString(),
      commit: 'current-commit',
      scopes: {
        'typescript-full': {
          policy: 'no-new-debt',
          findings: [changedFinding],
          count: 1
        }
      }
    };
    
    const results = compareBaseline(current, baseline);
    const overall = computeOverallVerdict(results);
    
    // Should BLOCK (new finding detected)
    expect(overall.verdict).toBe('block');
    
    const tsResult = results.get('typescript-full');
    expect(tsResult?.newFindings).toHaveLength(1);
    expect(tsResult?.resolvedFindings).toHaveLength(1);
  });
  
  /**
   * CASE E: Fix old finding
   * 
   * Resolve historical violation
   * Expected: RESOLVED = 1, NEW = ∅, PASS + ratchet opportunity
   * Proves: Debt reduction detected, baseline NOT auto-updated
   */
  it('Case E: Resolved debt should pass with ratchet opportunity', () => {
    const oldFindings: FindingIdentity[] = [
      completeFinding({
        file: 'src/old-bug.ts',
        line: 10,
        tool: 'typescript',
        severity: 'error',
        components: {
          code: 'TS2353',
          symbol: 'bugA',
          message_sig: generateMessageSignature('Bug A', 'bugA')
        } as TypeScriptComponents,
        message: 'Bug A'
      }),
      completeFinding({
        file: 'src/fixed-bug.ts',
        line: 20,
        tool: 'typescript',
        severity: 'error',
        components: {
          code: 'TS2322',
          symbol: 'bugB',
          message_sig: generateMessageSignature('Bug B', 'bugB')
        } as TypeScriptComponents,
        message: 'Bug B'
      })
    ];
    
    const baseline: Baseline = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      commit: 'baseline-commit',
      scopes: {
        'typescript-full': {
          policy: 'no-new-debt',
          findings: oldFindings,
          count: 2
        }
      },
      policies: {
        'zero-tolerance': { description: '', enforcement: '' },
        'no-new-debt': { description: '', enforcement: '' },
        'no-new-debt-with-reason': { description: '', enforcement: '' },
        'conditional-grandfathering': { description: '', enforcement: '' }
      }
    };
    
    // Current fixed bugB (only bugA remains)
    const current: Baseline = {
      ...baseline,
      generated_at: new Date().toISOString(),
      commit: 'current-commit',
      scopes: {
        'typescript-full': {
          policy: 'no-new-debt',
          findings: [oldFindings[0]],  // Only bugA
          count: 1
        }
      }
    };
    
    const results = compareBaseline(current, baseline);
    const overall = computeOverallVerdict(results);
    
    expect(overall.verdict).toBe('pass');
    expect(overall.ratchetOpportunities).toContain('typescript-full');
    
    const tsResult = results.get('typescript-full');
    expect(tsResult?.newFindings).toHaveLength(0);
    expect(tsResult?.resolvedFindings).toHaveLength(1);
    expect(tsResult?.canRatchet).toBe(true);
  });
  
  /**
   * CASE F: Unchanged migration (PR doesn't touch it)
   * 
   * Migration not modified by PR, violation in baseline
   * Expected: Grandfathered = true, ALLOW
   * Proves: PR-relative grandfathering works
   */
  it('Case F: Unchanged migration should be grandfathered', () => {
    const migrationFinding = completeFinding({
      file: 'migrations/20260101_old.sql',
      line: 10,
      tool: 'migration-check',
      severity: 'error',
      components: {
        migration_id: '20260101',
        rule: 'blocking-index',
        object: 'old_table_idx'
      } as MigrationComponents,
      message: 'Creating index without CONCURRENTLY'
    });
    
    const baseline: Baseline = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      commit: 'baseline-commit',
      scopes: {
        'migration-zero-downtime': {
          policy: 'conditional-grandfathering',
          findings: [migrationFinding],
          count: 1
        }
      },
      policies: {
        'zero-tolerance': { description: '', enforcement: '' },
        'no-new-debt': { description: '', enforcement: '' },
        'no-new-debt-with-reason': { description: '', enforcement: '' },
        'conditional-grandfathering': { description: '', enforcement: '' }
      }
    };
    
    // Current: Same migration, marked grandfathered (PR didn't touch it)
    const grandfatheredFinding: MigrationFinding = {
      ...migrationFinding,
      grandfathered: true
    };
    
    const current: Baseline = {
      ...baseline,
      generated_at: new Date().toISOString(),
      commit: 'current-commit',
      scopes: {
        'migration-zero-downtime': {
          policy: 'conditional-grandfathering',
          findings: [grandfatheredFinding],
          count: 1
        }
      }
    };
    
    const results = compareBaseline(current, baseline);
    const overall = computeOverallVerdict(results);
    
    expect(overall.verdict).toBe('pass');
    
    const migResult = results.get('migration-zero-downtime');
    expect(migResult?.verdict).toBe('pass');
  });
  
  /**
   * CASE G: Modified migration + violation
   * 
   * PR modifies migration, violation present
   * Expected: Grandfathered = false, BLOCK
   * Proves: Modified migrations strictly enforced
   */
  it('Case G: Modified migration with violation should be blocked', () => {
    const migrationFinding = completeFinding({
      file: 'migrations/20260916_new.sql',
      line: 15,
      tool: 'migration-check',
      severity: 'error',
      components: {
        migration_id: '20260916',
        rule: 'blocking-index',
        object: 'new_table_idx'
      } as MigrationComponents,
      message: 'Creating index without CONCURRENTLY'
    });
    
    const baseline: Baseline = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      commit: 'baseline-commit',
      scopes: {
        'migration-zero-downtime': {
          policy: 'conditional-grandfathering',
          findings: [migrationFinding],
          count: 1
        }
      },
      policies: {
        'zero-tolerance': { description: '', enforcement: '' },
        'no-new-debt': { description: '', enforcement: '' },
        'no-new-debt-with-reason': { description: '', enforcement: '' },
        'conditional-grandfathering': { description: '', enforcement: '' }
      }
    };
    
    // Current: Same migration, but PR modified it (not grandfathered)
    const nonGrandfatheredFinding: MigrationFinding = {
      ...migrationFinding,
      grandfathered: false  // PR touched this migration
    };
    
    const current: Baseline = {
      ...baseline,
      generated_at: new Date().toISOString(),
      commit: 'current-commit',
      scopes: {
        'migration-zero-downtime': {
          policy: 'conditional-grandfathering',
          findings: [nonGrandfatheredFinding],
          count: 1
        }
      }
    };
    
    const results = compareBaseline(current, baseline);
    const overall = computeOverallVerdict(results);
    
    // MUST block
    expect(overall.verdict).toBe('block');
    expect(overall.blockedScopes).toContain('migration-zero-downtime');
    
    const migResult = results.get('migration-zero-downtime');
    expect(migResult?.verdict).toBe('block');
  });
});

/**
 * VERIFICATION SUMMARY
 * 
 * Positive Proof (System tolerates historical debt):
 * ✅ Case A: Identical state → PASS
 * ✅ Case C: Line shift → PASS (fingerprint stable)
 * ✅ Case E: Resolved debt → PASS + ratchet
 * ✅ Case F: Unchanged migration → ALLOW (grandfathered)
 * 
 * Negative Proof (System catches new violations):
 * ✅ Case B: New finding → BLOCK
 * ✅ Case D: Semantic change → BLOCK (new fingerprint)
 * ✅ Case G: Modified migration → BLOCK (not grandfathered)
 * 
 * Conclusion: System is NOT more lenient, just smarter at attribution
 */
