/**
 * THEME GUARD DIFF - NO-NEW-DEBT ENFORCEMENT TESTS
 * 
 * Validates baseline-aware differential blocking logic:
 * - Legacy violations allowed (baseline)
 * - New violations blocked
 * - Improved violations pass
 */

import { computeDiff, loadBaseline, type DiffResult } from '../../scripts/architecture/theme-guard-diff';
import type { GuardResult } from '../../scripts/architecture/theme-guard';

// ============================================================================
// MOCK BASELINE
// ============================================================================

const MOCK_BASELINE = {
  version: '1.0.0',
  date: '2026-09-10',
  baseline: {
    BROAD_TENANT_SELECTOR: 26,
    DUPLICATE_VISUAL_OWNER: 8,
    EXCLUSION_CHAIN_SMELL_BLOCK: 74,
    EXCLUSION_CHAIN_SMELL_WARN: 12,
    TOTAL_BLOCK: 108,
    TOTAL_WARN: 12
  }
};

// ============================================================================
// TEST HELPERS
// ============================================================================

function createMockResult(overrides: Partial<Record<string, { block: number; warn: number }>>): GuardResult {
  const violations = [];
  
  // BROAD_TENANT_SELECTOR
  const broadCount = overrides['BROAD_TENANT_SELECTOR']?.block !== undefined 
    ? overrides['BROAD_TENANT_SELECTOR'].block 
    : 26;
  for (let i = 0; i < broadCount; i++) {
    violations.push({
      file: 'test.css',
      line: i,
      rule: 'BROAD_TENANT_SELECTOR',
      severity: 'BLOCK' as const,
      message: 'test',
      snippet: 'test'
    });
  }
  
  // DUPLICATE_VISUAL_OWNER
  const dupCount = overrides['DUPLICATE_VISUAL_OWNER']?.block !== undefined
    ? overrides['DUPLICATE_VISUAL_OWNER'].block
    : 8;
  for (let i = 0; i < dupCount; i++) {
    violations.push({
      file: 'test.css',
      line: i + 100,
      rule: 'DUPLICATE_VISUAL_OWNER',
      severity: 'BLOCK' as const,
      message: 'test',
      snippet: 'test'
    });
  }
  
  // EXCLUSION_CHAIN_SMELL (BLOCK)
  const exclusionBlockCount = overrides['EXCLUSION_CHAIN_SMELL']?.block !== undefined
    ? overrides['EXCLUSION_CHAIN_SMELL'].block
    : 74;
  for (let i = 0; i < exclusionBlockCount; i++) {
    violations.push({
      file: 'test.css',
      line: i + 200,
      rule: 'EXCLUSION_CHAIN_SMELL',
      severity: 'BLOCK' as const,
      message: 'test',
      snippet: 'test'
    });
  }
  
  // EXCLUSION_CHAIN_SMELL (WARN)
  const exclusionWarnCount = overrides['EXCLUSION_CHAIN_SMELL']?.warn !== undefined
    ? overrides['EXCLUSION_CHAIN_SMELL'].warn
    : 12;
  for (let i = 0; i < exclusionWarnCount; i++) {
    violations.push({
      file: 'test.css',
      line: i + 300,
      rule: 'EXCLUSION_CHAIN_SMELL',
      severity: 'WARN' as const,
      message: 'test',
      snippet: 'test'
    });
  }
  
  const blockCount = violations.filter(v => v.severity === 'BLOCK').length;
  const warnCount = violations.filter(v => v.severity === 'WARN').length;
  
  return {
    passed: blockCount === 0,
    violations,
    blockCount,
    warnCount,
    filesScanned: 30
  };
}

// ============================================================================
// TESTS
// ============================================================================

