#!/usr/bin/env node
/**
 * HEALTHCARE ARCHITECTURE GUARD
 * 
 * Automated enforcement of architectural invariants learned from P1 Healthcare investigation.
 * 
 * Rules derived from:
 * - P1 Healthcare circular dependency investigation (2026-09-01)
 * - Differential isolation findings
 * - Barrel export pattern violations
 * 
 * Usage:
 *   npx ts-node scripts/healthcare/healthcare-architecture-guard.ts
 *   npm run arch:guard:healthcare
 * 
 * Exit codes:
 *   0 = All checks passed
 *   1 = Architecture violation detected
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

// ============================================================================
// TYPES
// ============================================================================

interface Violation {
  rule: string;
  file: string;
  line?: number;
  severity: 'ERROR' | 'WARNING';
  message: string;
  evidence?: string;
}

interface GuardResult {
  passed: boolean;
  violations: Violation[];
  checksRun: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const WORKSPACE_ROOT = path.resolve(__dirname, '../..');
const HEALTHCARE_ROOT = path.join(WORKSPACE_ROOT, 'src/platform/healthcare');

// ============================================================================
// RULE 1: Events Must Not Import Domain Entities
// ============================================================================
// Source: P1 Healthcare circular dependency #1
// Pattern: events → domain creates architectural defect
// Events should depend only on contracts

function checkEventsDomainDependency(): Violation[] {
  const violations: Violation[] = [];
  const eventsDir = path.join(HEALTHCARE_ROOT, 'engines/order-engine/events');
  
  if (!fs.existsSync(eventsDir)) return violations;
  
  const eventFiles = fs.readdirSync(eventsDir)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  
  for (const file of eventFiles) {
    const filePath = path.join(eventsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check for domain imports
    const domainImportPattern = /import\s+.*from\s+['"]\.\.\/domain\//g;
    const matches = content.match(domainImportPattern);
    
    if (matches) {
      const lines = content.split('\n');
      matches.forEach(match => {
        const lineNum = lines.findIndex(l => l.includes(match)) + 1;
        violations.push({
          rule: 'EVENTS_NO_DOMAIN_IMPORT',
          file: path.relative(WORKSPACE_ROOT, filePath),
          line: lineNum,
          severity: 'ERROR',
          message: 'Event files must not import from domain layer',
          evidence: match.trim(),
        });
      });
    }
  }
  
  return violations;
}

// ============================================================================
// RULE 2: Barrel Exports Must Not Re-Export Parent Contracts
// ============================================================================
// Source: P1 Healthcare circular dependency #2 (compiler hang root cause)
// Pattern: engine/index.ts → ../../contracts → engine/contracts creates cycle

function checkBarrelContractReExports(): Violation[] {
  const violations: Violation[] = [];
  
  // Check all engine index.ts files
  const enginesDir = path.join(HEALTHCARE_ROOT, 'engines');
  
  if (!fs.existsSync(enginesDir)) return violations;
  
  const engines = fs.readdirSync(enginesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  
  for (const engine of engines) {
    const indexPath = path.join(enginesDir, engine, 'index.ts');
    
    if (!fs.existsSync(indexPath)) continue;
    
    const content = fs.readFileSync(indexPath, 'utf-8');
    
    // Check for parent contract re-exports
    const contractReExportPattern = /(?:export\s+.*from\s+|import\s+.*from\s+)['"]\.\.\/\.\.\/contracts\//g;
    const matches = content.match(contractReExportPattern);
    
    if (matches) {
      const lines = content.split('\n');
      matches.forEach(match => {
        const lineNum = lines.findIndex(l => l.includes(match)) + 1;
        violations.push({
          rule: 'BARREL_NO_PARENT_CONTRACT_REEXPORT',
          file: path.relative(WORKSPACE_ROOT, indexPath),
          line: lineNum,
          severity: 'ERROR',
          message: 'Engine barrel exports must not re-export parent contracts (creates circular module resolution)',
          evidence: match.trim(),
        });
      });
    }
  }
  
  return violations;
}

// ============================================================================
// RULE 3: Contracts Must Not Import Engine Internals
// ============================================================================
// Source: Contract boundary principle
// Contracts define interface, engines implement

function checkContractEngineReverseDependency(): Violation[] {
  const violations: Violation[] = [];
  const contractsDir = path.join(HEALTHCARE_ROOT, 'contracts');
  
  if (!fs.existsSync(contractsDir)) return violations;
  
  const contractFiles = fs.readdirSync(contractsDir)
    .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
  
  for (const file of contractFiles) {
    const filePath = path.join(contractsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Check for engine imports
    const engineImportPattern = /import\s+.*from\s+['"]\.\.\/engines\//g;
    const matches = content.match(engineImportPattern);
    
    if (matches) {
      const lines = content.split('\n');
      matches.forEach(match => {
        const lineNum = lines.findIndex(l => l.includes(match)) + 1;
        violations.push({
          rule: 'CONTRACT_NO_ENGINE_IMPORT',
          file: path.relative(WORKSPACE_ROOT, filePath),
          line: lineNum,
          severity: 'ERROR',
          message: 'Contracts must not import engine internals (reverse dependency)',
          evidence: match.trim(),
        });
      });
    }
  }
  
  return violations;
}

// ============================================================================
// RULE 4: Detect Import Cycles (Simple Static Check)
// ============================================================================
// Source: P1 Healthcare circular dependency investigation
// This is a simplified check; madge provides deeper analysis

function checkSimpleImportCycles(): Violation[] {
  const violations: Violation[] = [];
  
  // Build import graph
  const importGraph = new Map<string, Set<string>>();
  
  function scanDirectory(dir: string) {
    if (!fs.existsSync(dir)) return;
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.test.ts')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        const imports = extractLocalImports(content, fullPath);
        importGraph.set(fullPath, imports);
      }
    }
  }
  
  function extractLocalImports(content: string, fromFile: string): Set<string> {
    const imports = new Set<string>();
    const importPattern = /import\s+.*from\s+['"](\..+?)['"]/g;
    let match;
    
    while ((match = importPattern.exec(content)) !== null) {
      const importPath = match[1];
      const resolvedPath = path.resolve(path.dirname(fromFile), importPath);
      
      // Add .ts if not present
      let finalPath = resolvedPath;
      if (!resolvedPath.endsWith('.ts')) {
        if (fs.existsSync(resolvedPath + '.ts')) {
          finalPath = resolvedPath + '.ts';
        } else if (fs.existsSync(path.join(resolvedPath, 'index.ts'))) {
          finalPath = path.join(resolvedPath, 'index.ts');
        }
      }
      
      imports.add(finalPath);
    }
    
    return imports;
  }
  
  function detectCycles(node: string, visited: Set<string>, stack: Set<string>, path: string[]): string[] | null {
    if (stack.has(node)) {
      // Cycle detected
      const cycleStart = path.indexOf(node);
      return path.slice(cycleStart).concat([node]);
    }
    
    if (visited.has(node)) return null;
    
    visited.add(node);
    stack.add(node);
    path.push(node);
    
    const imports = importGraph.get(node) || new Set();
    
    for (const imported of imports) {
      const cycle = detectCycles(imported, visited, stack, [...path]);
      if (cycle) return cycle;
    }
    
    stack.delete(node);
    return null;
  }
  
  // Scan Healthcare directory
  scanDirectory(HEALTHCARE_ROOT);
  
  // Detect cycles
  const visited = new Set<string>();
  
  for (const [node] of importGraph) {
    if (!visited.has(node)) {
      const cycle = detectCycles(node, visited, new Set(), []);
      if (cycle) {
        const cyclePath = cycle.map(f => path.relative(WORKSPACE_ROOT, f)).join('\n  → ');
        violations.push({
          rule: 'NO_IMPORT_CYCLES',
          file: path.relative(WORKSPACE_ROOT, cycle[0]),
          severity: 'ERROR',
          message: 'Import cycle detected',
          evidence: `Cycle:\n  ${cyclePath}`,
        });
        break; // Report first cycle only
      }
    }
  }
  
  return violations;
}

// ============================================================================
// RULE 5: Engine Contracts Must Be Inside Engine Directory
// ============================================================================
// Source: Architecture principle (not from P1, but related)
// Keep engine-specific contracts co-located

function checkEngineContractLocation(): Violation[] {
  const violations: Violation[] = [];
  const enginesDir = path.join(HEALTHCARE_ROOT, 'engines');
  
  if (!fs.existsSync(enginesDir)) return violations;
  
  const engines = fs.readdirSync(enginesDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);
  
  for (const engine of engines) {
    const contractsDir = path.join(enginesDir, engine, 'contracts');
    
    if (!fs.existsSync(contractsDir)) continue;
    
    const contractFiles = fs.readdirSync(contractsDir)
      .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts'));
    
    for (const file of contractFiles) {
      const filePath = path.join(contractsDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      
      // Check if importing from parent contracts
      const parentContractPattern = /import\s+.*from\s+['"]\.\.\/\.\.\/\.\.\/contracts\//g;
      const matches = content.match(parentContractPattern);
      
      if (matches) {
        const lines = content.split('\n');
        matches.forEach(match => {
          const lineNum = lines.findIndex(l => l.includes(match)) + 1;
          violations.push({
            rule: 'ENGINE_CONTRACT_ISOLATION',
            file: path.relative(WORKSPACE_ROOT, filePath),
            line: lineNum,
            severity: 'WARNING',
            message: 'Engine-specific contracts importing parent contracts (consider consolidation)',
            evidence: match.trim(),
          });
        });
      }
    }
  }
  
  return violations;
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

function printViolations(violations: Violation[]): void {
  if (violations.length === 0) {
    console.log('\n✅ Healthcare Architecture Guard: ALL CHECKS PASSED\n');
    return;
  }
  
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║                                                                ║');
  console.log('║         ❌ HEALTHCARE ARCHITECTURE VIOLATIONS FOUND ❌        ║');
  console.log('║                                                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  const errors = violations.filter(v => v.severity === 'ERROR');
  const warnings = violations.filter(v => v.severity === 'WARNING');
  
  if (errors.length > 0) {
    console.log(`🔴 ERRORS: ${errors.length}\n`);
    errors.forEach((v, i) => {
      console.log(`${i + 1}. [${v.rule}]`);
      console.log(`   File: ${v.file}${v.line ? `:${v.line}` : ''}`);
      console.log(`   ${v.message}`);
      if (v.evidence) {
        console.log(`   Evidence: ${v.evidence}`);
      }
      console.log('');
    });
  }
  
  if (warnings.length > 0) {
    console.log(`⚠️  WARNINGS: ${warnings.length}\n`);
    warnings.forEach((v, i) => {
      console.log(`${i + 1}. [${v.rule}]`);
      console.log(`   File: ${v.file}${v.line ? `:${v.line}` : ''}`);
      console.log(`   ${v.message}`);
      if (v.evidence) {
        console.log(`   Evidence: ${v.evidence}`);
      }
      console.log('');
    });
  }
  
  console.log('══════════════════════════════════════════════════════════════\n');
  console.log('Rules enforced (from P1 Healthcare investigation):');
  console.log('  • EVENTS_NO_DOMAIN_IMPORT (circular dependency prevention)');
  console.log('  • BARREL_NO_PARENT_CONTRACT_REEXPORT (compiler hang prevention)');
  console.log('  • CONTRACT_NO_ENGINE_IMPORT (reverse dependency prevention)');
  console.log('  • NO_IMPORT_CYCLES (general cycle detection)');
  console.log('  • ENGINE_CONTRACT_ISOLATION (architecture principle)');
  console.log('');
}

function main(): void {
  console.log('Running Healthcare Architecture Guard...\n');
  
  const allViolations: Violation[] = [];
  let checksRun = 0;
  
  // Run all checks
  const checks = [
    { name: 'Events domain dependency', fn: checkEventsDomainDependency },
    { name: 'Barrel contract re-exports', fn: checkBarrelContractReExports },
    { name: 'Contract engine reverse dependency', fn: checkContractEngineReverseDependency },
    { name: 'Import cycles', fn: checkSimpleImportCycles },
    { name: 'Engine contract isolation', fn: checkEngineContractLocation },
  ];
  
  for (const check of checks) {
    console.log(`  ⏳ ${check.name}...`);
    const violations = check.fn();
    allViolations.push(...violations);
    checksRun++;
  }
  
  console.log(`\n✅ ${checksRun} checks completed\n`);
  
  printViolations(allViolations);
  
  const errors = allViolations.filter(v => v.severity === 'ERROR');
  
  if (errors.length > 0) {
    console.log('❌ Architecture Guard FAILED');
    console.log(`   ${errors.length} error(s) must be fixed\n`);
    process.exit(1);
  } else {
    console.log('✅ Architecture Guard PASSED\n');
    process.exit(0);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { checkEventsDomainDependency, checkBarrelContractReExports, checkContractEngineReverseDependency, checkSimpleImportCycles, checkEngineContractLocation };
