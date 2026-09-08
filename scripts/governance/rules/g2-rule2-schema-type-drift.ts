#!/usr/bin/env node
/**
 * Factory Rule 2: Schema ↔ Generated Type Drift Guard
 * 
 * Gate: G2 (Architecture/Contract Compliance)
 * Status: UNDER ADVERSARIAL REMEDIATION
 * 
 * Detects schema/type contract drift at typed boundaries:
 * - TS2561: Excess property (property not in schema)
 * - TS2741: Missing required property
 * - TS2322: Incompatible assignment at schema boundary
 * - TS2352: Incompatible conversion at schema boundary
 * 
 * Boundary qualification:
 * - Generated DB type reference: Database[...]...Row/Insert/Update
 * - Schema-derived alias: XxxRow / XxxInsert / XxxUpdate
 * - Typed mutation/query payload boundary
 * 
 * Evidence: 
 * - Dental incident `tubeColor` → `tube_color` (TS2322 + 'never')
 * - Adversarial fixture (TS2561 excess property at Insert boundary)
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

interface Violation {
  file: string;
  line: number;
  column: number;
  code: number;
  message: string;
  severity: 'error' | 'warning';
  classification: 'schema-drift' | 'unclassified';
}

interface RuleResult {
  passed: boolean;
  violations: Violation[];
  unclassified: Violation[];
  summary: string;
}

/**
 * Check if diagnostic is at a schema boundary
 * Evidence hierarchy:
 * 1. Generated DB type reference (Database[...]...Row/Insert/Update)
 * 2. Explicit schema-derived alias (XxxRow/XxxInsert/XxxUpdate)
 * 3. Typed mutation/query payload boundary
 */
function isSchemaBoundary(
  diagnostic: ts.Diagnostic,
  program: ts.Program
): boolean {
  if (!diagnostic.file || diagnostic.start === undefined) {
    return false;
  }

  const sourceFile = diagnostic.file;
  const position = diagnostic.start;

  // Get type at diagnostic position
  const typeChecker = program.getTypeChecker();
  const token = ts.getTokenAtPosition(sourceFile, position);
  
  try {
    // Check parent nodes for schema type indicators
    let node: ts.Node | undefined = token;
    let depth = 0;
    const MAX_DEPTH = 5; // Limit traversal depth

    while (node && depth < MAX_DEPTH) {
      // Check if node has type annotation
      if (ts.isVariableDeclaration(node) || ts.isParameter(node)) {
        const type = node.type;
        if (type) {
          const typeText = type.getText(sourceFile);
          
          // Evidence 1: Generated DB type reference
          if (typeText.includes('Database[') && 
              (typeText.includes('Row') || typeText.includes('Insert') || typeText.includes('Update'))) {
            return true;
          }
          
          // Evidence 2: Schema-derived alias
          if (typeText.match(/\w+(Row|Insert|Update)$/)) {
            return true;
          }
        }
      }

      // Check type assertion targets
      if (ts.isAsExpression(node)) {
        const typeText = node.type.getText(sourceFile);
        if (typeText.includes('Database[') || typeText.match(/\w+(Row|Insert|Update)$/)) {
          return true;
        }
      }

      node = node.parent;
      depth++;
    }
  } catch (error) {
    // Type checking failed, cannot determine boundary
    return false;
  }

  return false;
}

/**
 * Parse TypeScript diagnostics for schema drift patterns
 * 
 * Target diagnostics:
 * - TS2561: Object literal excess property
 * - TS2741: Missing required property  
 * - TS2322: Incompatible assignment
 * - TS2352: Incompatible conversion
 * 
 * Classification:
 * - High-confidence schema boundary + drift → BLOCK
 * - Ambiguous → UNCLASSIFIED (warn, don't block)
 * - Clearly unrelated → Skip (out of scope)
 */
