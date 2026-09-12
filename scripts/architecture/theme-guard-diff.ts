#!/usr/bin/env node
/**
 * THEME GUARD DIFF - NO-NEW-DEBT ENFORCEMENT
 * 
 * Compares current violations against baseline.
 * BLOCKS if new violations introduced or existing count increased.
 * ALLOWS if violations unchanged or decreased (legacy baseline).
 * 
 * Usage:
 *   npm run theme:guard:diff
 * 
 * Exit codes:
 *   0 = No new debt (legacy baseline allowed)
 *   1 = New debt detected (BLOCK)
 *   2 = Improvement detected (violations reduced)
 */

import * as fs from 'fs';
import * as path from 'path';
import { runGuard, type GuardResult } from './theme-guard';

// ============================================================================
// TYPES
// ============================================================================

interface Baseline {
  version: string;
  date: string;
  baseline: {
    BROAD_TENANT_SELECTOR: number;
    DUPLICATE_VISUAL_OWNER: number;
    EXCLUSION_CHAIN_SMELL_BLOCK: number;
    EXCLUSION_CHAIN_SMELL_WARN: number;
    TOTAL_BLOCK: number;
    TOTAL_WARN: number;
  };
}

interface DiffResult {
  passed: boolean;
  improved: boolean;
  newDebt: boolean;
  changes: {
    rule: string;
    baseline: number;
    current: number;
    delta: number;
  }[];
}

// ============================================================================
// BASELINE MANAGEMENT
// ============================================================================

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const BASELINE_PATH = path.join(__dirname, 'theme-guard-baseline.json');

function loadBaseline(): Baseline {
  if (!fs.existsSync(BASELINE_PATH)) {
    throw new Error(`Baseline not found: ${BASELINE_PATH}`);
  }
  
  const content = fs.readFileSync(BASELINE_PATH, 'utf-8');
  return JSON.parse(content);
}

function countViolationsByRule(result: GuardResult): Record<string, { block: number; warn: number }> {
  const counts: Record<string, { block: number; warn: number }> = {};
  
  for (const violation of result.violations) {
    if (!counts[violation.rule]) {
      counts[violation.rule] = { block: 0, warn: 0 };
    }
    
    if (violation.severity === 'BLOCK') {
      counts[violation.rule].block++;
    } else {
      counts[violation.rule].warn++;
    }
  }
  
  return counts;
}

// ============================================================================
// DIFF LOGIC
// ============================================================================

function computeDiff(baseline: Baseline, current: GuardResult): DiffResult {
  const currentCounts = countViolationsByRule(current);
  
  const changes: DiffResult['changes'] = [];
  
  // Check BROAD_TENANT_SELECTOR
  const broadCurrent = currentCounts['BROAD_TENANT_SELECTOR']?.block || 0;
  const broadBaseline = baseline.baseline.BROAD_TENANT_SELECTOR;
  if (broadCurrent !== broadBaseline) {
    changes.push({
      rule: 'BROAD_TENANT_SELECTOR',
      baseline: broadBaseline,
      current: broadCurrent,
      delta: broadCurrent - broadBaseline
    });
  }
  
  // Check DUPLICATE_VISUAL_OWNER
  const dupCurrent = currentCounts['DUPLICATE_VISUAL_OWNER']?.block || 0;
  const dupBaseline = baseline.baseline.DUPLICATE_VISUAL_OWNER;
  if (dupCurrent !== dupBaseline) {
    changes.push({
      rule: 'DUPLICATE_VISUAL_OWNER',
      baseline: dupBaseline,
      current: dupCurrent,
      delta: dupCurrent - dupBaseline
    });
  }
  
  // Check EXCLUSION_CHAIN_SMELL (BLOCK)
  const exclusionBlockCurrent = currentCounts['EXCLUSION_CHAIN_SMELL']?.block || 0;
  const exclusionBlockBaseline = baseline.baseline.EXCLUSION_CHAIN_SMELL_BLOCK;
  if (exclusionBlockCurrent !== exclusionBlockBaseline) {
    changes.push({
      rule: 'EXCLUSION_CHAIN_SMELL_BLOCK',
      baseline: exclusionBlockBaseline,
      current: exclusionBlockCurrent,
      delta: exclusionBlockCurrent - exclusionBlockBaseline
    });
  }
  
  // Check EXCLUSION_CHAIN_SMELL (WARN)
  const exclusionWarnCurrent = currentCounts['EXCLUSION_CHAIN_SMELL']?.warn || 0;
  const exclusionWarnBaseline = baseline.baseline.EXCLUSION_CHAIN_SMELL_WARN;
  if (exclusionWarnCurrent !== exclusionWarnBaseline) {
    changes.push({
      rule: 'EXCLUSION_CHAIN_SMELL_WARN',
      baseline: exclusionWarnBaseline,
      current: exclusionWarnCurrent,
      delta: exclusionWarnCurrent - exclusionWarnBaseline
    });
  }
  
  // Determine result
  const hasIncrease = changes.some(c => c.delta > 0);
  const hasDecrease = changes.some(c => c.delta < 0);
  const newDebt = hasIncrease;
  const improved = hasDecrease && !hasIncrease;
  const passed = !newDebt; // Allow if no increase (unchanged or improved)
  
  return {
    passed,
    improved,
    newDebt,
    changes
  };
}