describe('Theme Guard Diff - No-New-Debt Enforcement', () => {
  
  describe('Baseline Matching', () => {
    it('should PASS when violation counts match baseline exactly', () => {
      const current = createMockResult({});
      const diff = computeDiff(MOCK_BASELINE, current);
      
      expect(diff.passed).toBe(true);
      expect(diff.newDebt).toBe(false);
      expect(diff.improved).toBe(false);
      expect(diff.changes).toHaveLength(0);
    });
  });
  
  describe('New Debt Detection', () => {
    it('should BLOCK when BROAD_TENANT_SELECTOR increases', () => {
      const current = createMockResult({
        'BROAD_TENANT_SELECTOR': { block: 27, warn: 0 }
      });
      const diff = computeDiff(MOCK_BASELINE, current);
      
      expect(diff.passed).toBe(false);
      expect(diff.newDebt).toBe(true);
      expect(diff.improved).toBe(false);
      
      const broadChange = diff.changes.find(c => c.rule === 'BROAD_TENANT_SELECTOR');
      expect(broadChange).toBeDefined();
      expect(broadChange?.delta).toBe(1);
    });
    
    it('should BLOCK when DUPLICATE_VISUAL_OWNER increases', () => {
      const current = createMockResult({
        'DUPLICATE_VISUAL_OWNER': { block: 9, warn: 0 }
      });
      const diff = computeDiff(MOCK_BASELINE, current);
      
      expect(diff.passed).toBe(false);
      expect(diff.newDebt).toBe(true);
      
      const dupChange = diff.changes.find(c => c.rule === 'DUPLICATE_VISUAL_OWNER');
      expect(dupChange?.delta).toBe(1);
    });
    
    it('should BLOCK when EXCLUSION_CHAIN_SMELL_BLOCK increases', () => {
      const current = createMockResult({
        'EXCLUSION_CHAIN_SMELL': { block: 75, warn: 12 }
      });
      const diff = computeDiff(MOCK_BASELINE, current);
      
      expect(diff.passed).toBe(false);
      expect(diff.newDebt).toBe(true);
      
      const exclusionChange = diff.changes.find(c => c.rule === 'EXCLUSION_CHAIN_SMELL_BLOCK');
      expect(exclusionChange?.delta).toBe(1);
    });
    
    it('should BLOCK when multiple violation types increase', () => {
      const current = createMockResult({
        'BROAD_TENANT_SELECTOR': { block: 27, warn: 0 },
        'DUPLICATE_VISUAL_OWNER': { block: 10, warn: 0 }
      });
      const diff = computeDiff(MOCK_BASELINE, current);
      
      expect(diff.passed).toBe(false);
      expect(diff.newDebt).toBe(true);
      expect(diff.changes).toHaveLength(2);
    });
  });
  
  describe('Improvement Detection', () => {
    it('should PASS with improvement when BROAD_TENANT_SELECTOR decreases', () => {
      const current = createMockResult({
        'BROAD_TENANT_SELECTOR': { block: 20, warn: 0 }
      });
      const diff = computeDiff(MOCK_BASELINE, current);
      
      expect(diff.passed).toBe(true);
      expect(diff.newDebt).toBe(false);
      expect(diff.improved).toBe(true);
      
      const broadChange = diff.changes.find(c => c.rule === 'BROAD_TENANT_SELECTOR');
      expect(broadChange?.delta).toBe(-6);
    });
    
    it('should PASS with improvement when all violations decrease', () => {
      const current = createMockResult({
        'BROAD_TENANT_SELECTOR': { block: 20, warn: 0 },
        'DUPLICATE_VISUAL_OWNER': { block: 5, warn: 0 },
        'EXCLUSION_CHAIN_SMELL': { block: 50, warn: 10 }
      });
      const diff = computeDiff(MOCK_BASELINE, current);
      
      expect(diff.passed).toBe(true);
      expect(diff.improved).toBe(true);
      expect(diff.changes.length).toBeGreaterThan(0);
      expect(diff.changes.every(c => c.delta < 0)).toBe(true);
    });
  });
  
  describe('Mixed Changes', () => {
    it('should BLOCK when some violations increase despite others decreasing', () => {
      const current = createMockResult({
        'BROAD_TENANT_SELECTOR': { block: 20, warn: 0 }, // -6 improvement
        'DUPLICATE_VISUAL_OWNER': { block: 10, warn: 0 }  // +2 new debt
      });
      const diff = computeDiff(MOCK_BASELINE, current);
      
      expect(diff.passed).toBe(false);
      expect(diff.newDebt).toBe(true);
      expect(diff.improved).toBe(false); // New debt overrides improvement
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle zero violations in current scan', () => {
      const current = createMockResult({
        'BROAD_TENANT_SELECTOR': { block: 0, warn: 0 },
        'DUPLICATE_VISUAL_OWNER': { block: 0, warn: 0 },
        'EXCLUSION_CHAIN_SMELL': { block: 0, warn: 0 }
      });
      const diff = computeDiff(MOCK_BASELINE, current);
      
      expect(diff.passed).toBe(true);
      expect(diff.improved).toBe(true);
      expect(diff.changes.length).toBeGreaterThanOrEqual(3); // At least 3 rules improved
      expect(diff.changes.every(c => c.delta < 0)).toBe(true); // All deltas negative
    });
    
    it('should handle WARN violations changing independently', () => {
      const current = createMockResult({
        'EXCLUSION_CHAIN_SMELL': { block: 74, warn: 15 } // WARN increased
      });
      const diff = computeDiff(MOCK_BASELINE, current);
      
      expect(diff.passed).toBe(false); // WARN increase is also new debt
      expect(diff.newDebt).toBe(true);
    });
  });
});