function parseTypeScriptDiagnostics(
  diagnostics: readonly ts.Diagnostic[],
  program: ts.Program
): { violations: Violation[]; unclassified: Violation[] } {
  const violations: Violation[] = [];
  const unclassified: Violation[] = [];

  const DRIFT_DIAGNOSTICS = [2561, 2741, 2322, 2352];

  for (const diagnostic of diagnostics) {
    if (!DRIFT_DIAGNOSTICS.includes(diagnostic.code) || !diagnostic.file) {
      continue;
    }

    const message = ts.flattenDiagnosticMessageText(
      diagnostic.messageText,
      '\n'
    );

    const { line, character } = diagnostic.file.getLineAndCharacterOfPosition(
      diagnostic.start!
    );

    const violation: Violation = {
      file: diagnostic.file.fileName,
      line: line + 1,
      column: character + 1,
      code: diagnostic.code,
      message: message,
      severity: 'error',
      classification: 'unclassified',
    };

    // DEBUG: Log boundary check
    const isBoundary = isSchemaBoundary(diagnostic, program);
    if (process.env.DEBUG_R2) {
      console.error(`[DEBUG] TS${diagnostic.code} at ${line+1}:${character+1}: boundary=${isBoundary}`);
    }

    // Boundary qualification
    if (isBoundary) {
      violation.classification = 'schema-drift';
      violations.push(violation);
    } else {
      // Ambiguous: drift diagnostic but no clear schema boundary
      unclassified.push(violation);
    }
  }

  return { violations, unclassified };
}

/**
 * Run TypeScript compiler and extract schema drift violations
 */
function checkSchemaDrift(configPath: string): RuleResult {
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
  
  if (process.env.DEBUG_R2) {
    console.error(`[DEBUG] Total diagnostics: ${diagnostics.length}`);
    for (const d of diagnostics) {
      if (d.file) {
        const { line } = d.file.getLineAndCharacterOfPosition(d.start!);
        console.error(`[DEBUG]   TS${d.code} at line ${line+1}`);
      }
    }
  }
  
  const { violations, unclassified } = parseTypeScriptDiagnostics(diagnostics, program);

  return {
    passed: violations.length === 0,
    violations,
    unclassified,
    summary: `Schema Drift Guard: ${violations.length} violations, ${unclassified.length} unclassified`,
  };
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  const configPath = args[0] || 'tsconfig.json';

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  FACTORY RULE 2: Schema ↔ Type Drift Guard (G2)`);
  console.log(`═══════════════════════════════════════════════════\n`);

  console.log(`Config: ${configPath}`);
  console.log(`Scanning for schema drift at typed boundaries...\n`);

  try {
    const result = checkSchemaDrift(configPath);

    if (result.unclassified.length > 0) {
      console.log(`⚠ UNCLASSIFIED: ${result.unclassified.length} drift diagnostics without clear schema boundary\n`);
      for (const item of result.unclassified) {
        const relPath = path.relative(process.cwd(), item.file);
        console.log(`  ${relPath}:${item.line}:${item.column}`);
        console.log(`    TS${item.code}: ${item.message.substring(0, 100)}...`);
      }
      console.log(`\n  These are NOT blocked by Rule 2 (ambiguous context)`);
      console.log(`  Consider manual review or other gates\n`);
    }

    if (result.passed) {
      console.log(`✓ PASS: No schema drift violations at typed boundaries\n`);
      process.exit(0);
    } else {
      console.log(`✗ FAIL: ${result.violations.length} schema drift violations detected\n`);
      
      for (const violation of result.violations) {
        const relPath = path.relative(process.cwd(), violation.file);
        console.log(`  ${relPath}:${violation.line}:${violation.column}`);
        console.log(`    TS${violation.code}: ${violation.message}`);
        console.log(`    Classification: ${violation.classification}`);
        console.log(``);
      }

      console.log(`\nRule 2 Guidance:`);
      console.log(`  1. Check property name matches schema (camelCase vs snake_case)`);
      console.log(`  2. Verify field exists in database.types.ts`);
      console.log(`  3. Verify all required properties present`);
      console.log(`  4. Do NOT cast to 'any' or suppress error`);
      console.log(`  5. Fix property name/presence to match canonical schema\n`);

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

export { checkSchemaDrift, RuleResult, Violation };
