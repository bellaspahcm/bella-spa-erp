#!/usr/bin/env node
/**
 * Factory Rule 7: Diagnostic Inventory Reconciliation Guard
 * 
 * Gate: G4 (Evidence)
 * Status: AUTOMATED
 * 
 * Validates:
 * - Diagnostic count claims match actual compiler output
 * - Scope boundaries are consistent
 * - No mixing of out-of-scope files in inventory
 * 
 * Evidence: Dental incident (pharmacy-actions.ts mixed with healthcare-actions.ts)
 */

import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

interface DiagnosticInventory {
  scope: string;
  totalDiagnostics: number;
  fileBreakdown: Map<string, number>;
  outOfScopeFiles: string[];
}

interface InventoryResult {
  passed: boolean;
  inventory: DiagnosticInventory;
  violations: string[];
  summary: string;
}

/**
 * Build diagnostic inventory from TypeScript compiler output
 */
function buildInventory(
  configPath: string,
  scopeFiles?: string[]
): DiagnosticInventory {
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  
  if (configFile.error) {
    throw new Error(`Failed to read tsconfig: ${configFile.error.messageText}`);
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath)
  );

  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options,
  });

  const diagnostics = ts.getPreEmitDiagnostics(program);
  
  const fileBreakdown = new Map<string, number>();
  const outOfScopeFiles: string[] = [];

  for (const diagnostic of diagnostics) {
    if (!diagnostic.file) continue;

    const fileName = diagnostic.file.fileName;
    const count = fileBreakdown.get(fileName) || 0;
    fileBreakdown.set(fileName, count + 1);

    // Check if file is in scope
    if (scopeFiles && scopeFiles.length > 0) {
      const inScope = scopeFiles.some(scopeFile => 
        fileName.includes(scopeFile)
      );
      if (!inScope && !outOfScopeFiles.includes(fileName)) {
        outOfScopeFiles.push(fileName);
      }
    }
  }

  const totalDiagnostics = Array.from(fileBreakdown.values()).reduce(
    (sum, count) => sum + count,
    0
  );

  return {
    scope: scopeFiles?.join(', ') || 'all files',
    totalDiagnostics,
    fileBreakdown,
    outOfScopeFiles,
  };
}

/**
 * Validate inventory reconciliation
 */
function validateInventory(
  configPath: string,
  expectedCount?: number,
  scopeFiles?: string[]
): InventoryResult {
  const inventory = buildInventory(configPath, scopeFiles);
  const violations: string[] = [];

  // Check if out-of-scope files are present
  if (inventory.outOfScopeFiles.length > 0) {
    violations.push(
      `Out-of-scope files detected in inventory: ${inventory.outOfScopeFiles.length} files`
    );
  }

  // Check if expected count matches actual
  if (expectedCount !== undefined) {
    const scopedCount = scopeFiles && scopeFiles.length > 0
      ? Array.from(inventory.fileBreakdown.entries())
          .filter(([file]) => 
            scopeFiles.some(scopeFile => file.includes(scopeFile))
          )
          .reduce((sum, [, count]) => sum + count, 0)
      : inventory.totalDiagnostics;

    if (scopedCount !== expectedCount) {
      violations.push(
        `Expected ${expectedCount} diagnostics, found ${scopedCount} (mismatch: ${Math.abs(scopedCount - expectedCount)})`
      );
    }
  }

  return {
    passed: violations.length === 0,
    inventory,
    violations,
    summary: `Diagnostic Inventory: ${inventory.totalDiagnostics} total, ${inventory.fileBreakdown.size} files`,
  };
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  
  // Accept both --config=value and separate argv
  const configPath = args.find(arg => arg.startsWith('--config='))?.split('=')[1] 
    || args[args.indexOf('--config') + 1]
    || 'tsconfig.json';
  
  const expectedCount = args.find(arg => arg.startsWith('--expected='))?.split('=')[1];
  
  // Accept both --scope=value and separate argv (handles paths with spaces)
  const scopeArg = args.find(arg => arg.startsWith('--scope='))?.split('=')[1]
    || args[args.indexOf('--scope') + 1];
  
  const scopeFiles = scopeArg ? scopeArg.split(',') : undefined;

  console.log(`\n═══════════════════════════════════════════════════════════`);
  console.log(`  FACTORY RULE 7: Diagnostic Inventory Reconciliation (G4)`);
  console.log(`═══════════════════════════════════════════════════════════\n`);

  console.log(`Config: ${configPath}`);
  if (scopeFiles) {
    console.log(`Scope: ${scopeFiles.join(', ')}`);
  }
  if (expectedCount) {
    console.log(`Expected: ${expectedCount} diagnostics`);
  }
  console.log(``);

  try {
    const result = validateInventory(
      configPath,
      expectedCount ? parseInt(expectedCount) : undefined,
      scopeFiles
    );

    console.log(`Inventory Results:`);
    console.log(`  Total diagnostics: ${result.inventory.totalDiagnostics}`);
    console.log(`  Files affected: ${result.inventory.fileBreakdown.size}\n`);

    if (result.inventory.fileBreakdown.size > 0) {
      console.log(`File Breakdown:`);
      for (const [file, count] of result.inventory.fileBreakdown.entries()) {
        const relPath = path.relative(process.cwd(), file);
        const inScope = !result.inventory.outOfScopeFiles.includes(file);
        const marker = inScope ? '✓' : '⚠';
        console.log(`  ${marker} ${relPath}: ${count} diagnostic(s)`);
      }
      console.log(``);
    }

    if (result.inventory.outOfScopeFiles.length > 0) {
      console.log(`⚠ Out-of-scope files detected:`);
      for (const file of result.inventory.outOfScopeFiles) {
        const relPath = path.relative(process.cwd(), file);
        console.log(`  - ${relPath}`);
      }
      console.log(``);
    }

    if (result.passed) {
      console.log(`✓ PASS: Inventory reconciliation valid\n`);
      process.exit(0);
    } else {
      console.log(`✗ FAIL: Inventory reconciliation violations detected\n`);
      
      for (const violation of result.violations) {
        console.log(`  - ${violation}`);
      }

      console.log(`\nRule 7 Guidance:`);
      console.log(`  1. Fix scope boundary (use --scope= to define target files)`);
      console.log(`  2. Separate out-of-scope diagnostics into different remediation`);
      console.log(`  3. Update expected count if baseline changed`);
      console.log(`  4. Do NOT mix files from different remediation scopes\n`);

      process.exit(2); // EXIT 2 = BLOCK
    }
  } catch (error) {
    console.error(`\n✗ ERROR: Rule execution failed`);
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

export { validateInventory, buildInventory, InventoryResult, DiagnosticInventory };