// ============================================================================
// REPORTING
// ============================================================================

function printDiffReport(baseline: Baseline, current: GuardResult, diff: DiffResult): void {
  console.log('\n🔍 THEME GUARD DIFF - NO-NEW-DEBT CHECK');
  console.log('=========================================\n');
  
  console.log(`Baseline: ${baseline.date} (v${baseline.version})`);
  console.log(`Current: ${new Date().toISOString().split('T')[0]}\n`);
  
  if (diff.changes.length === 0) {
    console.log('✅ No changes detected - violation counts match baseline\n');
    console.log('Status: PASS (legacy baseline unchanged)');
    return;
  }
  
  console.log('📊 Changes Detected:\n');
  
  for (const change of diff.changes) {
    const arrow = change.delta > 0 ? '📈' : '📉';
    const sign = change.delta > 0 ? '+' : '';
    const status = change.delta > 0 ? '❌ NEW DEBT' : '✅ IMPROVEMENT';
    
    console.log(`  ${arrow} ${change.rule}`);
    console.log(`     Baseline: ${change.baseline}`);
    console.log(`     Current:  ${change.current}`);
    console.log(`     Delta:    ${sign}${change.delta}`);
    console.log(`     Status:   ${status}`);
    console.log('');
  }
  
  console.log('=========================================');
  
  if (diff.newDebt) {
    console.log('❌ NEW DEBT DETECTED - BLOCKED\n');
    console.log('One or more violation counts increased.');
    console.log('Fix new violations or update baseline with justification.\n');
  } else if (diff.improved) {
    console.log('🎉 IMPROVEMENT DETECTED - PASS\n');
    console.log('Violation counts decreased. Great work!');
    console.log('Consider updating baseline to lock in progress.\n');
  } else {
    console.log('✅ PASS - No new debt introduced\n');
  }
  
  console.log(`Totals: ${current.blockCount} BLOCK, ${current.warnCount} WARN`);
  console.log(`Baseline: ${baseline.baseline.TOTAL_BLOCK} BLOCK, ${baseline.baseline.TOTAL_WARN} WARN\n`);
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

if (require.main === module) {
  try {
    // Load baseline
    const baseline = loadBaseline();
    
    // Run guard
    const current = runGuard(false);
    
    // Compute diff
    const diff = computeDiff(baseline, current);
    
    // Print report
    printDiffReport(baseline, current, diff);
    
    // Exit with appropriate code
    if (diff.improved) {
      console.log('💡 Tip: Run `npm run theme:guard:update-baseline` to lock in improvement\n');
      process.exit(2); // Improvement
    } else if (diff.passed) {
      process.exit(0); // Pass (no new debt)
    } else {
      process.exit(1); // Fail (new debt)
    }
  } catch (error) {
    console.error('❌ Theme guard diff failed:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

export { computeDiff, loadBaseline, type DiffResult };
